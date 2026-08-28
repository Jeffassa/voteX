"""CLI pour créer un compte admin ou super_admin.

Usage :
    python -m scripts.create_admin --matricule SUPERADMIN1 \
        --first-name Yao --last-name Konan \
        --email admin@esatic.ci --password 'change-me-now' \
        --role super_admin
"""

import argparse
import sys

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Student
from app.models.student import UserRole


def main():
    parser = argparse.ArgumentParser(description="Crée un compte admin ESATIC SmartVote")
    parser.add_argument("--matricule", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", choices=["admin", "super_admin"], default="admin")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing = db.query(Student).filter(Student.matricule == args.matricule).first()
        if existing:
            print(f"Erreur : matricule {args.matricule} déjà utilisé.", file=sys.stderr)
            sys.exit(1)

        user = Student(
            matricule=args.matricule,
            first_name=args.first_name,
            last_name=args.last_name,
            email=args.email,
            password_hash=hash_password(args.password),
            role=UserRole(args.role),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"OK — {args.role} créé : {user.matricule} ({user.email}) — id={user.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
