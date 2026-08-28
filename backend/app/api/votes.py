from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Candidate, Election, Student
from app.schemas.vote import VoteReceipt, VoteRequest, VoteVerification
from app.services import email_service, vote_service


router = APIRouter()


@router.post("/", response_model=VoteReceipt, status_code=201)
@limiter.limit(settings.RATE_LIMIT_VOTE)
def cast(
    request: Request,
    payload: VoteRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    vote = vote_service.cast_vote(
        db, user=user, election_id=payload.election_id, candidate_id=payload.candidate_id
    )

    # Récupérer les données nécessaires AVANT de quitter le contexte de session
    # (sinon Lazy load → DetachedInstanceError dans le background task)
    election = db.query(Election).filter(Election.id == payload.election_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == payload.candidate_id).first()
    candidate_student = (
        db.query(Student).filter(Student.id == candidate.student_id).first()
        if candidate
        else None
    )

    background_tasks.add_task(
        email_service.send_vote_receipt_email,
        to_email=user.email,
        voter_name=f"{user.first_name} {user.last_name}",
        election_title=election.title if election else "—",
        candidate_name=(
            f"{candidate_student.first_name} {candidate_student.last_name}"
            if candidate_student
            else None
        ),
        vote_hash=vote.vote_hash,
        tx_hash=vote.tx_hash,
        block_number=vote.block_number,
        created_at=vote.created_at,
    )

    return vote


@router.get("/me", response_model=list[VoteReceipt])
def my_votes(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
):
    return vote_service.list_for_user(db, user)


@router.get("/verify/{vote_hash}", response_model=VoteVerification)
@limiter.limit("10/minute")
def verify(
    request: Request,
    vote_hash: Annotated[str, Path(pattern=r"^0x[a-fA-F0-9]{64}$")],
    db: Annotated[Session, Depends(get_db)],
):
    return vote_service.verify_vote_by_hash(db, vote_hash=vote_hash)
