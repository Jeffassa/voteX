"""Audit trail des actions sensibles.

Best-effort : si une écriture audit échoue, on log mais on ne fait pas planter
l'action métier. La traçabilité est une feature de monitoring, pas une dépendance bloquante.
"""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import AuditAction, AuditEvent


logger = logging.getLogger(__name__)


def record(
    db: Session,
    *,
    action: AuditAction,
    actor_id: UUID | None = None,
    target_type: str | None = None,
    target_id: Any = None,
    details: str | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        event = AuditEvent(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            details=details,
            ip_address=ip_address,
        )
        db.add(event)
        db.commit()
    except Exception as exc:
        logger.warning("audit: failed to record %s: %s", action.value, exc)
        db.rollback()


def list_recent(db: Session, *, limit: int = 100) -> list[AuditEvent]:
    return (
        db.query(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .all()
    )
