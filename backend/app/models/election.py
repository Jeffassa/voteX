from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ElectionStatus(str, PyEnum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    PUBLISHED = "published"


class Election(Base):
    __tablename__ = "elections"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    class_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("classes.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ElectionStatus] = mapped_column(
        Enum(ElectionStatus), default=ElectionStatus.DRAFT, nullable=False
    )
    blockchain_id: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classroom = relationship("ClassRoom", back_populates="elections")
    candidates = relationship("Candidate", back_populates="election", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="election")
    voter_records = relationship("VoterRecord", back_populates="election")
