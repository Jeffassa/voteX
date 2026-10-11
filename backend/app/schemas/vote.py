from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VoteRequest(BaseModel):
    election_id: UUID
    candidate_id: UUID | None = None
    # Jeton aléatoire tiré par le navigateur avant l'envoi, renvoyé tel quel
    # s'il doit réessayer : un vote dont la réponse s'est perdue rend alors
    # le même reçu au lieu de « déjà voté ». Jamais stocké (vote_service).
    receipt_key: str | None = Field(default=None, min_length=22, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class VoteReceipt(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    election_id: UUID
    vote_hash: str
    tx_hash: str | None
    block_number: int | None
    created_at: datetime


class VoteVerification(BaseModel):
    valid: bool
    vote_hash: str
    election_title: str | None = None
    # Faux tant que le bulletin attend son ancrage sur la chaîne.
    anchored: bool = False
    tx_hash: str | None = None
    block_number: int | None = None
    message: str
