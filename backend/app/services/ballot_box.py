"""Urne chiffrée et brassage des bulletins.

Le problème
-----------
Un bulletin et la participation de son auteur doivent être enregistrés
ensemble, dans une seule transaction : sinon une panne entre les deux
compterait un électeur sans son bulletin, ou l'inverse. Mais PostgreSQL marque
chaque ligne de l'identifiant de la transaction qui l'a écrite (`xmin`). Tant
que le bulletin était inséré en clair dans `votes` à côté de la ligne de
`voter_records`, n'importe quel accès en lecture à la base — le rôle de
l'application, une injection SQL, un administrateur de la base — reliait
chaque bulletin à son électeur par une jointure sur `xmin`. L'ordre physique
des lignes trahissait la même chose.

La réponse
----------
1. Au vote, le bulletin part CHIFFRÉ dans `sealed_ballots`, dans la même
   transaction que la participation. Le lien `xmin` existe toujours, mais il
   désigne un contenu illisible sans la clé, qui ne vit pas dans la base.
2. Le brassage déchiffre ensuite un lot de bulletins tirés au hasard, les
   insère dans `votes` dans un ordre mélangé, et les retire de l'urne — dans
   une autre transaction, qui marque tout le lot du même `xmin`.
3. Tant que le scrutin est ouvert, l'urne garde toujours POOL_SIZE bulletins,
   eux aussi tirés au hasard : un lot ne correspond donc jamais à une tranche
   de l'ordre des votes. À la clôture, elle est vidée entièrement.

Les scores n'étant publiés qu'à la clôture, les bulletins encore dans l'urne
ne manquent à aucun résultat visible.

La clé est dérivée de JWT_SECRET (HKDF). Ne pas changer ce secret pendant un
scrutin ouvert : les bulletins encore dans l'urne deviendraient illisibles.
"""

import base64
import json
import logging
import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Election, SealedBallot, Vote
from app.models.election import ElectionStatus

logger = logging.getLogger(__name__)

# Bulletins toujours gardés dans l'urne tant que le scrutin est ouvert.
POOL_SIZE = 5
# Brassage dès que l'urne en contient au moins le double : chaque lot mêle
# alors au moins POOL_SIZE bulletins.
MIX_THRESHOLD = 2 * POOL_SIZE

_AAD = b"smartvote-ballot-v1"
_random = secrets.SystemRandom()


@lru_cache(maxsize=4)
def _derive(secret: str) -> AESGCM:
    key = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=None, info=b"smartvote ballot seal v1"
    ).derive(secret.encode())
    return AESGCM(key)


def _cipher() -> AESGCM:
    return _derive(settings.JWT_SECRET)


def seal(candidate_id: UUID | None, vote_hash: str) -> str:
    nonce = os.urandom(12)
    plain = json.dumps({"c": str(candidate_id) if candidate_id else None, "h": vote_hash}).encode()
    return base64.b64encode(nonce + _cipher().encrypt(nonce, plain, _AAD)).decode()


def unseal(sealed: str) -> tuple[UUID | None, str]:
    raw = base64.b64decode(sealed)
    data = json.loads(_cipher().decrypt(raw[:12], raw[12:], _AAD))
    return (UUID(data["c"]) if data["c"] else None), data["h"]


def deposit(db: Session, *, election_id: UUID, candidate_id: UUID | None, vote_hash: str) -> None:
    """Dépose le bulletin chiffré. Pas de commit : la participation l'accompagne."""
    db.add(SealedBallot(election_id=election_id, sealed=seal(candidate_id, vote_hash)))


def pending_count(db: Session, election_id: UUID | None = None) -> int:
    q = db.query(func.count(SealedBallot.id))
    if election_id is not None:
        q = q.filter(SealedBallot.election_id == election_id)
    return q.scalar() or 0


def cast_count(db: Session, election_id: UUID | None = None) -> int:
    """Bulletins déposés : ceux déjà brassés plus ceux encore dans l'urne."""
    q = db.query(func.count(Vote.id))
    if election_id is not None:
        q = q.filter(Vote.election_id == election_id)
    return (q.scalar() or 0) + pending_count(db, election_id)


def mix(db: Session, election_id: UUID, *, final: bool = False) -> int:
    """Brasse l'urne d'une élection. Retourne le nombre de bulletins versés.

    `final` vide l'urne entièrement (clôture) ; sinon POOL_SIZE bulletins,
    tirés au hasard, y restent.
    """
    ballots = (
        db.query(SealedBallot)
        .filter(SealedBallot.election_id == election_id)
        # Deux brassages simultanés (plusieurs workers) ne prennent pas les
        # mêmes bulletins ; ignoré par SQLite.
        .with_for_update(skip_locked=True)
        .all()
    )
    if not ballots or (not final and len(ballots) < MIX_THRESHOLD):
        db.rollback()
        return 0

    _random.shuffle(ballots)
    batch = ballots if final else ballots[POOL_SIZE:]
    for ballot in batch:
        candidate_id, vote_hash = unseal(ballot.sealed)
        db.add(Vote(election_id=election_id, candidate_id=candidate_id, vote_hash=vote_hash))
    db.query(SealedBallot).filter(SealedBallot.id.in_([b.id for b in batch])).delete(
        synchronize_session=False
    )
    db.commit()
    logger.info("urne: %s bulletin(s) brassé(s) pour l'élection %s", len(batch), election_id)
    return len(batch)


@dataclass(frozen=True)
class PendingBallot:
    election_id: UUID
    vote_hash: str


def find_pending(db: Session, vote_hash: str) -> PendingBallot | None:
    """Retrouve un bulletin encore dans l'urne (vérification d'un reçu)."""
    for ballot in db.query(SealedBallot).all():
        try:
            _, h = unseal(ballot.sealed)
        except Exception:  # clé changée : illisible, on ne s'arrête pas pour autant
            continue
        if secrets.compare_digest(h, vote_hash):
            return PendingBallot(election_id=ballot.election_id, vote_hash=h)
    return None


def sweep() -> int:
    """Brasse toutes les urnes qui le permettent (appelé hors requête).

    Un scrutin clos ou publié est vidé entièrement : filet de sécurité si un
    bulletin est arrivé pendant la clôture.
    """
    db = SessionLocal()
    try:
        total = 0
        rows = (
            db.query(SealedBallot.election_id, Election.status)
            .join(Election, Election.id == SealedBallot.election_id)
            .distinct()
            .all()
        )
        for election_id, status in rows:
            final = status in (ElectionStatus.CLOSED, ElectionStatus.PUBLISHED)
            total += mix(db, election_id, final=final)
        return total
    finally:
        db.close()


def mix_in_background(election_id: UUID) -> None:
    """Brassage après un vote, avec sa propre session."""
    db = SessionLocal()
    try:
        mix(db, election_id)
    except Exception:
        logger.exception("urne: brassage en échec pour l'élection %s", election_id)
    finally:
        db.close()
