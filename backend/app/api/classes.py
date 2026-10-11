from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models import ClassRoom, Student
from app.schemas.class_ import ClassCreate, ClassOut, ClassUpdate
from app.services import class_service


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
    return class_service.get_or_404(db, class_id)


@router.post("/", response_model=ClassOut, status_code=201)
def create_class(
    payload: ClassCreate,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    return class_service.create(db, payload, actor_id=current.id)


# Modification et suppression : l'interface les proposait depuis le début,
# mais les routes manquaient (405 Method Not Allowed).
@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: UUID,
    payload: ClassUpdate,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    return class_service.update(db, class_id, payload, actor_id=current.id)


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[Student, Depends(require_admin)],
):
    class_service.delete(db, class_id, actor_id=current.id)
