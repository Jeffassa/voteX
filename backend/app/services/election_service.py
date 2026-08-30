import logging
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.cache import (
    cache_delete,
    cache_delete_pattern,
    cache_get,
    cache_set,
    key_election_list_class,
    key_election_results,
)
from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Candidate, Election, Student, Vote, VoterRecord
from app.models.election import ElectionStatus
from app.models.student import UserRole
from app.models.audit import AuditAction
from app.schemas.election import CandidateResult, ElectionCreate, ElectionResults, ElectionUpdate
from app.services import audit_service, blockchain


logger = logging.getLogger(__name__)


def list_for_user(db: Session, user: Student) -> list[Election]:
    q = db.query(Election)
    if user.role == UserRole.STUDENT and user.class_id is not None:
        q = q.filter(Election.class_id == user.class_id)
    return q.order_by(Election.starts_at.desc()).all()


def list_all(db: Session) -> list[Election]:
    """Sans filtre — pour les admins."""
    return db.query(Election).order_by(Election.starts_at.desc()).all()


def get_active_for_user(db: Session, user: Student) -> Election | None:
    if user.class_id is None:
        return None
    return (
        db.query(Election)
        .filter(
            Election.class_id == user.class_id,
            Election.status == ElectionStatus.OPEN,
        )
        .order_by(Election.starts_at.desc())
        .first()
    )


def get_or_404(db: Session, election_id: UUID) -> Election:
    election = db.query(Election).filter(Election.id == election_id).first()
    if not election:
        raise NotFoundError("Élection introuvable")
    return election


def can_access(user: Student, election: Election) -> bool:
    """Un étudiant ne voit que les élections de SA classe.

    Les admins voient tout. Sans cette barrière, n'importe quel compte
    authentifié pouvait lire le détail et les résultats en direct de
    n'importe quelle classe en devinant/collectant un UUID d'élection.
    """
    if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return True
    return user.class_id is not None and user.class_id == election.class_id


def get_for_user(db: Session, election_id: UUID, user: Student) -> Election:
    """Comme get_or_404, mais renvoie « introuvable » si l'accès est refusé.

    On ne distingue pas 403 et 404 volontairement : confirmer l'existence
    d'une élection d'une autre classe est déjà une fuite.
    """
    election = get_or_404(db, election_id)
    if not can_access(user, election):
        raise NotFoundError("Élection introuvable")
    return election


def create(db: Session, payload: ElectionCreate, *, actor_id: UUID | None = None) -> Election:
    if payload.ends_at <= payload.starts_at:
        raise ValidationError("La date de fin doit être après la date de début")
    election = Election(**payload.model_dump())
    db.add(election)
    db.commit()
    db.refresh(election)

    audit_service.record(
        db,
        action=AuditAction.ELECTION_CREATED,
        actor_id=actor_id,
        target_type="election",
        target_id=election.id,
        details=f"title={election.title!r}",
    )
    return election


def update(db: Session, election_id: UUID, payload: ElectionUpdate) -> Election:
    election = get_or_404(db, election_id)
    if election.status != ElectionStatus.DRAFT:
        raise ValidationError(
            "Seules les élections en brouillon peuvent être modifiées"
        )

    data = payload.model_dump(exclude_unset=True)
    starts = data.get("starts_at", election.starts_at)
    ends = data.get("ends_at", election.ends_at)
    if ends <= starts:
        raise ValidationError("La date de fin doit être après la date de début")

    for field, value in data.items():
        setattr(election, field, value)

    db.commit()
    db.refresh(election)
    return election


def delete(db: Session, election_id: UUID) -> None:
    election = get_or_404(db, election_id)
    if election.status not in (ElectionStatus.DRAFT, ElectionStatus.CLOSED):
        raise ConflictError(
            "Impossible de supprimer une élection ouverte. Clôturez-la d'abord."
        )
    has_votes = (
        db.query(Vote).filter(Vote.election_id == election_id).first() is not None
    )
    if has_votes:
        raise ConflictError(
            "Impossible de supprimer une élection avec des votes enregistrés"
        )
    db.delete(election)
    db.commit()
    # Invalide le cache des résultats et de la liste pour cette élection
    cache_delete(key_election_results(str(election_id)))
    if election.class_id:
        cache_delete(key_election_list_class(str(election.class_id)))


def set_status(db: Session, election_id: UUID, status: ElectionStatus) -> Election:
    """Met à jour le statut + propage sur la blockchain (best-effort).

    Quand on passe à OPEN, on crée l'élection on-chain si pas encore fait,
    puis on l'ouvre. Quand on passe à CLOSED, on la clôture on-chain.
    """
    election = get_or_404(db, election_id)
    previous = election.status
    election.status = status

    if status == ElectionStatus.OPEN and previous != ElectionStatus.OPEN:
        if election.blockchain_id is None:
            blockchain_id = blockchain.create_election_on_chain(
                title=election.title,
                starts_at_ts=int(election.starts_at.timestamp()),
                ends_at_ts=int(election.ends_at.timestamp()),
            )
            if blockchain_id is not None:
                election.blockchain_id = blockchain_id
                logger.info(
                    "election %s mapped to blockchain id %s", election.id, blockchain_id
                )
        if election.blockchain_id is not None:
            blockchain.open_election_on_chain(election.blockchain_id)

    elif status == ElectionStatus.CLOSED and election.blockchain_id is not None:
        blockchain.close_election_on_chain(election.blockchain_id)

    db.commit()
    db.refresh(election)

    # Invalide le cache à chaque changement de statut (ouverture, clôture, publication)
    cache_delete(key_election_results(str(election_id)))
    if election.class_id:
        cache_delete(key_election_list_class(str(election.class_id)))

    if previous != status:
        audit_action = (
            AuditAction.ELECTION_OPENED if status == ElectionStatus.OPEN
            else AuditAction.ELECTION_CLOSED if status == ElectionStatus.CLOSED
            else AuditAction.ELECTION_UPDATED
        )
        audit_service.record(
            db,
            action=audit_action,
            target_type="election",
            target_id=election.id,
            details=f"{previous.value} → {status.value}",
        )
    return election


