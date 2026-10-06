from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

from app.core.matricule import validate_matricule
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
    # Nouvelle adresse en attente du clic sur le lien de confirmation.
    pending_email: EmailStr | None = None
    role: str
    gender: str | None = None
    is_activated: bool = False
    photo_url: str | None = None
    class_id: UUID | None = None
    is_active: bool
    # Permet à l'écran d'administration de distinguer, dans la salle d'attente,
    # une revendication appuyée sur un canal fiable d'une revendication qui ne
    # présente que matricule et nom — deux informations publiques.
    identity_verified: bool = False
    created_at: datetime


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    first_name: str
    last_name: str
    email: EmailStr | None = None
    # Adresse saisie mais pas encore confirmée par le lien envoyé.
    pending_email: EmailStr | None = None
    role: str
    gender: str | None = None
    photo_url: str | None = None
    is_active: bool
    classroom: ClassOut | None = None


class StudentCreate(BaseModel):
    """Compte créé à la main par un administrateur, comme une ligne d'import.

    Aucun mot de passe : l'étudiant active son compte avec le code envoyé à
    l'adresse de l'école. Un mot de passe choisi par l'administrateur lui
    ouvrirait le compte, donc le vote, de l'étudiant.
    """

    matricule: str = Field(min_length=14, max_length=20)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    class_id: UUID

    @field_validator("matricule")
    @classmethod
    def _format(cls, v: str) -> str:
        return validate_matricule(v)


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
    # Exigé pour changer d'adresse : une session restée ouverte ne doit pas
    # suffire à rattacher une autre boîte (et donc un autre compte Google).
    current_password: str | None = Field(default=None, max_length=128)
