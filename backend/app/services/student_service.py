"""Logique métier des étudiants — CRUD admin + self-update."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import verify_password
from app.models import Student, VoterRecord
from app.models.audit import AuditAction
from app.models.student import UserRole
from app.schemas.student import StudentSelfUpdate, StudentUpdate
from app.services import audit_service, email_change_service


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

    # Retirer ou rendre un compte fait partir, ou annule, le délai de
    # conservation (voir retention_service).
    if "is_active" in data and data["is_active"] != student.is_active:
        student.deactivated_at = None if data["is_active"] else datetime.now(timezone.utc)

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
        # Point de départ des 12 mois de conservation (retention_service).
        student.deactivated_at = datetime.now(timezone.utc)
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


def update_self(
    db: Session,
    *,
    user: Student,
    payload: StudentSelfUpdate,
    background_tasks: BackgroundTasks | None = None,
) -> Student:
    data = payload.model_dump(exclude_unset=True, mode="json")
    current_password = data.pop("current_password", None)
    new_email = data.pop("email", None)

    # L'adresse n'est jamais écrite directement : elle part en attente de
    # confirmation, et seulement sur présentation du mot de passe actuel.
    if new_email and (not user.email or new_email.strip().lower() != user.email.lower()):
        if not current_password or not user.password_hash or not verify_password(
            current_password, user.password_hash
        ):
            raise UnauthorizedError("Saisissez votre mot de passe actuel pour changer d'adresse e-mail.")
        email_change_service.request_change(
            db, user=user, new_email=new_email, background_tasks=background_tasks
        )

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
