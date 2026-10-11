"""Ancrage on-chain des bulletins, hors du chemin de la requête.

Pourquoi ce module existe
-------------------------
Le vote attendait le reçu de la transaction (jusqu'à 90 s) dans un endpoint
synchrone : un jour de scrutin, quelques dizaines de votes simultanés
épuisaient le pool de threads. Pire, la transaction partait AVANT la validation
en base : un doublon détecté ensuite laissait un hachage sur la chaîne sans
bulletin correspondant — et une chaîne ne s'efface pas.

Le bulletin est maintenant validé en base d'abord (tx_hash vide = « en attente
d'ancrage »), puis ce module l'ancre. Une panne du RPC ne perd plus rien : les
bulletins en attente sont rejoués par le balayage périodique.

Concurrence : plusieurs workers uvicorn peuvent balayer en même temps ; un
verrou consultatif PostgreSQL réserve le lot à un seul, ce qui garantit aussi
une seule source de nonces pour le compte Ethereum.
"""

import logging
import threading
from uuid import UUID

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.metrics import ANCHOR_PENDING, ANCHORED_TOTAL
from app.models import Election, Vote
from app.services import blockchain


logger = logging.getLogger(__name__)

BATCH_SIZE = 25
# Au-delà, le contrat refuse ou la chaîne est durablement hors d'atteinte :
# on cesse d'insister et on laisse la métrique alerter un humain.
MAX_ATTEMPTS = 20

# Clé arbitraire mais stable du verrou consultatif PostgreSQL.
_ADVISORY_LOCK_KEY = 0x534D5654  # "SMVT"
# Exclusion au sein du processus (seule protection sous SQLite : tests, dev).
_process_lock = threading.Lock()


def chain_configured() -> bool:
    return bool(
        settings.WEB3_RPC_URL and settings.CONTRACT_ADDRESS and settings.ADMIN_PRIVATE_KEY
    )


def _pending_query(db: Session, election_id: UUID | None):
    q = (
        db.query(Vote)
        .join(Election, Election.id == Vote.election_id)
        .filter(
            Vote.tx_hash.is_(None),
            Vote.anchor_attempts < MAX_ATTEMPTS,
            Election.blockchain_id.is_not(None),
        )
    )
    if election_id is not None:
        q = q.filter(Vote.election_id == election_id)
    return q


def count_pending(db: Session) -> int:
    return _pending_query(db, None).count()


def anchor_pending(db: Session, *, election_id: UUID | None = None) -> int:
    """Ancre un lot de bulletins en attente. Retourne le nombre ancré.

    Retourne 0 sans rien faire si un autre travailleur tient déjà le verrou.
    """
    if not chain_configured() or not _process_lock.acquire(blocking=False):
        return 0
    try:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            got = db.execute(
                text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": _ADVISORY_LOCK_KEY}
            ).scalar()
            if not got:
                db.rollback()
                return 0

        # Ordre aléatoire : l'ordre d'ancrage sur la chaîne ne doit pas
        # reproduire l'ordre dans lequel les électeurs ont voté.
        votes = (
            _pending_query(db, election_id)
            .order_by(func.random())
            .limit(BATCH_SIZE)
            .all()
        )
        if not votes:
            db.rollback()
            return 0

        chain_ids = {
            e.id: e.blockchain_id
            for e in db.query(Election).filter(Election.id.in_({v.election_id for v in votes}))
        }
        outcomes = blockchain.submit_votes(
            [(v.vote_hash, chain_ids[v.election_id]) for v in votes]
        )

        anchored = 0
        for vote, outcome in zip(votes, outcomes):
            if outcome.ok:
                vote.tx_hash = outcome.tx_hash
                vote.block_number = outcome.block_number
                anchored += 1
                ANCHORED_TOTAL.labels(outcome="anchored").inc()
            elif not outcome.retryable:
                vote.anchor_attempts = MAX_ATTEMPTS
                ANCHORED_TOTAL.labels(outcome="rejected").inc()
                logger.error("ancrage refusé par le contrat pour le bulletin %s", vote.id)
            else:
                vote.anchor_attempts += 1
                ANCHORED_TOTAL.labels(outcome="retry").inc()
        db.commit()  # libère aussi le verrou consultatif
        return anchored
    except Exception:
        db.rollback()
        logger.exception("ancrage: échec du lot")
        return 0
    finally:
        _process_lock.release()


def flush_election(db: Session, election_id: UUID, *, max_rounds: int = 40) -> None:
    """Ancre tout ce qui attend pour une élection (avant sa clôture on-chain).

    Une fois `closeElection` passée, le contrat refuse tout nouveau bulletin :
    il faut donc vider la file avant.
    """
    for _ in range(max_rounds):
        if _pending_query(db, election_id).count() == 0:
            return
        if anchor_pending(db, election_id=election_id) == 0:
            logger.warning(
                "clôture : des bulletins n'ont pas pu être ancrés (élection %s)", election_id
            )
            return


def sweep() -> int:
    """Un tour de balayage avec sa propre session (appelé hors requête)."""
    if not chain_configured():
        return 0
    db = SessionLocal()
    try:
        total = 0
        while True:
            n = anchor_pending(db)
            total += n
            if n == 0:
                break
        ANCHOR_PENDING.set(count_pending(db))
        return total
    finally:
        db.close()
