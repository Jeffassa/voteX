"""Tests de l'import Excel multi-feuilles."""

import io

import pytest
from openpyxl import Workbook

from app.models import ClassRoom, Student
from app.models.student import Gender
from app.services import student_import_service


def make_xlsx(sheets: dict[str, list[list]]) -> bytes:
    """Helper : construit un xlsx avec les feuilles données.
    sheets = {"Nom feuille": [[header...], [row1...], ...]}"""
    wb = Workbook()
    # Supprimer la feuille par défaut
    wb.remove(wb.active)
    for sheet_name, rows in sheets.items():
        ws = wb.create_sheet(sheet_name)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ─────────────────────────── parsing ───────────────────────────


def test_import_single_sheet_creates_students(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0273DN", "N'Guessan", "Aïcha", "F"],
            ["22-ESATIC0187YK", "Konan", "Yao", "M"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)

    assert report.created == 2
    assert report.errors == 0
    assert report.skipped == 0

    aicha = db.query(Student).filter(Student.matricule == "22-ESATIC0273DN").first()
    assert aicha is not None
    assert aicha.first_name == "Aïcha"
    assert aicha.last_name == "N'Guessan"
    assert aicha.gender == Gender.FEMALE
    assert aicha.class_id == classroom.id
    assert aicha.password_hash is None  # compte en attente d'activation
    assert aicha.is_activated is False


def test_import_multiple_sheets_assigns_each_class(db, classroom):
    other = ClassRoom(name="Cybersécurité", level="L3", field="Cybersécurité")
    db.add(other)
    db.commit()
    db.refresh(other)

    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0001AA", "Doe", "John", "M"],
        ],
        f"{other.level} {other.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0002BB", "Smith", "Jane", "F"],
        ],
    })

    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 2

    s1 = db.query(Student).filter(Student.matricule == "22-ESATIC0001AA").first()
    s2 = db.query(Student).filter(Student.matricule == "22-ESATIC0002BB").first()
    assert s1.class_id == classroom.id
    assert s2.class_id == other.id


def test_import_unknown_sheet_class_is_rejected(db, classroom):
    xlsx = make_xlsx({
        "L3 ClasseInexistante": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0273DN", "Doe", "John", "M"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)

    assert report.created == 0
    assert report.errors >= 1
    assert any("classe introuvable" in (r.message or "").lower() for r in report.rows)


def test_import_invalid_matricule_format_is_rejected(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["INVALID", "Doe", "John", "M"],
            ["20240398", "Bad", "Format", "F"],  # ancien format
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)

    assert report.created == 0
    assert report.errors == 2
    assert all("invalide" in (r.message or "").lower() for r in report.rows if r.status == "error")


def test_import_skips_existing_matricule(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC9999XX", "Existing", "Already", "M"],
        ]
    })
    # Premier import → créé
    student_import_service.import_students(db, file_bytes=xlsx)
    # Re-import → skipped
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 0
    assert report.skipped == 1


def test_import_duplicate_in_file_rejected(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0001AA", "First", "First", "M"],
            ["22-ESATIC0001AA", "Second", "Second", "F"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 1
    assert report.errors == 1


def test_import_dry_run_does_not_persist(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0273DN", "Doe", "John", "M"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx, dry_run=True)
    assert report.created == 1
    # Mais en DB rien
    count = db.query(Student).filter(Student.matricule == "22-ESATIC0273DN").count()
    assert count == 0


def test_import_flexible_column_names(db, classroom):
    """Colonnes 'Matricule', 'NOM', 'Prénom', 'SEXE' acceptées."""
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["Matricule", "NOM", "Prénom", "SEXE"],
            ["22-ESATIC0273DN", "Doe", "John", "Masculin"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 1
    s = db.query(Student).filter(Student.matricule == "22-ESATIC0273DN").first()
    assert s.gender == Gender.MALE


def test_import_missing_matricule_column(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["nom", "prenom"],
            ["Doe", "John"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 0
    assert any("matricule" in (r.message or "").lower() for r in report.rows)


def test_import_missing_first_or_last_name_rejected(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0001AA", "", "John", "M"],
            ["22-ESATIC0002BB", "Doe", "", "M"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 0
    assert report.errors == 2


def test_import_empty_rows_skipped(db, classroom):
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0001AA", "Doe", "John", "M"],
            [None, None, None, None],
            ["", "", "", ""],
            ["22-ESATIC0002BB", "Smith", "Jane", "F"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 2


def test_import_gender_normalization(db, classroom):
    """Toutes les variantes de genre sont normalisées."""
    xlsx = make_xlsx({
        f"{classroom.level} {classroom.name}": [
            ["matricule", "nom", "prenom", "genre"],
            ["22-ESATIC0001AA", "Un", "M_brut", "M"],
            ["22-ESATIC0002BB", "Deux", "Masc_long", "Masculin"],
            ["22-ESATIC0003CC", "Trois", "Homme", "Homme"],
            ["22-ESATIC0004DD", "Quatre", "F_brut", "F"],
            ["22-ESATIC0005EE", "Cinq", "Fem_long", "Féminin"],
        ]
    })
    report = student_import_service.import_students(db, file_bytes=xlsx)
    assert report.created == 5

    males = db.query(Student).filter(Student.gender == Gender.MALE).count()
    females = db.query(Student).filter(Student.gender == Gender.FEMALE).count()
    assert males == 3
    assert females == 2
