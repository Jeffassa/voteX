from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_access_cookie,
    set_csrf_cookie,
    set_refresh_cookie,
)
from app.core.csrf import generate_csrf_token
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.models import Student
from app.schemas.auth import (
    ActivationCodeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.student import MeResponse, StudentOut
from app.services import auth_service, refresh_token_service


router = APIRouter()


def _set_session_cookies(
    response: Response,
    *,
    user: Student,
    refresh_token: str,
) -> str:
    """Émet access JWT + refresh + CSRF, attache tout aux cookies. Retourne l'access."""
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        password_version=user.password_version,
    )
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

    set_access_cookie(response, access_token, access_max_age)
    set_refresh_cookie(response, refresh_token, refresh_max_age)
    set_csrf_cookie(response, generate_csrf_token(), refresh_max_age)
    return access_token


@router.post("/request-activation-code", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def request_activation_code(
    request: Request,
    payload: ActivationCodeRequest,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    await auth_service.send_activation_code(db, payload, background_tasks)
    return {"message": "Si les informations correspondent, un code a été envoyé."}


@router.post("/register", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    return auth_service.register_student(db, payload)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    response: Response,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    """Authentification matricule/mdp. Émet access + refresh + csrf cookies."""
    user = auth_service.authenticate(db, matricule=form.username, password=form.password)

    raw_refresh, _ = refresh_token_service.issue(
        db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    access_token = _set_session_cookies(response, user=user, refresh_token=raw_refresh)

    # Body conservé pour compat clients non-SPA (CLI, Swagger).
    return TokenResponse(access_token=access_token, role=user.role.value, user_id=str(user.id))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    """Rotation : consomme le refresh cookie, émet une nouvelle paire."""
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if not raw_refresh:
        raise HTTPException(status_code=401, detail="Refresh token absent")

    try:
        user, new_raw, _ = refresh_token_service.rotate(
            db,
            raw_token=raw_refresh,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except Exception:
        clear_auth_cookies(response)
        raise

    access_token = _set_session_cookies(response, user=user, refresh_token=new_raw)
    return TokenResponse(access_token=access_token, role=user.role.value, user_id=str(user.id))


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    """Révoque la session courante côté serveur + clear les cookies."""
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if raw_refresh:
        refresh_token_service.revoke(db, raw_token=raw_refresh)
    clear_auth_cookies(response)


@router.get("/me", response_model=MeResponse)
def me(
    current: Annotated[Student, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    user = (
        db.query(Student)
        .options(joinedload(Student.classroom))
        .filter(Student.id == current.id)
        .first()
    )
    return user


@router.post("/password-reset/request", status_code=202)
@limiter.limit("3/minute")
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
):
    auth_service.request_password_reset(db, email=payload.email)
    return {"detail": "Si l'email existe, un lien de réinitialisation a été envoyé."}


@router.post("/password-reset/confirm", status_code=200)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Annotated[Session, Depends(get_db)],
):
    auth_service.confirm_password_reset(db, token=payload.token, new_password=payload.new_password)
    return {"detail": "Mot de passe réinitialisé avec succès."}


@router.post("/me/change-password", status_code=200)
def change_password(
    payload: PasswordResetConfirm,  # token = ancien mdp, new_password = nouveau
    response: Response,
    current: Annotated[Student, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    auth_service.change_password(
        db, user=current, old_password=payload.token, new_password=payload.new_password
    )
    clear_auth_cookies(response)
    return {"detail": "Mot de passe modifié. Reconnectez-vous."}


@router.get("/sessions", response_model=list[dict])
def list_sessions(
    current: Annotated[Student, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Liste les sessions actives — utile pour 'mes appareils'."""
    sessions = refresh_token_service.list_active_for_user(db, user_id=current.id)
    return [
        {
            "id": str(s.id),
            "jti": s.jti,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        }
        for s in sessions
    ]


@router.post("/sessions/revoke-all", status_code=204)
def revoke_all_sessions(
    response: Response,
    current: Annotated[Student, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Force la déconnexion de tous les appareils (panic button)."""
    refresh_token_service.revoke_all_for_user(db, user_id=current.id)
    clear_auth_cookies(response)
