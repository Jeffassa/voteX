"""Bridge entre FastAPI et le smart contract SmartVote.

Toutes les fonctions sont *best-effort* : si la blockchain n'est pas configurée
(pas de RPC, pas de contrat déployé, pas de clé privée), on retourne un
placeholder et on laisse la base de données comme source de vérité. Ça permet
de développer en local sans Hardhat tournant et de dégrader proprement en prod
si le RPC tombe.
"""

import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Any

from web3 import Web3

from app.core.config import settings


logger = logging.getLogger(__name__)

_ABI_PATH = (
    Path(__file__).parent.parent.parent.parent
    / "contracts"
    / "artifacts"
    / "contracts"
    / "SmartVote.sol"
    / "SmartVote.json"
)


def _w3() -> Web3 | None:
    if not settings.WEB3_RPC_URL:
        return None
    try:
        w3 = Web3(Web3.HTTPProvider(settings.WEB3_RPC_URL))
        return w3 if w3.is_connected() else None
    except Exception as exc:
        logger.warning("blockchain: cannot connect to RPC: %s", exc)
        return None


def _contract():
    w3 = _w3()
    if not w3 or not settings.CONTRACT_ADDRESS or not _ABI_PATH.exists():
        return None, None
    try:
        abi = json.loads(_ABI_PATH.read_text())["abi"]
        return w3, w3.eth.contract(address=settings.CONTRACT_ADDRESS, abi=abi)
    except Exception as exc:
        logger.warning("blockchain: cannot load contract: %s", exc)
        return None, None


# Un compte Ethereum ne tolère qu'UN flux de transactions à la fois : deux envois
# qui lisent le même `nonce` en parallèle se disputent la même place, et l'un
# des deux est rejeté. Ce verrou sérialise les envois au sein du processus ;
# entre processus, c'est le verrou consultatif de la base (anchoring_service)
# qui réserve l'ancrage des bulletins à un seul travailleur à la fois.
_send_lock = threading.Lock()
_GAS_LIMIT = 300_000


def _build_and_send(w3: Web3, fn, nonce: int) -> Any:
    account = w3.eth.account.from_key(settings.ADMIN_PRIVATE_KEY)
    tx = fn.build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "gas": _GAS_LIMIT,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = account.sign_transaction(tx)
    return w3.eth.send_raw_transaction(signed.raw_transaction)


def _signed_tx(w3: Web3, fn) -> dict[str, Any]:
    with _send_lock:
        account = w3.eth.account.from_key(settings.ADMIN_PRIVATE_KEY)
        # "pending" : compte aussi les transactions déjà émises mais pas encore
        # minées, sans quoi deux envois rapprochés reprennent le même nonce.
        nonce = w3.eth.get_transaction_count(account.address, "pending")
        tx_hash = _build_and_send(w3, fn, nonce)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=90)
    return {"tx_hash": tx_hash.hex(), "block_number": receipt.blockNumber, "receipt": receipt}


def is_available() -> bool:
    w3, contract = _contract()
    return bool(w3 and contract and settings.ADMIN_PRIVATE_KEY)


def compute_vote_hash(student_id: str, election_id: str, candidate_id: str, nonce: str) -> str:
    payload = f"{student_id}|{election_id}|{candidate_id}|{nonce}".encode()
    return "0x" + hashlib.sha256(payload).hexdigest()


def create_election_on_chain(title: str, starts_at_ts: int, ends_at_ts: int) -> int | None:
    """Crée l'élection on-chain. Retourne le blockchain_id (uint256), ou None
    si la chain n'est pas configurée."""
    w3, contract = _contract()
    if not w3 or not contract or not settings.ADMIN_PRIVATE_KEY:
        logger.info("blockchain: createElection skipped (chain unavailable)")
        return None
    try:
        before = contract.functions.nextElectionId().call()
        _signed_tx(w3, contract.functions.createElection(title, starts_at_ts, ends_at_ts))
        return int(before)
    except Exception as exc:
        logger.warning("blockchain: createElection failed: %s", exc)
        return None


def open_election_on_chain(blockchain_id: int) -> bool:
    w3, contract = _contract()
    if not w3 or not contract or not settings.ADMIN_PRIVATE_KEY or blockchain_id is None:
        return False
    try:
        _signed_tx(w3, contract.functions.openElection(blockchain_id))
        return True
    except Exception as exc:
        logger.warning("blockchain: openElection failed: %s", exc)
        return False


def close_election_on_chain(blockchain_id: int) -> bool:
    w3, contract = _contract()
    if not w3 or not contract or not settings.ADMIN_PRIVATE_KEY or blockchain_id is None:
        return False
    try:
        _signed_tx(w3, contract.functions.closeElection(blockchain_id))
        return True
    except Exception as exc:
        logger.warning("blockchain: closeElection failed: %s", exc)
        return False


class AnchorOutcome:
    """Issue de l'ancrage d'un hachage.

    `retryable` distingue la panne passagère (RPC injoignable, nonce en retard)
    du refus définitif du contrat (transaction annulée : élection hors période
    ou déjà close) — qu'il serait vain de rejouer indéfiniment.
    """

    __slots__ = ("tx_hash", "block_number", "retryable")

    def __init__(self, tx_hash: str | None = None, block_number: int | None = None,
                 retryable: bool = True):
        self.tx_hash = tx_hash
        self.block_number = block_number
        self.retryable = retryable

    @property
    def ok(self) -> bool:
        return self.tx_hash is not None


def submit_votes(items: list[tuple[str, int]]) -> list[AnchorOutcome]:
    """Ancre un lot de hachages `(vote_hash, blockchain_id)`.

    Les transactions partent d'abord avec des nonces consécutifs, puis on
    attend les reçus : le lot coûte un temps de bloc, pas un par bulletin.
    Au premier échec d'envoi la chaîne de nonces est rompue : les suivants ne
    sont pas tentés et restent à rejouer.
    """
    outcomes = [AnchorOutcome() for _ in items]
    w3, contract = _contract()
    if not w3 or not contract or not settings.ADMIN_PRIVATE_KEY or not items:
        return outcomes

    with _send_lock:
        try:
            account = w3.eth.account.from_key(settings.ADMIN_PRIVATE_KEY)
            nonce = w3.eth.get_transaction_count(account.address, "pending")
        except Exception as exc:
            logger.warning("blockchain: cannot read nonce: %s", exc)
            return outcomes

        sent: list[tuple[int, Any]] = []
        for index, (vote_hash, chain_id) in enumerate(items):
            try:
                tx_hash = _build_and_send(
                    w3, contract.functions.castVote(chain_id, vote_hash), nonce
                )
            except Exception as exc:
                logger.warning("blockchain: castVote not sent (%s) — batch interrupted", exc)
                break
            sent.append((index, tx_hash))
            nonce += 1

        for index, tx_hash in sent:
            try:
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=90)
            except Exception as exc:
                logger.warning("blockchain: no receipt for %s: %s", tx_hash.hex(), exc)
                continue  # peut-être minée plus tard : sera rejouée
            if receipt.status == 1:
                outcomes[index] = AnchorOutcome(tx_hash.hex(), receipt.blockNumber)
            else:
                logger.warning("blockchain: castVote reverted (tx %s)", tx_hash.hex())
                outcomes[index] = AnchorOutcome(retryable=False)
    return outcomes
