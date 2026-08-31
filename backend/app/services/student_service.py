"""Logique métier des étudiants — CRUD admin + self-update."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models import Student, VoterRecord
from app.models.audit import AuditAction
from app.models.student import UserRole
from app.schemas.student import StudentSelfUpdate, StudentUpdate
from app.services import audit_service


def get_or_404(db: Session, student_id: UUID) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise NotFoundError("Étudiant introuvable")
    return student


def update(
    db: Session, student_id: UUID, payload: StudentUpdate, *, actor_id: UUID | None = None
) -> Student:
    student = get_or_404(db, student_id)
    data = payload.model_dump(exclude_unset=True, mode="json")

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

    audit_service.record(
        db,
        action=AuditAction.STUDENT_UPDATED,
        actor_id=actor_id,
        target_type="student",
        target_id=student.id,
        details=f"champs={sorted(data)}",
    )
    return student


def delete(db: Session, student_id: UUID, *, current_user_id: UUID) -> None:
    student = get_or_404(db, student_id)
    if student.id == current_user_id:
        raise ForbiddenError("Vous ne pouvez pas supprimer votre propre compte")

    # La participation se lit dans VoterRecord : `Vote` a perdu tout lien vers
    # l'électeur avec l'anonymisation du bulletin. La requête d'origine visait
    # `Vote.student_id`, qui n'existe plus — elle levait une AttributeError, et
    # le garde-fou qu'elle portait ne protégeait donc plus rien.
    has_participated = (
        db.query(VoterRecord).filter(VoterRecord.student_id == student_id).first() is not None
    )
    matricule = student.matricule
    if has_participated:
        # Désactivation plutôt que suppression : effacer l'électeur ferait
        # disparaître la preuve de participation et fausserait le quorum.
        student.is_active = False
        db.commit()
        audit_service.record(
            db,
            action=AuditAction.STUDENT_UPDATED,
            actor_id=current_user_id,
            target_type="student",
            target_id=student_id,
            details=f"désactivé (a participé à un scrutin) matricule={matricule}",
        )
        return

    db.delete(student)
    db.commit()
    audit_service.record(
        db,
        action=AuditAction.STUDENT_DELETED,
        actor_id=current_user_id,
        target_type="student",
        target_id=student_id,
        details=f"matricule={matricule}",
    )


def set_role(db: Session, student_id: UUID, role: UserRole, *, current_user_id: UUID) -> Student:
    student = get_or_404(db, student_id)
    if student.id == current_user_id and role != student.role:
        raise ForbiddenError("Vous ne pouvez pas modifier votre propre rôle")
    previous = student.role
    student.role = role
    db.commit()
    db.refresh(student)

    # Une promotion est l'action la plus sensible du système : sans trace, un
    # compte admin obtenu puis rétrogradé ne laisse aucune empreinte.
    audit_service.record(
        db,
        action=AuditAction.STUDENT_ROLE_CHANGED,
        actor_id=current_user_id,
        target_type="student",
        target_id=student.id,
        details=f"{previous.value} → {role.value} (matricule={student.matricule})",
    )
    return student


def update_self(db: Session, *, user: Student, payload: StudentSelfUpdate) -> Student:
    data = payload.model_dump(exclude_unset=True, mode="json")

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
