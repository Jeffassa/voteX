from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models import Student
from app.schemas.candidate import CandidateCreate, CandidateOut
from app.services import candidate_service, election_service


router = APIRouter()


@router.get("/election/{election_id}", response_model=list[CandidateOut])
def list_candidates(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
):
    election_service.get_for_user(db, election_id, user)  # garde d'accès
    return election_service.list_candidates(db, election_id)


@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(
    candidate_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(get_current_user)],
):
    return candidate_service.get_or_404(db, candidate_id)


@router.post("/", response_model=CandidateOut, status_code=201)
def create_candidate(
    payload: CandidateCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return candidate_service.create(db, payload)


@router.delete("/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    candidate_service.delete(db, candidate_id)
