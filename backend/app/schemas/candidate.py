from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.student import StudentBrief


class CandidateCreate(BaseModel):
    election_id: UUID
    student_id: UUID
    slogan: str | None = None
    program: str | None = None
    biography: str | None = None
    photo_url: str | None = None


class CandidateOut(BaseModel):
    """Vue enrichie : inclut les infos publiques de l'étudiant candidat."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    election_id: UUID
    student: StudentBrief
    slogan: str | None
    program: str | None
    biography: str | None
    photo_url: str | None
    blockchain_id: int | None
    created_at: datetime
