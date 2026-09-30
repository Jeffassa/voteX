from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditAction(str, PyEnum):
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    PASSWORD_RESET_CONFIRMED = "password_reset_confirmed"

    ELECTION_CREATED = "election_created"
    ELECTION_UPDATED = "election_updated"
    ELECTION_DELETED = "election_deleted"
    ELECTION_OPENED = "election_opened"
    ELECTION_CLOSED = "election_closed"

    CANDIDATE_CREATED = "candidate_created"
    CANDIDATE_DELETED = "candidate_deleted"

    STUDENT_CREATED = "student_created"
    STUDENT_UPDATED = "student_updated"
    STUDENT_DELETED = "student_deleted"
    STUDENT_ROLE_CHANGED = "student_role_changed"

    CLASS_CREATED = "class_created"
    CLASS_UPDATED = "class_updated"
    CLASS_DELETED = "class_deleted"

    VOTE_CAST = "vote_cast"


class AuditEvent(Base):
    """Trace des actions sensibles. Append-only — jamais update/delete."""

    __tablename__ = "audit_events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
