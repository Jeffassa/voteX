from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models import Election, Student
from app.schemas.vote import VoteReceipt, VoteRequest, VoteVerification
from app.services import anchoring_service, ballot_box, email_service, vote_service


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

    election = db.query(Election).filter(Election.id == payload.election_id).first()
    voted_at = datetime.now(timezone.utc)

    # Le reçu n'énonce JAMAIS le choix : ni dans la réponse, ni dans l'e-mail.
    # Une boîte mail est lisible par le fournisseur, un tiers ou quelqu'un qui
    # contraint l'électeur — y écrire le candidat, c'est fabriquer une preuve de
    # vote transférable.
    background_tasks.add_task(
        email_service.send_vote_receipt_email,
        to_email=user.email,
        voter_name=f"{user.first_name} {user.last_name}",
        election_title=election.title if election else "Élection",
        vote_hash=vote.vote_hash,
        tx_hash=vote.tx_hash,
        block_number=vote.block_number,
        created_at=voted_at,
    )

    # Brassage de l'urne (s'il y a assez de bulletins), puis ancrage de ce qui
    # a été versé, sans attendre le prochain balayage.
    background_tasks.add_task(ballot_box.mix_in_background, payload.election_id)
    background_tasks.add_task(anchoring_service.sweep)

    return VoteReceipt(
        id=vote.id,
        election_id=vote.election_id,
        vote_hash=vote.vote_hash,
        tx_hash=vote.tx_hash,
        block_number=vote.block_number,
        created_at=voted_at,
    )


@router.get("/me", response_model=list[VoteReceipt])
def my_votes(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Student, Depends(get_current_user)],
):
    return vote_service.list_for_user(db, user)


@router.get("/verify/{vote_hash}", response_model=VoteVerification)
@limiter.limit("30/minute")
def verify(
    request: Request,
    vote_hash: Annotated[str, Path(pattern=r"^0x[a-fA-F0-9]{64}$")],
    db: Annotated[Session, Depends(get_db)],
):
    return vote_service.verify_vote_by_hash(db, vote_hash=vote_hash)
