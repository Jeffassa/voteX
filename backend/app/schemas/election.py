from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ElectionCreate(BaseModel):
    title: str
    description: str | None = None
    class_id: UUID
    starts_at: datetime
    ends_at: datetime


class ElectionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    class_id: UUID | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class ElectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    class_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    blockchain_id: int | None
    created_at: datetime


class ElectionResults(BaseModel):
    election_id: UUID
    total_eligible: int
    total_votes: int
    blank_votes: int = 0
    participation_rate: float
    candidates: list["CandidateResult"]


class CandidateResult(BaseModel):
    candidate_id: UUID
    student_id: UUID
    full_name: str
    photo_url: str | None
    votes: int
    percentage: float


ElectionResults.model_rebuild()


class NonVoterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    first_name: str
    last_name: str
    photo_url: str | None = None
    is_activated: bool = False
