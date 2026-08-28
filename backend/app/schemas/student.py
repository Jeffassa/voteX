from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    class_id: UUID | None = None
    photo_url: str | None = None
    is_active: bool | None = None


class StudentRoleUpdate(BaseModel):
    role: str = Field(pattern="^(student|admin|super_admin)$")


class StudentSelfUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    matricule: str | None = None
    photo_url: str | None = None
