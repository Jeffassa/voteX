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


def _signed_tx(w3: Web3, fn) -> dict[str, Any]:
    account = w3.eth.account.from_key(settings.ADMIN_PRIVATE_KEY)
    tx = fn.build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 300_000,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
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


def record_vote_on_chain(vote_hash: str, election_blockchain_id: int | None) -> dict[str, Any]:
    """Enregistre un hash de vote on-chain. Retourne {tx_hash, block_number}."""
    w3, contract = _contract()
    if (
        not w3
        or not contract
        or not settings.ADMIN_PRIVATE_KEY
        or election_blockchain_id is None
    ):
        return {"tx_hash": None, "block_number": None}
    try:
        result = _signed_tx(
            w3,
            contract.functions.castVote(election_blockchain_id, vote_hash),
        )
        return {"tx_hash": result["tx_hash"], "block_number": result["block_number"]}
    except Exception as exc:
        logger.warning("blockchain: castVote failed: %s", exc)
        return {"tx_hash": None, "block_number": None}
