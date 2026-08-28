from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ClassCreate(BaseModel):
    name: str
    level: str
    field: str


class ClassUpdate(BaseModel):
    name: str | None = None
    level: str | None = None
    field: str | None = None


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    level: str
    field: str
    created_at: datetime
