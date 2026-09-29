"""Ancrage on-chain asynchrone des bulletins.

Avant : le vote attendait la transaction (jusqu'à 90 s), la faisait partir
avant la validation en base, et un échec du RPC laissait le bulletin sans
ancrage, sans reprise. Ici on vérifie les propriétés inverses.
"""

import pytest

from app.models import Vote
from app.models.election import ElectionStatus
from app.services import anchoring_service, blockchain, election_service, vote_service
from app.services.blockchain import AnchorOutcome


@pytest.fixture()
def chain(monkeypatch):
    """Chaîne factice : la configuration est déclarée présente, l'envoi est simulé."""
    state = {"calls": [], "results": None}

    monkeypatch.setattr(anchoring_service, "chain_configured", lambda: True)

    def fake_submit(items):
        state["calls"].append(list(items))
        if state["results"] is not None:
            return state["results"](items)
        return [AnchorOutcome(f"0x{'ab' * 32}", 100 + i) for i, _ in enumerate(items)]

    monkeypatch.setattr(blockchain, "submit_votes", fake_submit)
    return state


def _vote(db, voter, election):
    return vote_service.cast_vote(
        db, user=voter, election_id=election.id, candidate_id=election.candidates[0].id
    )


def test_casting_a_vote_never_touches_the_chain(db, voter, open_election, monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("le vote ne doit pas attendre la chaîne")

    monkeypatch.setattr(blockchain, "submit_votes", boom)
    open_election.blockchain_id = 7
    db.commit()
    vote = _vote(db, voter, open_election)
    assert vote.tx_hash is None and vote.block_number is None


def test_pending_votes_get_anchored(db, voter, open_election, chain):
    open_election.blockchain_id = 7
    db.commit()
    vote = _vote(db, voter, open_election)

    assert anchoring_service.anchor_pending(db) == 1
    db.refresh(vote)
    assert vote.tx_hash and vote.block_number == 100
    assert chain["calls"] == [[(vote.vote_hash, 7)]]
    # Rien à refaire ensuite.
    assert anchoring_service.anchor_pending(db) == 0


def test_transient_failure_is_retried_later(db, voter, open_election, chain):
    open_election.blockchain_id = 7
    db.commit()
    vote = _vote(db, voter, open_election)

    chain["results"] = lambda items: [AnchorOutcome(retryable=True) for _ in items]
    assert anchoring_service.anchor_pending(db) == 0
    db.refresh(vote)
    assert vote.tx_hash is None and vote.anchor_attempts == 1

    chain["results"] = None  # la chaîne revient
    assert anchoring_service.anchor_pending(db) == 1
    db.refresh(vote)
    assert vote.tx_hash is not None


def test_rejected_vote_is_not_replayed_forever(db, voter, open_election, chain):
    open_election.blockchain_id = 7
    db.commit()
    vote = _vote(db, voter, open_election)

    chain["results"] = lambda items: [AnchorOutcome(retryable=False) for _ in items]
    anchoring_service.anchor_pending(db)
    db.refresh(vote)
    assert vote.anchor_attempts == anchoring_service.MAX_ATTEMPTS

    chain["calls"].clear()
    anchoring_service.anchor_pending(db)
    assert chain["calls"] == []


def test_election_without_chain_id_is_left_alone(db, voter, open_election, chain):
    open_election.blockchain_id = None
    db.commit()
    _vote(db, voter, open_election)
    assert anchoring_service.anchor_pending(db) == 0
    assert chain["calls"] == []


def test_pending_votes_are_anchored_before_the_chain_election_is_closed(
    db, voter, open_election, chain, monkeypatch
):
    open_election.blockchain_id = 7
    db.commit()
    vote = _vote(db, voter, open_election)

    order = []
    real_submit = blockchain.submit_votes

    def spy_submit(items):
        order.append("anchor")
        return real_submit(items)

    monkeypatch.setattr(blockchain, "submit_votes", spy_submit)
    monkeypatch.setattr(blockchain, "close_election_on_chain", lambda _id: order.append("close"))

    election_service.set_status(db, open_election.id, ElectionStatus.CLOSED)

    assert order.index("anchor") < order.index("close")
    db.refresh(vote)
    assert vote.tx_hash is not None


# ─────────────── envoi des transactions : nonces ───────────────


class _Receipt:
    def __init__(self, status=1, block=500):
        self.status, self.blockNumber = status, block


class _FakeEth:
    def __init__(self, fail_at=None):
        self.sent, self.pending_asked, self.fail_at = [], [], fail_at
        self.account = type(
            "Accounts", (), {"from_key": staticmethod(lambda _k: type("A", (), {"address": "0xabc"})())}
        )()

    @property
    def gas_price(self):
        return 1

    def get_transaction_count(self, _addr, block="latest"):
        self.pending_asked.append(block)
        return 40

    def wait_for_transaction_receipt(self, _h, timeout=0):
        return _Receipt()


def test_submit_votes_uses_consecutive_pending_nonces(monkeypatch):
    eth = _FakeEth()
    w3 = type("W", (), {"eth": eth})()
    monkeypatch.setattr(blockchain.settings, "ADMIN_PRIVATE_KEY", "0x1")
    monkeypatch.setattr(blockchain, "_contract", lambda: (w3, type("C", (), {"functions": type("F", (), {"castVote": staticmethod(lambda i, h: (i, h))})})()))

    nonces = []

    class _H(bytes):
        pass

    def fake_send(_w3, fn, nonce):
        nonces.append(nonce)
        return _H(b"\x01")

    monkeypatch.setattr(blockchain, "_build_and_send", fake_send)
    out = blockchain.submit_votes([("0x" + "a" * 64, 1), ("0x" + "b" * 64, 1), ("0x" + "c" * 64, 2)])

    assert nonces == [40, 41, 42]
    assert eth.pending_asked == ["pending"]
    assert all(o.ok for o in out)


def test_submit_votes_stops_at_first_send_failure(monkeypatch):
    eth = _FakeEth()
    w3 = type("W", (), {"eth": eth})()
    monkeypatch.setattr(blockchain.settings, "ADMIN_PRIVATE_KEY", "0x1")
    monkeypatch.setattr(blockchain, "_contract", lambda: (w3, type("C", (), {"functions": type("F", (), {"castVote": staticmethod(lambda i, h: (i, h))})})()))

    calls = []

    def fake_send(_w3, fn, nonce):
        calls.append(nonce)
        if len(calls) == 2:
            raise RuntimeError("rpc down")
        return b"\x02"

    monkeypatch.setattr(blockchain, "_build_and_send", fake_send)
    out = blockchain.submit_votes([("0x" + "a" * 64, 1)] * 3)

    assert calls == [40, 41]  # le troisième n'est pas tenté
    assert [o.ok for o in out] == [True, False, False]
    assert all(o.retryable for o in out[1:])
