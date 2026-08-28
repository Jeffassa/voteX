from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    details: str | None
    ip_address: str | None
    created_at: datetime
