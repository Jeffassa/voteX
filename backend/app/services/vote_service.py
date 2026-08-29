import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models import Candidate, Election, Student, Vote, VoterRecord
from app.models.election import ElectionStatus
from app.models.audit import AuditAction
from app.schemas.vote import VoteVerification
from app.services import audit_service
from app.services.blockchain import compute_vote_hash, record_vote_on_chain


def cast_vote(db: Session, *, user: Student, election_id: UUID, candidate_id: UUID | None = None) -> Vote:
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
    vote_hash = compute_vote_hash(str(user.id), str(election_id), str(candidate_id), nonce)
    chain = record_vote_on_chain(vote_hash, election.blockchain_id)

    # Transaction atomique : VoterRecord + Vote créés ensemble ou rien du tout
    with db.begin_nested():
        # 1. Enregistre la participation (découplée de l'opinion exprimée)
        voter_record = VoterRecord(
            election_id=election_id,
            student_id=user.id,
        )
        db.add(voter_record)

        # 2. Enregistre le bulletin anonyme
        vote = Vote(
            election_id=election_id,
            candidate_id=candidate_id,
            vote_hash=vote_hash,
            tx_hash=chain.get("tx_hash"),
            block_number=chain.get("block_number"),
        )
        db.add(vote)

    db.commit()
    db.refresh(vote)

    # Audit (best-effort, ne révèle PAS le candidat — on ne trace que le fait du vote)
    audit_service.record(
        db,
        action=AuditAction.VOTE_CAST,
        actor_id=user.id,
        target_type="election",
        target_id=election_id,
        details=f"vote_hash={vote_hash[:8]}…",
    )
    return vote


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
            "candidate_id": None,
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
        return VoteVerification(
            valid=False, vote_hash=vote_hash, message="Aucun vote trouvé pour ce hash"
        )
    return VoteVerification(
        valid=True,
        vote_hash=vote_hash,
        election_title=vote.election.title if vote.election else None,
        created_at=vote.created_at,
        block_number=vote.block_number,
        message="Vote authentique et enregistré",
    )
