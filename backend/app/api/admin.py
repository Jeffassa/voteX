from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models import ClassRoom, Election, Student, Vote
from app.models.election import ElectionStatus
from app.schemas.audit import AuditEventOut
from app.schemas.student import StudentOut
from app.services import audit_service
from app.services.resend_email_service import send_account_activated_email


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
    _: Annotated[Student, Depends(require_admin)],
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

    # Envoi de l'email asynchrone si une adresse email est renseignée
    if student.email:
        background.add_task(
            send_account_activated_email,
            to_email=student.email,
            student_name=f"{student.first_name} {student.last_name}"
        )

    return {"detail": f"Étudiant {student.matricule} activé avec succès."}
