from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models import Student
from app.models.election import ElectionStatus
from app.schemas.election import ElectionCreate, ElectionOut, ElectionResults, ElectionUpdate, NonVoterOut
from app.services import election_service


router = APIRouter()


@router.get("/", response_model=list[ElectionOut])
def list_elections(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
):
    return election_service.list_for_user(db, user)


@router.get("/active", response_model=ElectionOut | None)
def get_active(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
    response: Response,
):
    election = election_service.get_active_for_user(db, user)
    if not election:
        response.status_code = 204
        return None
    return election


@router.get("/{election_id}", response_model=ElectionOut)
def get_election(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(get_current_user)],
):
    return election_service.get_or_404(db, election_id)


@router.post("/", response_model=ElectionOut, status_code=201)
def create_election(
    payload: ElectionCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return election_service.create(db, payload)


@router.patch("/{election_id}", response_model=ElectionOut)
def update_election(
    election_id: UUID,
    payload: ElectionUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return election_service.update(db, election_id, payload)


@router.delete("/{election_id}", status_code=204)
def delete_election(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    election_service.delete(db, election_id)


@router.post("/{election_id}/open", response_model=ElectionOut)
def open_election(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return election_service.set_status(db, election_id, ElectionStatus.OPEN)


@router.post("/{election_id}/close", response_model=ElectionOut)
def close_election(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    return election_service.set_status(db, election_id, ElectionStatus.CLOSED)


@router.get("/{election_id}/results", response_model=ElectionResults)
def get_results(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(get_current_user)],
):
    return election_service.compute_results(db, election_id)


@router.get("/{election_id}/non-voters", response_model=list[NonVoterOut])
def list_non_voters(
    election_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[Student, Depends(require_admin)],
):
    """Liste les étudiants de la classe qui n'ont pas encore voté."""
    return election_service.list_non_voters(db, election_id)

