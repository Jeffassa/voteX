"""Configuration pytest partagée.

Stratégie : SQLite in-memory pour la rapidité. Les modèles utilisent
`sqlalchemy.Uuid` qui s'adapte au dialecte (CHAR(32) sur SQLite,
UUID natif sur Postgres) — donc le comportement testé est fidèle.

Chaque test a sa propre base, créée et détruite à la volée. Pas besoin
d'env var ni de docker.
"""

import os
from datetime import datetime, timedelta, timezone

import pytest

# Forcer une config minimale AVANT d'importer l'app (qui lit settings au load)
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SUPABASE_URL", "http://test")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test")
os.environ.setdefault(
    "JWT_SECRET",
    "Z9k4vPq8rMnL3jH7sB2dX5cF1gW6tY0aQiE4uN8RsoVbPyDmCkJfAhXgZrTwLnQpE2vSBuY1",
)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.security import hash_password
from app.models import Candidate, ClassRoom, Election, Student
from app.models.election import ElectionStatus
from app.models.student import UserRole


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """slowapi garde son compteur en mémoire pour tout le process.

    Sans reset, le 11e test qui touche /login se prend un 429 alors que le
    scénario testé n'a rien à voir avec le rate limiting. On désactive le
    limiter globalement ; les tests qui veulent le vérifier le réactivent
    explicitement via la fixture `rate_limited_client`.
    """
    from app.core.rate_limit import limiter

    limiter.enabled = False
    limiter.reset()
    yield
    limiter.enabled = True


@pytest.fixture()
def db():
    # StaticPool : une seule connexion partagée pour toute la durée du test.
    # Sans ça, SQLite ":memory:" donne une base VIDE à chaque nouvelle
    # connexion (une par thread avec le pool par défaut) — d'où les
    # "no such table" dès qu'un endpoint sync s'exécute dans le threadpool
    # de Starlette après un commit qui a rendu la connexion au pool.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()



@pytest.fixture()
def client(db):
    """TestClient câblé sur la base du test (override de get_db)."""
    from fastapi.testclient import TestClient

    from app.core.database import get_db
    from app.main import app

    Base.metadata.create_all(bind=db.get_bind())
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(client, voter):
    """Client déjà authentifié avec la fixture `voter`."""
    r = client.post(
        "/api/auth/login",
        data={"username": voter.matricule, "password": "student12345"},
    )
    assert r.status_code == 200, r.text
    return client


@pytest.fixture()
def classroom(db):
    c = ClassRoom(name="Génie Logiciel", level="L3", field="Génie Logiciel")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def voter(db, classroom):
    s = Student(
        matricule="20240398",
        first_name="Sékou",
        last_name="Bamba",
        email="sekou@esatic.ci",
        password_hash=hash_password("student12345"),
        role=UserRole.STUDENT,
        class_id=classroom.id,
        is_active=True,  # Actif pour être comptabilisé dans total_eligible
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture()
def other_class_voter(db):
    other = ClassRoom(name="Cybersécurité", level="L3", field="Cybersécurité")
    db.add(other)
    db.flush()
    s = Student(
        matricule="20240500",
        first_name="Awa",
        last_name="Cissé",
        email="awa@esatic.ci",
        password_hash=hash_password("student12345"),
        role=UserRole.STUDENT,
        class_id=other.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture()
def candidate_students(db, classroom):
    students = [
        Student(
            matricule=f"2024{i:04d}",
            first_name=f"Cand{i}",
            last_name="Test",
            email=f"cand{i}@esatic.ci",
            password_hash=hash_password("x" * 12),
            role=UserRole.STUDENT,
            class_id=classroom.id,
            is_active=True,   # Doit être actif pour être comptabilisé dans total_eligible
        )
        for i in range(1, 4)  # 3 candidate students
    ]
    db.add_all(students)
    db.commit()
    for s in students:
        db.refresh(s)
    return students


@pytest.fixture()
def open_election(db, classroom, candidate_students):
    now = datetime.now(timezone.utc)
    election = Election(
        title="Chef de classe — Test",
        class_id=classroom.id,
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=24),
        status=ElectionStatus.OPEN,
    )
    db.add(election)
    db.flush()
    for s in candidate_students:
        db.add(Candidate(election_id=election.id, student_id=s.id, slogan="x"))
    db.commit()
    db.refresh(election)
    return election


@pytest.fixture()
def draft_election(db, classroom, candidate_students):
    now = datetime.now(timezone.utc)
    election = Election(
        title="Brouillon",
        class_id=classroom.id,
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=24),
        status=ElectionStatus.DRAFT,
    )
    db.add(election)
    db.flush()
    for s in candidate_students:
        db.add(Candidate(election_id=election.id, student_id=s.id))
    db.commit()
    db.refresh(election)
    return election


@pytest.fixture()
def expired_election(db, classroom, candidate_students):
    now = datetime.now(timezone.utc)
    election = Election(
        title="Périmée",
        class_id=classroom.id,
        starts_at=now - timedelta(days=10),
        ends_at=now - timedelta(days=5),
        status=ElectionStatus.OPEN,  # statut OPEN mais hors période
    )
    db.add(election)
    db.flush()
    for s in candidate_students:
        db.add(Candidate(election_id=election.id, student_id=s.id))
    db.commit()
    db.refresh(election)
    return election
