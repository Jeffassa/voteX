from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models import ClassRoom, Student
from app.schemas.class_ import ClassCreate, ClassOut


router = APIRouter()


@router.get("/", response_model=list[ClassOut])
def list_classes(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(get_current_user)],
):
    return db.query(ClassRoom).order_by(ClassRoom.level, ClassRoom.name).all()


@router.get("/{class_id}", response_model=ClassOut)
def get_class(
    class_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(get_current_user)],
):
    classroom = db.query(ClassRoom).filter(ClassRoom.id == class_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    return classroom


@router.post("/", response_model=ClassOut, status_code=201)
def create_class(
    payload: ClassCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    classroom = ClassRoom(**payload.model_dump())
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom
