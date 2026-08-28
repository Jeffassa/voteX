from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.matricule import validate_matricule


class LoginRequest(BaseModel):
    matricule: str
    password: str


class ActivationCodeRequest(BaseModel):
    matricule: str = Field(min_length=14, max_length=20)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr


class RegisterRequest(BaseModel):
    """Inscription étudiant — revendique un matricule pré-importé.

    Le matricule DOIT déjà exister dans le système (importé par l'admin) et le
    nom complet saisi DOIT correspondre à celui en base. Cf. auth_service.register_student.
    """

    matricule: str = Field(min_length=14, max_length=20)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    # Email et class_id ne sont PAS saisis par l'étudiant — ils viennent de l'import admin
    # (email est optionnel : l'étudiant peut le fournir pour activer le reset password)
    email: EmailStr | None = None
    class_id: str | None = None
    activation_code: str | None = None

    @field_validator("matricule")
    @classmethod
    def _format(cls, v: str) -> str:
        return validate_matricule(v)

    @model_validator(mode="after")
    def _passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Les mots de passe ne correspondent pas")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Sert pour reset (token = JWT reset) ET pour change-password (token = ancien mdp)."""

    token: str
    new_password: str = Field(min_length=8, max_length=128)