def compute_results(db: Session, election_id: UUID) -> ElectionResults:
    """Calcule les résultats d'une élection avec mise en cache Redis.

    - Cache-Hit  : retour immédiat depuis Redis (<1 ms, 0 requête SQL).
    - Cache-Miss : calcul complet en SQL puis stockage en cache.
    - Les résultats des élections OUVERTES sont cachés 30 secondes (données vivantes).
    - Les résultats des élections FERMÉES/PUBLIÉES sont cachés CACHE_TTL_SECONDS (5 min par défaut).
    """
    cache_key = key_election_results(str(election_id))

    # ── Cache-Hit ──────────────────────────────────────────────────────────────
    cached = cache_get(cache_key)
    if cached is not None:
        logger.debug("Cache HIT pour les résultats de l'élection %s", election_id)
        return ElectionResults(**cached)

    # ── Cache-Miss : calcul SQL complet ───────────────────────────────────────
    logger.debug("Cache MISS pour les résultats de l'élection %s", election_id)
    election = get_or_404(db, election_id)

    total_eligible = (
        db.query(func.count(Student.id))
        .filter(Student.class_id == election.class_id, Student.is_active.is_(True))
        .scalar()
        or 0
    )
    total_votes = (
        db.query(func.count(Vote.id)).filter(Vote.election_id == election_id).scalar() or 0
    )

    blank_votes = (
        db.query(func.count(Vote.id))
        .filter(Vote.election_id == election_id, Vote.candidate_id == None)
        .scalar() or 0
    )

    rows = (
        db.query(
            Candidate.id,
            Candidate.student_id,
            Candidate.photo_url,
            Student.first_name,
            Student.last_name,
            func.count(Vote.id).label("vote_count"),
        )
        .join(Student, Student.id == Candidate.student_id)
        .outerjoin(Vote, Vote.candidate_id == Candidate.id)
        .filter(Candidate.election_id == election_id)
        .group_by(Candidate.id, Student.id)
        .all()
    )

    candidates = [
        CandidateResult(
            candidate_id=r.id,
            student_id=r.student_id,
            full_name=f"{r.first_name} {r.last_name}",
            photo_url=r.photo_url,
            votes=r.vote_count,
            percentage=round((r.vote_count / total_votes * 100) if total_votes else 0, 2),
        )
        for r in rows
    ]
    candidates.sort(key=lambda c: c.votes, reverse=True)

    result = ElectionResults(
        election_id=election_id,
        total_eligible=total_eligible,
        total_votes=total_votes,
        blank_votes=blank_votes,
        participation_rate=round(
            (total_votes / total_eligible * 100) if total_eligible else 0, 2
        ),
        candidates=candidates,
    )

    # ── Mise en cache ──────────────────────────────────────────────────────────
    # Elections ouvertes : TTL court (30s) car les votes arrivent en temps réel.
    # Elections fermées ou publiées : TTL long (CACHE_TTL_SECONDS = 5 min par défaut).
    ttl = 30 if election.status == ElectionStatus.OPEN else settings.CACHE_TTL_SECONDS
    cache_set(cache_key, result.model_dump(), ttl=ttl)

    return result


def list_candidates(db: Session, election_id: UUID) -> list[Candidate]:
    return (
        db.query(Candidate)
        .options(joinedload(Candidate.student))
        .filter(Candidate.election_id == election_id)
        .order_by(Candidate.created_at.asc())
        .all()
    )


def list_non_voters(db: Session, election_id: UUID) -> list[Student]:
    """Retourne les étudiants de la classe de l'élection qui n'ont pas encore voté."""
    election = get_or_404(db, election_id)

    # Sous-requête : IDs des étudiants qui ont déjà voté dans cette élection.
    # La participation vit dans VoterRecord — Vote est anonyme et ne porte
    # AUCUN lien vers l'électeur (c'est tout l'intérêt du découplage).
    voted_subq = (
        db.query(VoterRecord.student_id)
        .filter(VoterRecord.election_id == election_id)
        .subquery()
    )

    return (
        db.query(Student)
        .filter(
            Student.class_id == election.class_id,
            Student.is_active.is_(True),
            Student.role == UserRole.STUDENT,
            ~Student.id.in_(voted_subq),
        )
        .order_by(Student.last_name, Student.first_name)
        .all()
    )
