"""Logique métier des étudiants — CRUD admin + self-update."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models import Student, Vote
from app.models.student import UserRole
from app.schemas.student import StudentSelfUpdate, StudentUpdate


def get_or_404(db: Session, student_id: UUID) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise NotFoundError("Étudiant introuvable")
    return student


def update(db: Session, student_id: UUID, payload: StudentUpdate) -> Student:
    student = get_or_404(db, student_id)
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        existing = db.query(Student).filter(
            Student.email == data["email"], Student.id != student_id
        ).first()
        if existing:
            raise ConflictError("Email déjà utilisé par un autre compte")

    for field, value in data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return student


def delete(db: Session, student_id: UUID, *, current_user_id: UUID) -> None:
    student = get_or_404(db, student_id)
    if student.id == current_user_id:
        raise ForbiddenError("Vous ne pouvez pas supprimer votre propre compte")

    has_votes = db.query(Vote).filter(Vote.student_id == student_id).first() is not None
    if has_votes:
        # Soft-delete : on désactive plutôt que supprimer pour préserver l'intégrité du vote
        student.is_active = False
        db.commit()
        return

    db.delete(student)
    db.commit()


def set_role(db: Session, student_id: UUID, role: UserRole, *, current_user_id: UUID) -> Student:
    student = get_or_404(db, student_id)
    if student.id == current_user_id and role != student.role:
        raise ForbiddenError("Vous ne pouvez pas modifier votre propre rôle")
    student.role = role
    db.commit()
    db.refresh(student)
    return student


def update_self(db: Session, *, user: Student, payload: StudentSelfUpdate) -> Student:
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        existing = db.query(Student).filter(
            Student.email == data["email"], Student.id != user.id
        ).first()
        if existing:
            raise ConflictError("Email déjà utilisé par un autre compte")

    if "matricule" in data:
        existing = db.query(Student).filter(
            Student.matricule == data["matricule"], Student.id != user.id
        ).first()
        if existing:
            raise ConflictError("Matricule déjà utilisé par un autre compte")

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
