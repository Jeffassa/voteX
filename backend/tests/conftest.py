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

from app.core.database import Base
from app.core.security import hash_password
from app.models import Candidate, ClassRoom, Election, Student
from app.models.election import ElectionStatus
from app.models.student import UserRole


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
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
