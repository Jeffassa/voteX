from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, Uuid, func
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
    # Tentatives d'ancrage on-chain déjà faites. Sert à ne pas rejouer sans fin
    # un bulletin que le contrat refuse (voir anchoring_service).
    anchor_attempts: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")

    # Pas de `created_at` ici, volontairement : PostgreSQL fige now() au début de
    # la transaction, donc VoterRecord et Vote portaient la MÊME heure à la
    # microseconde près — de quoi recoller chaque bulletin à son auteur par une
    # simple jointure sur l'horodatage. Le moment du vote vit dans
    # `voter_records`, jamais à côté du choix.

    election = relationship("Election", back_populates="votes")
    candidate = relationship("Candidate", back_populates="votes")


class SealedBallot(Base):
    """Bulletin chiffré, déposé dans l'urne en attendant le brassage.

    Il est écrit dans la même transaction que la participation (`VoterRecord`),
    ce qui garantit qu'aucun électeur n'est compté sans son bulletin, ni
    l'inverse. Mais PostgreSQL marque chaque ligne de l'identifiant de la
    transaction qui l'a écrite (colonne système `xmin`) : un bulletin écrit en
    clair à côté de la participation restait relié à son auteur par une simple
    jointure. Ici, le choix et le hachage sont chiffrés ; `ballot_box` les
    déchiffre plus tard, par lots tirés au hasard, dans une autre transaction.

    Aucune date, aucun ordre : rien ne doit permettre de suivre un bulletin
    de l'urne jusqu'à la table `votes`.
    """

    __tablename__ = "sealed_ballots"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    election_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("elections.id"), nullable=False, index=True
    )
    sealed: Mapped[str] = mapped_column(Text, nullable=False)
