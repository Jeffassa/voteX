from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl

from app.schemas.class_ import ClassOut


class StudentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    first_name: str
    last_name: str
    photo_url: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    first_name: str
    last_name: str
    # Email et password peuvent être nuls pour les comptes pré-importés
    email: EmailStr | None = None
    role: str
    gender: str | None = None
    is_activated: bool = False
    photo_url: str | None = None
    class_id: UUID | None = None
    is_active: bool
    created_at: datetime


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    first_name: str
    last_name: str
    email: EmailStr | None = None
    role: str
    gender: str | None = None
    photo_url: str | None = None
    is_active: bool
    classroom: ClassOut | None = None


class StudentUpdate(BaseModel):
    """Champs modifiables par un administrateur.

    `role` en est volontairement absent : la promotion passe par
    POST /students/{id}/role, réservé au super-admin. L'ajouter ici ouvrirait
    une escalade de privilèges à tout compte admin.
    """

    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    class_id: UUID | None = None
    photo_url: HttpUrl | None = None
    is_active: bool | None = None


class StudentRoleUpdate(BaseModel):
    role: str = Field(pattern="^(student|admin|super_admin)$")


class StudentSelfUpdate(BaseModel):
    """Ce qu'un étudiant peut changer sur SON compte.

    Ni matricule, ni nom, ni prénom : ces trois champs viennent de l'import
    administratif et servent de preuve d'identité. Les laisser modifiables
    permettait à un étudiant de reprendre le matricule d'un camarade pas encore
    importé, et à un candidat de changer le nom affiché sur son propre bulletin.
    Une correction d'état civil passe par un administrateur (PATCH /students/{id}).
    """

    email: EmailStr | None = None
    photo_url: HttpUrl | None = None
