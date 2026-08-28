"""Génère un jeu de données de démo pour la soutenance.

Tous les matricules étudiants suivent le format ESATIC officiel :
    XX-ESATICNNNNAA
où XX = année d'entrée (2 chiffres), NNNN = 4 chiffres, AA = 2 lettres MAJ.
Exemple : 22-ESATIC0273DN

Crée :
- 4 classes ESATIC L3 (GL, RT, CYB, IA)
- 1 super-admin (matricule SUPERADMIN, mdp admin12345) — bootstrap admin, hors format ESATIC
- 1 voter de démo Sékou Bamba (matricule 24-ESATIC0398SB, mdp student12345)
- 4 candidats en L3 GL avec slogan + programme + bio
- 1 élection ouverte en L3 GL avec ces 4 candidats

Usage :
    python -m scripts.seed
"""

from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Candidate, ClassRoom, Election, Student
from app.models.election import ElectionStatus
from app.models.student import Gender, UserRole


CLASSES = [
    {"name": "Génie Logiciel", "level": "L3", "field": "Génie Logiciel"},
    {"name": "Réseaux Télécoms", "level": "L3", "field": "Réseaux Télécoms"},
    {"name": "Cybersécurité", "level": "L3", "field": "Cybersécurité"},
    {"name": "Intelligence Artificielle", "level": "L3", "field": "Intelligence Artificielle"},
]

# Matricules au format ESATIC : 24-ESATICNNNNXX
# Année 24 car L3 = entrés en 2024 pour la promo 2026
CANDIDATES_GL = [
    {
        "matricule": "24-ESATIC0412AN",
        "first_name": "Aïcha",
        "last_name": "N'Guessan",
        "email": "aicha.nguessan@esatic.ci",
        "gender": Gender.FEMALE,
        "slogan": "Une voix qui porte, des actes qui comptent.",
        "bio": (
            "Étudiante en troisième année de Génie Logiciel, déléguée pédagogique depuis "
            "deux ans. Aïcha milite pour une représentation étudiante structurée et un "
            "dialogue constant avec l'administration."
        ),
        "program": (
            "Salle d'étude ouverte 24/7 pendant les partiels\n"
            "Mentorat entre promotions (L2 ↔ L3)\n"
            "Plateforme partagée de ressources de cours"
        ),
    },
    {
        "matricule": "24-ESATIC0187YK",
        "first_name": "Yao",
        "last_name": "Konan",
        "email": "yao.konan@esatic.ci",
        "gender": Gender.MALE,
        "slogan": "Construisons ensemble une promo qui apprend mieux.",
        "bio": (
            "Passionné de pédagogie et de code, Yao a co-fondé le groupe d'entraide "
            "algorithmique de la promo. Il propose une approche structurée et bienveillante "
            "du rôle de chef de classe."
        ),
        "program": (
            "Sessions de révision collaboratives hebdomadaires\n"
            "Calendrier partagé des deadlines et examens\n"
            "Hackathon interne en fin de semestre"
        ),
    },
    {
        "matricule": "24-ESATIC0301MT",
        "first_name": "Mariam",
        "last_name": "Touré",
        "email": "mariam.toure@esatic.ci",
        "gender": Gender.FEMALE,
        "slogan": "Représenter, défendre, livrer.",
        "bio": (
            "Mariam combine engagement associatif et excellence académique. Elle souhaite "
            "faire de la fonction de chef de classe un véritable contre-pouvoir constructif."
        ),
        "program": (
            "Médiation avec l'administration sur les emplois du temps\n"
            "Comité bien-être étudiant (santé mentale, égalité)\n"
            "Newsletter mensuelle de la promo"
        ),
    },
    {
        "matricule": "24-ESATIC0522ID",
        "first_name": "Ibrahim",
        "last_name": "Diallo",
        "email": "ibrahim.diallo@esatic.ci",
        "gender": Gender.MALE,
        "slogan": "Plus simple, plus juste, plus rapide.",
        "bio": (
            "Ingénieur dans l'âme, Ibrahim aime régler les frictions du quotidien. Son "
            "programme est court mais opérationnel : trois chantiers tenus en un an."
        ),
        "program": (
            "Digitaliser les demandes administratives\n"
            "Référent unique par UE pour les litiges de notes\n"
            "Café-débat mensuel avec un intervenant pro"
        ),
    },
]


def upsert_class(db, payload):
    existing = (
        db.query(ClassRoom)
        .filter(ClassRoom.level == payload["level"], ClassRoom.name == payload["name"])
        .first()
    )
    if existing:
        return existing
    classroom = ClassRoom(**payload)
    db.add(classroom)
    db.flush()
    return classroom


def upsert_student(
    db, *, matricule, first_name, last_name, email, password, role, class_id, gender=None
):
    existing = db.query(Student).filter(Student.matricule == matricule).first()
    if existing:
        return existing
    user = Student(
        matricule=matricule,
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        class_id=class_id,
        gender=gender,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def main():
    db = SessionLocal()
    try:
        classes = {c["name"]: upsert_class(db, c) for c in CLASSES}
        gl = classes["Génie Logiciel"]

        # Super-admin : bootstrap, hors format ESATIC (admin technique)
        upsert_student(
            db,
            matricule="SUPERADMIN",
            first_name="Super",
            last_name="Admin",
            email="superadmin@esatic.ci",
            password="admin12345",
            role=UserRole.SUPER_ADMIN,
            class_id=None,
        )

        # Voter de démo — matricule au format ESATIC officiel
        voter = upsert_student(
            db,
            matricule="24-ESATIC0398SB",
            first_name="Sékou",
            last_name="Bamba",
            email="sekou.bamba@esatic.ci",
            password="student12345",
            role=UserRole.STUDENT,
            class_id=gl.id,
            gender=Gender.MALE,
        )

        candidate_students = [
            upsert_student(
                db,
                matricule=c["matricule"],
                first_name=c["first_name"],
                last_name=c["last_name"],
                email=c["email"],
                password="student12345",
                role=UserRole.STUDENT,
                class_id=gl.id,
                gender=c["gender"],
            )
            for c in CANDIDATES_GL
        ]

        existing_election = (
            db.query(Election)
            .filter(Election.class_id == gl.id, Election.title.like("Chef de classe%"))
            .first()
        )
        if existing_election:
            election = existing_election
        else:
            now = datetime.now(timezone.utc)
            election = Election(
                title="Chef de classe — L3 Génie Logiciel",
                description="Élection 2026 du chef de classe de la promotion L3 GL.",
                class_id=gl.id,
                starts_at=now - timedelta(hours=2),
                ends_at=now + timedelta(days=2),
                status=ElectionStatus.OPEN,
            )
            db.add(election)
            db.flush()

            for cand_data, student in zip(CANDIDATES_GL, candidate_students):
                db.add(
                    Candidate(
                        election_id=election.id,
                        student_id=student.id,
                        slogan=cand_data["slogan"],
                        biography=cand_data["bio"],
                        program=cand_data["program"],
                    )
                )

        db.commit()
        print("Seed OK :")
        print(f"  super-admin : matricule=SUPERADMIN       password=admin12345")
        print(
            f"  voter démo  : matricule=24-ESATIC0398SB  password=student12345  "
            f"({voter.first_name} {voter.last_name})"
        )
        print(f"  candidats   :")
        for c in CANDIDATES_GL:
            print(
                f"    - matricule={c['matricule']}  password=student12345  "
                f"({c['first_name']} {c['last_name']})"
            )
        print(f"  élection    : {election.title} ({election.status.value})")
        print(f"  classes     : {', '.join(c.level + ' ' + c.name for c in classes.values())}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
