from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, PyEnum):
    STUDENT = "student"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class Gender(str, PyEnum):
    MALE = "M"
    FEMALE = "F"
    OTHER = "X"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    matricule: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Email peut être nul pour les comptes pré-importés sans email connu
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    activation_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # password_hash IS NULL = compte importé en attente d'activation (inscription)
    # password_hash IS NOT NULL = compte activé
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # L'identité a-t-elle été confirmée par un canal que l'ÉCOLE contrôle ?
    #
    # Vrai uniquement si l'adresse e-mail vient du fichier d'import, ou si le
    # code d'activation a été envoyé à une adresse déjà connue de la base. Faux
    # quand l'adresse a été fournie par le demandeur lui-même : dans ce cas le
    # code ne prouve rien, puisque c'est lui qui a choisi la boîte de réception.
    #
    # Matricule et nom ne sont PAS des secrets — ils figurent sur toute liste
    # d'appel. Sans ce drapeau, les revendiquer suffisait à prendre un compte.
    identity_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Défense contre les essais répétés, portée par le COMPTE et non par
    # l'adresse IP : dans une salle informatique, tous les étudiants partagent
    # la même IP publique et une limite par IP les punirait collectivement.
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    class_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("classes.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classroom = relationship("ClassRoom", back_populates="students")
    voter_records = relationship("VoterRecord", back_populates="student")
    candidacies = relationship("Candidate", back_populates="student")

    @property
    def is_activated(self) -> bool:
        return self.password_hash is not None
