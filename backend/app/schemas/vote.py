from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VoteRequest(BaseModel):
    election_id: UUID
    candidate_id: UUID | None = None


class VoteReceipt(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    election_id: UUID
    candidate_id: UUID | None
    vote_hash: str
    tx_hash: str | None
    block_number: int | None
    created_at: datetime


class VoteVerification(BaseModel):
    valid: bool
    vote_hash: str
    election_title: str | None = None
    created_at: datetime | None = None
    block_number: int | None = None
    message: str
