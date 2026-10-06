"""Logique métier des étudiants — CRUD admin + self-update."""

import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import verify_password
from app.models import Student, VoterRecord
from app.models.audit import AuditAction
from app.models.student import UserRole
from app.schemas.student import StudentCreate, StudentSelfUpdate, StudentUpdate
from app.services import audit_service, email_change_service


def get_or_404(db: Session, student_id: UUID) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise NotFoundError("Étudiant introuvable")
    return student


_ADMIN_ROLES = (UserRole.ADMIN, UserRole.SUPER_ADMIN)


def ensure_can_manage(actor: Student | None, target: Student) -> None:
    """Un administrateur ne gère que des comptes étudiants.

    Sans cette règle, un simple admin réécrivait l'adresse d'un super-admin,
    demandait un lien de réinitialisation reçu dans sa propre boîte, et
    prenait le compte : une élévation de privilèges que POST /role, réservé au
    super-admin, était censé interdire. `actor` absent : appel interne.
    """
    if actor is None or actor.id == target.id or actor.role == UserRole.SUPER_ADMIN:
        return
    if target.role in _ADMIN_ROLES:
        raise ForbiddenError("Seul un super-administrateur peut modifier un compte administrateur.")


def create(
    db: Session,
    payload: StudentCreate,
    *,
    actor: Student,
    background_tasks: BackgroundTasks | None = None,
) -> Student:
    """Crée un compte à activer, exactement comme une ligne du fichier d'import."""
    if db.query(Student).filter(Student.matricule == payload.matricule).first():
        raise ConflictError("Ce matricule existe déjà.")
    email = email_change_service.normalize(payload.email) if payload.email else None
    if email:
        email_change_service.ensure_available(db, email, user_id=None)

    student = Student(
        matricule=payload.matricule,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email,
        class_id=payload.class_id,
        role=UserRole.STUDENT,
        is_active=True,
        activation_code=secrets.token_hex(3).upper(),
        # Même règle que l'import : une adresse donnée par l'école vaut preuve.
        identity_verified=bool(email),
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    audit_service.record(
        db,
        action=AuditAction.STUDENT_CREATED,
        actor_id=actor.id,
        target_type="student",
        target_id=student.id,
        details=f"création manuelle matricule={student.matricule}",
    )
    if email and background_tasks is not None:
        from app.services import email_service

        background_tasks.add_task(
            email_service.send_activation_code_email,
            to_email=email,
            voter_name=f"{student.first_name} {student.last_name}",
            activation_code=student.activation_code,
        )
    return student


def update(
    db: Session,
    student_id: UUID,
    payload: StudentUpdate,
    *,
    actor_id: UUID | None = None,
    actor: Student | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> Student:
    student = get_or_404(db, student_id)
    ensure_can_manage(actor, student)
    actor_id = actor.id if actor is not None else actor_id
    data = payload.model_dump(exclude_unset=True, mode="json")

    # L'adresse ouvre le compte (Google, réinitialisation du mot de passe).
    # Sur un compte activé, l'administrateur ne l'écrit donc pas lui-même : elle
    # part en attente, et seul le titulaire de la nouvelle boîte la confirme.
    # Sinon, n'importe quel admin mettait son Gmail sur le compte d'un électeur
    # qui n'avait pas encore voté, se connectait par Google et votait à sa place.
    new_email = data.pop("email", None)
    email_pending = False
    if new_email:
        new_email = email_change_service.normalize(new_email)
        if student.is_activated:
            email_pending = email_change_service.request_change(
                db, user=student, new_email=new_email, background_tasks=background_tasks
            )
        elif new_email != (student.email or ""):
            # Compte pas encore activé : l'administration corrige la liste
            # électorale. Le code d'activation partira vers cette adresse.
            email_change_service.ensure_available(db, new_email, user_id=student.id)
            student.email = new_email
            student.pending_email = None
            student.identity_verified = True
            data["email"] = new_email

    # Retirer ou rendre un compte fait partir, ou annule, le délai de
    # conservation (voir retention_service).
    if "is_active" in data and data["is_active"] != student.is_active:
        student.deactivated_at = None if data["is_active"] else datetime.now(timezone.utc)

    for field, value in data.items():
        if field != "email":
            setattr(student, field, value)

    db.commit()
    db.refresh(student)

    audit_service.record(
        db,
        action=AuditAction.STUDENT_UPDATED,
        actor_id=actor_id,
        target_type="student",
        target_id=student.id,
        details=f"champs={sorted(data)}"
        + (" ; nouvelle adresse en attente de confirmation" if email_pending else ""),
    )
    return student


def delete(db: Session, student_id: UUID, *, current_user_id: UUID) -> None:
    student = get_or_404(db, student_id)
    if student.id == current_user_id:
        raise ForbiddenError("Vous ne pouvez pas supprimer votre propre compte")
    ensure_can_manage(db.get(Student, current_user_id), student)

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
