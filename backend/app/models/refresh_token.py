from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RefreshToken(Base):
    """Refresh token persisté côté serveur (rotation + revocation list).

    Le token raw est envoyé au client en cookie httpOnly. Seul le hash SHA-256
    est stocké en DB — si la base est compromise, les refresh tokens ne sont
    pas utilisables tels quels.

    `jti` est le claim JWT ID, utile pour les logs sans révéler le token.
    `revoked_at` non-null = token révoqué (soit par usage normal de la rotation,
    soit par logout explicite, soit par détection de reuse).
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    # Pour traçabilité (debug, détection de session suspecte)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Lifecycle
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Lien vers le token suivant après rotation — permet d'auditer la chaîne
    # de rotation et de détecter un reuse (si le token suivant est utilisé
    # ET le token précédent revient → vol).
    replaced_by_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user = relationship("Student")
