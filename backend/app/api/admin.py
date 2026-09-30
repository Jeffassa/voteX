from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models import ClassRoom, Election, Student, Vote
from app.models.election import ElectionStatus
from app.models.audit import AuditAction
from app.schemas.audit import AuditEventOut
from app.schemas.student import StudentOut
from app.services import audit_service
from app.services.email_service import send_account_activated_email


router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    active = db.query(func.count(Election.id)).filter(Election.status == ElectionStatus.OPEN).scalar() or 0
    total_votes = db.query(func.count(Vote.id)).scalar() or 0
    total_students = db.query(func.count(Student.id)).scalar() or 0
    total_classes = db.query(func.count(ClassRoom.id)).scalar() or 0

    participation_by_class = (
        db.query(ClassRoom.name, ClassRoom.level, func.count(Vote.id))
        .outerjoin(Election, Election.class_id == ClassRoom.id)
        .outerjoin(Vote, Vote.election_id == Election.id)
        .group_by(ClassRoom.id)
        .all()
    )

    return {
        "active_elections": active,
        "total_votes": total_votes,
        "total_students": total_students,
        "total_classes": total_classes,
        "participation_by_class": [
            {"class": f"{level} {name}", "votes": count}
            for name, level, count in participation_by_class
        ],
    }


@router.get("/audit", response_model=list[AuditEventOut])
def audit_log(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
    limit: int = Query(default=100, le=500),
):
    return audit_service.list_recent(db, limit=limit)


@router.get("/pending-students", response_model=list[StudentOut])
def list_pending_students(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    """Retourne la liste des étudiants en attente d'activation."""
    return db.query(Student).filter(Student.is_active == False).order_by(Student.created_at.desc()).all()


@router.patch("/activate-student/{student_id}")
def activate_student(
    student_id: UUID,
    background: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    """Active le compte d'un étudiant et lui envoie un email de notification."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Étudiant introuvable")
    
    if student.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le compte de cet étudiant est déjà activé")

    student.is_active = True
    db.commit()
    db.refresh(student)

    # L'activation fait entrer un électeur dans le corps électoral : c'est une
    # décision qui doit être attribuable à un administrateur nommé.
    audit_service.record(
        db,
        action=AuditAction.STUDENT_UPDATED,
        actor_id=current.id,
        target_type="student",
        target_id=student.id,
        details=f"compte activé (matricule={student.matricule})",
    )

    # Envoi de l'email asynchrone si une adresse email est renseignée
    if student.email:
        background.add_task(
            send_account_activated_email,
            to_email=student.email,
            student_name=f"{student.first_name} {student.last_name}",
        )

    return {"detail": f"Étudiant {student.matricule} activé avec succès."}


@router.patch("/reject-claim/{student_id}")
def reject_claim(
    student_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    """Rejette une revendication et **libère** le compte.

    Sans cette action, le durcissement de l'inscription se contenterait de
    déplacer le problème : le premier venu ne peut plus se connecter avec le
    compte d'un camarade, mais sa tentative laisse le compte marqué « déjà
    activé » — l'étudiant légitime, lui, ne peut plus le revendiquer. Un vol
    devient un blocage, ce qui n'est pas un progrès en période de campagne.

    Rejeter remet donc le compte dans l'état où l'import l'avait laissé :
    revendicable, sans mot de passe, sans adresse choisie par le demandeur.
    L'étudiant légitime peut recommencer — et repassera par cette même salle
    d'attente, où l'administrateur tranchera sur pièce (carte d'étudiant).

    Le même traitement s'applique à une auto-inscription sur un matricule
    inconnu : la ligne n'est pas supprimée — on ne détruit pas une donnée dont
    on n'est pas certain qu'elle soit illégitime — mais elle redevient inerte,
    sans mot de passe et sans identité confirmée.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Étudiant introuvable")

    if student.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce compte n'est pas en attente : il n'y a rien à rejeter.",
        )

    matricule = student.matricule
    student.password_hash = None
    student.activation_code = None
    # Toute session ou lien de réinitialisation émis pour cette revendication
    # cesse d'être valable.
    student.password_version += 1
    # L'adresse présente ne peut venir que du demandeur : un compte dont
    # l'école connaissait l'adresse n'atterrit pas en salle d'attente.
    if not student.identity_verified:
        student.email = None
    student.failed_login_count = 0
    student.locked_until = None
    student.is_active = True

    db.commit()

    # Refuser une revendication est une décision qui engage : elle doit être
    # attribuable, au même titre que l'activation.
    audit_service.record(
        db,
        action=AuditAction.STUDENT_UPDATED,
        actor_id=current.id,
        target_type="student",
        target_id=student.id,
        details=f"revendication rejetée, compte libéré (matricule={matricule})",
    )

    return {"detail": f"Revendication rejetée. Le compte {matricule} est de nouveau revendicable."}
