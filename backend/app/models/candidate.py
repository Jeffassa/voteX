from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        UniqueConstraint("election_id", "student_id", name="uq_candidate_election_student"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    election_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("elections.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("students.id"), nullable=False)
    slogan: Mapped[str | None] = mapped_column(String(200), nullable=True)
    program: Mapped[str | None] = mapped_column(Text, nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blockchain_id: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    election = relationship("Election", back_populates="candidates")
    student = relationship("Student", back_populates="candidacies")
    votes = relationship("Vote", back_populates="candidate")
