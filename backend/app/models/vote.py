from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VoterRecord(Base):
    __tablename__ = "voter_records"
    __table_args__ = (
        UniqueConstraint("election_id", "student_id", name="uq_voter_record_one_per_election"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    election_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("elections.id"), nullable=False, index=True
    )
    student_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    election = relationship("Election", back_populates="voter_records")
    student = relationship("Student", back_populates="voter_records")


class Vote(Base):
    __tablename__ = "votes"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    election_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("elections.id"), nullable=False, index=True
    )
    candidate_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("candidates.id"), nullable=True, index=True
    )

    vote_hash: Mapped[str] = mapped_column(String(66), unique=True, nullable=False, index=True)
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    block_number: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    election = relationship("Election", back_populates="votes")
    candidate = relationship("Candidate", back_populates="votes")
