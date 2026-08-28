from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import Candidate, Election, Student
from app.schemas.candidate import CandidateCreate


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


def create(db: Session, payload: CandidateCreate) -> Candidate:
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
    return candidate


def delete(db: Session, candidate_id: UUID) -> None:
    candidate = get_or_404(db, candidate_id)
    db.delete(candidate)
    db.commit()
