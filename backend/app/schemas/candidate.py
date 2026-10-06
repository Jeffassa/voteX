from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.photos import check_photo_url
from app.schemas.student import StudentBrief


class CandidateCreate(BaseModel):
    election_id: UUID
    student_id: UUID
    slogan: str | None = None
    program: str | None = Field(default=None, max_length=5000)
    biography: str | None = Field(default=None, max_length=5000)
    photo_url: str | None = Field(default=None, max_length=500)

    @field_validator("photo_url")
    @classmethod
    def _photo(cls, v: str | None) -> str | None:
        return check_photo_url(v)


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
