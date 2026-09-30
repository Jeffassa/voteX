"""Script de démonstration et de démarrage rapide pour ESATIC SmartVote.

Remplit la base de données avec des classes ESATIC réelles, des étudiants pré-importés,
des élections et des candidats de test.

Utilisation :
    python -m scripts.seed_demo
"""

import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.candidate import Candidate
from app.models.class_ import ClassRoom
from app.models.election import Election, ElectionStatus
from app.models.student import Student, UserRole


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("[+] Démarrage du seed de démonstration ESATIC SmartVote...")

        # 1. Création des classes ESATIC
        classes_data = [
            {"name": "L3-INFO", "level": "L3", "field": "Informatique"},
            {"name": "M1-SIGL", "level": "M1", "field": "Génie Logiciel"},
            {"name": "M2-SITN", "level": "M2", "field": "Sécurité & Télécoms"},
        ]

        class_map = {}
        for cdata in classes_data:
            existing = db.query(ClassRoom).filter(ClassRoom.name == cdata["name"]).first()
            if not existing:
                cl = ClassRoom(id=uuid4(), **cdata)
                db.add(cl)
                db.flush()
                class_map[cdata["name"]] = cl
                print(f"  - Classe créée : {cdata['name']}")
            else:
                class_map[cdata["name"]] = existing

        # 2. Création de l'Administrateur
        admin_email = "admin@esatic.edu.ci"
        admin = db.query(Student).filter(Student.email == admin_email).first()
        if not admin:
            admin = Student(
                id=uuid4(),
                matricule="22-ESATIC0000AD",
                first_name="Admin",
                last_name="ESATIC",
                email=admin_email,
                role=UserRole.ADMIN,
                is_active=True,
                password_hash=hash_password("AdminESATIC2026!"),
                class_id=class_map["M1-SIGL"].id,
            )
            db.add(admin)
            print("  - Administrateur créé : admin@esatic.edu.ci / AdminESATIC2026!")

        # 3. Étudiants pré-importés pour L3-INFO
        students_data = [
            {"matricule": "22-ESATIC0101AA", "first_name": "Koffi", "last_name": "Yao", "email": "koffi.yao@esatic.edu.ci"},
            {"matricule": "22-ESATIC0102BB", "first_name": "Awa", "last_name": "Kouassi", "email": "awa.kouassi@esatic.edu.ci"},
            {"matricule": "22-ESATIC0103CC", "first_name": "Sékou", "last_name": "Bamba", "email": "sekou.bamba@esatic.edu.ci"},
            {"matricule": "22-ESATIC0104DD", "first_name": "Fatou", "last_name": "Diop", "email": "fatou.diop@esatic.edu.ci"},
        ]

        created_students = []
        for sdata in students_data:
            existing = db.query(Student).filter(Student.matricule == sdata["matricule"]).first()
            if not existing:
                st = Student(
                    id=uuid4(),
                    matricule=sdata["matricule"],
                    first_name=sdata["first_name"],
                    last_name=sdata["last_name"],
                    email=sdata["email"],
                    role=UserRole.STUDENT,
                    is_active=True,
                    password_hash=hash_password("EtudiantESATIC2026!"),
                    class_id=class_map["L3-INFO"].id,
                )
                db.add(st)
                db.flush()
                created_students.append(st)
                print(f"  - Étudiant créé : {sdata['first_name']} {sdata['last_name']} ({sdata['matricule']})")
            else:
                created_students.append(existing)

        # 4. Élection de test pour L3-INFO
        l3_class = class_map["L3-INFO"]
        existing_election = db.query(Election).filter(Election.class_id == l3_class.id).first()
        if not existing_election:
            now = datetime.now(timezone.utc)
            election = Election(
                id=uuid4(),
                title="Élection Chef de Classe L3-INFO 2025-2026",
                description="Vote officiel pour désigner le chef de classe et son adjoint pour la filière L3 Informatique.",
                class_id=l3_class.id,
                starts_at=now - timedelta(hours=1),
                ends_at=now + timedelta(days=2),
                status=ElectionStatus.OPEN,
            )
            db.add(election)
            db.flush()
            print(f"  - Élection créée et ouverte : {election.title}")

            # 5. Candidats associés
            candidated_students = created_students[:2]
            slogans = [
                "Ensemble pour une classe plus forte et unie !",
                "Transparence, écoute et représentation de tous les étudiants.",
            ]
            for idx, cand_student in enumerate(candidated_students):
                c = Candidate(
                    id=uuid4(),
                    election_id=election.id,
                    student_id=cand_student.id,
                    slogan=slogans[idx],
                    program="1. Organisation de séances de tutorat.\n2. Dialogue permanent avec l'administration.\n3. Activités académiques et projets de groupe.",
                    biography=f"{cand_student.first_name} {cand_student.last_name}, étudiant passionné et engagé en L3-INFO.",
                )
                db.add(c)
                print(f"    - Candidat inscrit : {cand_student.first_name} {cand_student.last_name}")

        db.commit()
        print("\n[OK] Seed terminé avec succès ! Environnement de démonstration prêt.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Erreur lors du seed : {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
