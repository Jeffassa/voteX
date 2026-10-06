import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models import Candidate, Election, Student, Vote, VoterRecord
from app.models.election import ElectionStatus
from app.models.audit import AuditAction
from app.schemas.vote import VoteVerification
from app.services import audit_service, ballot_box
from app.services.blockchain import compute_vote_hash


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CastBallot:
    """Ce que l'électeur reçoit : de quoi vérifier son bulletin, rien de son choix.

    `id` est un identifiant de reçu, propre à cette réponse : il ne désigne
    aucune ligne en base (le bulletin, lui, attend dans l'urne chiffrée).
    """

    id: UUID
    election_id: UUID
    vote_hash: str
    tx_hash: str | None = None
    block_number: int | None = None


def cast_vote(db: Session, *, user: Student, election_id: UUID, candidate_id: UUID | None = None) -> CastBallot:
    election = db.query(Election).filter(Election.id == election_id).first()
    if not election:
        raise NotFoundError("Élection introuvable")

    if election.status != ElectionStatus.OPEN:
        raise ValidationError("L'élection n'est pas ouverte au vote")

    starts_at = election.starts_at.replace(tzinfo=timezone.utc) if election.starts_at and election.starts_at.tzinfo is None else election.starts_at
    ends_at = election.ends_at.replace(tzinfo=timezone.utc) if election.ends_at and election.ends_at.tzinfo is None else election.ends_at
    now = datetime.now(timezone.utc)
    if starts_at and now < starts_at:
        raise ValidationError("L'élection n'est pas dans sa période active")
    if ends_at and now > ends_at:
        raise ValidationError("L'élection n'est pas dans sa période active")

    if user.class_id is None or user.class_id != election.class_id:
        raise ForbiddenError("Vous n'êtes pas autorisé à voter pour cette élection")

    if candidate_id is not None:
        candidate = (
            db.query(Candidate)
            .filter(Candidate.id == candidate_id, Candidate.election_id == election_id)
            .first()
        )
        if not candidate:
            raise ValidationError("Candidat invalide pour cette élection")

    existing = (
        db.query(VoterRecord)
        .filter(VoterRecord.election_id == election_id, VoterRecord.student_id == user.id)
        .first()
    )
    if existing:
        raise ConflictError("Vous avez déjà voté pour cette élection")

    nonce = secrets.token_hex(16)
    # Le bulletin est validé en base D'ABORD. L'ancrage on-chain (jusqu'à 90 s
    # d'attente d'un bloc, et irréversible) se fait ensuite, hors requête, par
    # anchoring_service : une panne ou une lenteur du RPC ne bloque plus un vote
    # et ne laisse plus de hachage sans bulletin.
    vote_hash = compute_vote_hash(str(user.id), str(election_id), str(candidate_id), nonce)

    # Transaction atomique : la participation et le bulletin, ensemble ou rien.
    # Le bulletin part CHIFFRÉ dans l'urne, pas dans `votes` : écrit en clair
    # dans la même transaction que la participation, il en partageait le
    # `xmin` PostgreSQL, et une jointure sur cette colonne désignait son
    # auteur. Le brassage (ballot_box.mix) le versera plus tard dans `votes`.
    try:
        with db.begin_nested():
            db.add(VoterRecord(election_id=election_id, student_id=user.id))
            ballot_box.deposit(
                db, election_id=election_id, candidate_id=candidate_id, vote_hash=vote_hash
            )

        db.commit()
    except IntegrityError as exc:
        # Deux requêtes simultanées du même électeur : le contrôle `existing`
        # plus haut peut passer deux fois, seule la contrainte unique arbitre.
        # Sans ce filet, le second vote sortait en 500 au lieu d'un 409 clair.
        db.rollback()
        logger.warning(
            "vote refusé pour user=%s election=%s : %s", user.id, election_id, exc.orig
        )
        raise ConflictError("Vous avez déjà voté pour cette élection")

    # Audit (best-effort — on ne trace que le fait de voter, rien qui identifie le bulletin)
    audit_service.record(
        db,
        action=AuditAction.VOTE_CAST,
        actor_id=user.id,
        target_type="election",
        target_id=election_id,
        # Ni hachage, ni fragment de hachage : le journal désigne l'acteur, et
        # le hachage désigne un bulletin — les réunir dans une ligne relierait
        # l'électeur à son choix.
        details=None,
    )
    return CastBallot(id=uuid4(), election_id=election_id, vote_hash=vote_hash)


def has_voted(db: Session, *, user: Student, election_id: UUID) -> bool:
    return (
        db.query(VoterRecord)
        .filter(VoterRecord.election_id == election_id, VoterRecord.student_id == user.id)
        .first()
        is not None
    )


def list_for_user(db: Session, user: Student) -> list[dict]:
    """Retourne la liste des participations de l'étudiant de manière anonymisée.

    Les informations confidentielles (choix de candidat, hash de vote réel) ne
    sont pas exposées ici pour empêcher la dé-anonymisation a posteriori via l'API.
    """
    records = (
        db.query(VoterRecord)
        .filter(VoterRecord.student_id == user.id)
        .order_by(VoterRecord.created_at.desc())
        .all()
    )
    # On renvoie des dictionnaires compatibles avec le schéma de réponse VoteReceipt
    return [
        {
            "id": r.id,
            "election_id": r.election_id,
            "vote_hash": "anonymisé",
            "tx_hash": None,
            "block_number": None,
            "created_at": r.created_at,
        }
        for r in records
    ]


def verify_vote_by_hash(db: Session, *, vote_hash: str) -> VoteVerification:
    vote = db.query(Vote).filter(Vote.vote_hash == vote_hash).first()
    if not vote:
        pending = ballot_box.find_pending(db, vote_hash)
        if pending:
            election = db.query(Election).filter(Election.id == pending.election_id).first()
            return VoteVerification(
                valid=True,
                vote_hash=vote_hash,
                election_title=election.title if election else None,
                anchored=False,
                message="Bulletin enregistré. Il rejoindra le décompte au plus tard à la clôture du scrutin.",
            )
        return VoteVerification(
            valid=False, vote_hash=vote_hash, message="Aucun vote trouvé pour ce hash"
        )
    return VoteVerification(
        valid=True,
        vote_hash=vote_hash,
        election_title=vote.election.title if vote.election else None,
        anchored=vote.tx_hash is not None,
        tx_hash=vote.tx_hash,
        block_number=vote.block_number,
        message="Vote authentique et enregistré",
    )
