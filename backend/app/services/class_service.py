"""Classes : création, modification, suppression.

Une classe porte des électeurs et des élections. On ne la supprime que vide :
sinon des étudiants perdraient leur classe, et une élection son corps électoral.
"""

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import ClassRoom, Election, Student
from app.models.audit import AuditAction
from app.schemas.class_ import ClassCreate, ClassUpdate
from app.services import audit_service

# Longueurs des colonnes (models/class_.py) : au-delà, Postgres refuse l'écriture
# et l'administrateur recevait une erreur 500 au lieu d'un message.
_LIMITS = {"name": ("Le nom", 50), "level": ("Le niveau", 20), "field": ("La filière", 100)}


def get_or_404(db: Session, class_id: UUID) -> ClassRoom:
    classroom = db.get(ClassRoom, class_id)
    if classroom is None:
        raise NotFoundError("Classe introuvable")
    return classroom


def _clean(field: str, value: str) -> str:
    label, limit = _LIMITS[field]
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValidationError(f"{label} ne peut pas être vide")
    if len(cleaned) > limit:
        raise ValidationError(f"{label} ne peut pas dépasser {limit} caractères")
    return cleaned


def _ensure_unique(db: Session, level: str, name: str, *, exclude: UUID | None = None) -> None:
    q = db.query(ClassRoom).filter(
        func.lower(ClassRoom.level) == level.lower(),
        func.lower(ClassRoom.name) == name.lower(),
    )
    if exclude is not None:
        q = q.filter(ClassRoom.id != exclude)
    if q.first() is not None:
        raise ConflictError(f"La classe {level} {name} existe déjà")


def _label(classroom: ClassRoom) -> str:
    return f"{classroom.level} {classroom.name}"


def create(db: Session, payload: ClassCreate, *, actor_id: UUID | None) -> ClassRoom:
    data = {k: _clean(k, v) for k, v in payload.model_dump().items()}
    _ensure_unique(db, data["level"], data["name"])
    classroom = ClassRoom(**data)
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    audit_service.record(
        db,
        action=AuditAction.CLASS_CREATED,
        actor_id=actor_id,
        target_type="class",
        target_id=classroom.id,
        details=_label(classroom),
    )
    return classroom


def update(db: Session, class_id: UUID, payload: ClassUpdate, *, actor_id: UUID | None) -> ClassRoom:
    classroom = get_or_404(db, class_id)
    data = {k: _clean(k, v) for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        return classroom
    before = _label(classroom)
    _ensure_unique(db, data.get("level", classroom.level), data.get("name", classroom.name), exclude=classroom.id)
    for key, value in data.items():
        setattr(classroom, key, value)
    db.commit()
    db.refresh(classroom)
    after = _label(classroom)
    audit_service.record(
        db,
        action=AuditAction.CLASS_UPDATED,
        actor_id=actor_id,
        target_type="class",
        target_id=classroom.id,
        details=after if after == before else f"{before} → {after}",
    )
    return classroom


def delete(db: Session, class_id: UUID, *, actor_id: UUID | None) -> None:
    classroom = get_or_404(db, class_id)
    students = db.query(func.count(Student.id)).filter(Student.class_id == classroom.id).scalar() or 0
    elections = db.query(func.count(Election.id)).filter(Election.class_id == classroom.id).scalar() or 0
    if students or elections:
        parts = []
        if students:
            parts.append(f"{students} étudiant{'s' if students > 1 else ''}")
        if elections:
            parts.append(f"{elections} élection{'s' if elections > 1 else ''}")
        raise ConflictError(
            f"La classe {_label(classroom)} compte encore {' et '.join(parts)} : "
            "réaffectez-les ou supprimez-les avant de supprimer la classe."
        )
    label = _label(classroom)
    db.delete(classroom)
    db.commit()
    audit_service.record(
        db,
        action=AuditAction.CLASS_DELETED,
        actor_id=actor_id,
        target_type="class",
        target_id=class_id,
        details=label,
    )
