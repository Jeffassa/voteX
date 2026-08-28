from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_super_admin
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.models import Student
from app.models.student import UserRole
from app.schemas.student import (
    MeResponse,
    StudentOut,
    StudentRoleUpdate,
    StudentSelfUpdate,
    StudentUpdate,
)
from app.schemas.student_import import ImportReport
from app.services import student_import_service, student_service


router = APIRouter()


@router.get("/", response_model=list[StudentOut])
def list_students(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
    class_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=200, le=500),
):
    q = db.query(Student)
    if class_id is not None:
        q = q.filter(Student.class_id == class_id)
    if search:
        like = f"%{search.lower()}%"
        q = q.filter(
            or_(
                Student.matricule.ilike(like),
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                Student.email.ilike(like),
            )
        )
    return q.order_by(Student.last_name, Student.first_name).limit(limit).all()


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return student_service.get_or_404(db, student_id)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: UUID,
    payload: StudentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return student_service.update(db, student_id, payload)


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    student_service.delete(db, student_id, current_user_id=current.id)


@router.post("/{student_id}/role", response_model=StudentOut)
def change_role(
    student_id: UUID,
    payload: StudentRoleUpdate,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_super_admin)],
):
    """Promouvoir / rétrograder un user — réservé au super_admin."""
    return student_service.set_role(
        db, student_id, UserRole(payload.role), current_user_id=current.id
    )


@router.patch("/me/profile", response_model=MeResponse)
def update_my_profile(
    payload: StudentSelfUpdate,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(get_current_user)],
):
    """Modification du profil par l'étudiant lui-même."""
    return student_service.update_self(db, user=current, payload=payload)


@router.post("/import", response_model=ImportReport)
async def import_students_from_xlsx(
    file: Annotated[UploadFile, File(description="Fichier .xlsx ESATIC (multi-feuilles)")],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
    dry_run: bool = Query(default=False),
    auto_create_classes: bool = Query(
        default=False,
        description="Si true, crée automatiquement les classes manquantes avec default_level",
    ),
    default_level: str | None = Query(
        default=None,
        description="Niveau à utiliser pour les classes auto-créées (ex: L1, L2, L3, M1, M2)",
    ),
):
    """Importe les étudiants depuis un fichier Excel ESATIC.

    Si auto_create_classes=True et default_level est fourni, les classes
    inexistantes sont créées à la volée (utile quand on importe un fichier
    complet niveau par niveau).
    """
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise ValidationError("Format de fichier non supporté. Utilise un .xlsx.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise ValidationError("Fichier trop gros (> 10 Mo)")

    if auto_create_classes and not default_level:
        raise ValidationError(
            "default_level requis quand auto_create_classes=true (ex: L1, L2, M1...)"
        )

    return await student_import_service.import_students(
        db,
        file_bytes=contents,
        dry_run=dry_run,
        auto_create_classes=auto_create_classes,
        default_level=default_level,
    )
