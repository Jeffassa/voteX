"""Le journal d'audit nomme l'auteur de chaque événement.

L'interface croisait les identifiants avec la liste des étudiants, plafonnée à
200 comptes : au-delà, un auteur bien vivant s'affichait « Compte supprimé ».
"""

from app.core.security import hash_password
from app.models import Student
from app.models.audit import AuditAction
from app.models.student import UserRole
from app.schemas.audit import AuditEventOut
from app.services import audit_service, student_service


def test_audit_events_carry_the_actor_name(db):
    actor = Student(
        matricule="ZOE1", first_name="Zoé", last_name="Zran",
        email="zoe1@esatic.edu.ci", password_hash=hash_password("mot-de-passe-1"),
        role=UserRole.ADMIN, is_active=True,
    )
    db.add(actor)
    db.commit()
    audit_service.record(db, action=AuditAction.CLASS_CREATED, actor_id=actor.id)
    audit_service.record(db, action=AuditAction.LOGIN_FAILED, details="aucun_compte")

    rows = [AuditEventOut.model_validate(e) for e in audit_service.list_recent(db)]
    by_action = {r.action: r for r in rows}
    assert by_action["class_created"].actor_name == "Zoé Zran"
    assert by_action["login_failed"].actor_name is None


def test_deleted_actor_leaves_an_anonymous_event(db):
    boss = Student(
        matricule="SUPER9", first_name="Chef", last_name="Super",
        email="super9@esatic.edu.ci", password_hash=hash_password("mot-de-passe-1"),
        role=UserRole.SUPER_ADMIN, is_active=True,
    )
    actor = Student(
        matricule="GONE1", first_name="Ancien", last_name="Compte",
        email="gone1@esatic.edu.ci", password_hash=hash_password("mot-de-passe-1"),
        role=UserRole.STUDENT, is_active=True,
    )
    db.add_all([boss, actor])
    db.commit()
    audit_service.record(db, action=AuditAction.LOGIN, actor_id=actor.id)

    student_service.delete(db, actor.id, current_user_id=boss.id)
    db.expire_all()

    # L'événement survit au compte, sans nom : l'interface affiche alors
    # « Compte supprimé » (Postgres remet aussi actor_id à NULL).
    (event,) = [e for e in audit_service.list_recent(db) if e.action == AuditAction.LOGIN]
    assert AuditEventOut.model_validate(event).actor_name is None
