from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Candidate, Election, Student
from app.models.audit import AuditAction
from app.schemas.candidate import CandidateCreate
from app.services import audit_service


def get_or_404(db: Session, candidate_id: UUID) -> Candidate:
    candidate = (
        db.query(Candidate)
        .options(joinedload(Candidate.student))
        .filter(Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise NotFoundError("Candidat introuvable")
    return candidate


def create(db: Session, payload: CandidateCreate, *, actor_id: UUID | None = None) -> Candidate:
    election = db.query(Election).filter(Election.id == payload.election_id).first()
    if not election:
        raise NotFoundError("Élection introuvable")

    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise NotFoundError("Étudiant introuvable")
    if student.class_id != election.class_id:
        raise ValidationError("L'étudiant n'appartient pas à la classe de l'élection")

    existing = (
        db.query(Candidate)
        .filter(
            Candidate.election_id == payload.election_id,
            Candidate.student_id == payload.student_id,
        )
        .first()
    )
    if existing:
        raise ConflictError("Cet étudiant est déjà candidat à cette élection")

    candidate = Candidate(**payload.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    audit_service.record(
        db,
        action=AuditAction.CANDIDATE_CREATED,
        actor_id=actor_id,
        target_type="candidate",
        target_id=candidate.id,
        details=f"election={payload.election_id} student={payload.student_id}",
    )
    return candidate


def delete(db: Session, candidate_id: UUID, *, actor_id: UUID | None = None) -> None:
    candidate = get_or_404(db, candidate_id)
    election_id = candidate.election_id
    student_id = candidate.student_id
    db.delete(candidate)
    db.commit()

    # Retirer un candidat d'un scrutin change son issue : la trace doit dire qui.
    audit_service.record(
        db,
        action=AuditAction.CANDIDATE_DELETED,
        actor_id=actor_id,
        target_type="candidate",
        target_id=candidate_id,
        details=f"election={election_id} student={student_id}",
    )
