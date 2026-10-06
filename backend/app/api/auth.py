from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.cookies import (
    CSRF_HEADER,
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_access_cookie,
    set_refresh_cookie,
)
from app.core.antispam import is_bot
from app.core.exceptions import UnauthorizedError
from app.core.csrf import generate_csrf_token
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.cookies import ACCESS_COOKIE
from app.core.security import create_access_token, decode_token
from app.models import Student
from app.schemas.auth import (
    ActivationCodeRequest,
    EmailConfirmRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.student import MeResponse, StudentOut
from app.models.audit import AuditAction
from app.services import (
    audit_service,
    auth_service,
    email_change_service,
    email_service,
    google_oauth,
    refresh_token_service,
)


router = APIRouter()


def _set_session_cookies(
    response: Response,
    *,
    user: Student,
    refresh_token: str,
) -> str:
    """Émet la paire de cookies httpOnly et publie le jeton CSRF en en-tête.

    Le jeton CSRF est scellé dans l'access token (claim `csrf`) et renvoyé au
    client par `X-CSRF-Token`. Aucun cookie n'est lisible par le script : le
    client garde ce jeton en mémoire, le temps de l'onglet.
    """
    csrf_token = generate_csrf_token()
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        password_version=user.password_version,
        extra={"csrf": csrf_token},
    )
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

    set_access_cookie(response, access_token, access_max_age)
    set_refresh_cookie(response, refresh_token, refresh_max_age)
    response.headers[CSRF_HEADER] = csrf_token
    return access_token


# Limites par IP larges : un campus sort par une seule adresse, et 3 demandes
# par minute y bloquaient toute l'école le jour de l'activation. La protection
# des comptes est ailleurs : verrou par compte, envois limités par compte.
@router.post("/request-activation-code", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("30/minute")
async def request_activation_code(
    request: Request,
    payload: ActivationCodeRequest,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    if not is_bot(payload.website, form="activation_code"):
        await auth_service.send_activation_code(db, payload, background_tasks)
    return {"message": "Si les informations correspondent, un code a été envoyé."}


@router.post("/register", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    if is_bot(payload.website, form="register"):
        raise HTTPException(status_code=400, detail="Requête refusée.")
    return auth_service.register_student(db, payload, background_tasks)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    response: Response,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
    website: Annotated[str | None, Form(max_length=200)] = None,
):
    """Authentification matricule/mdp. Émet access + refresh + csrf cookies."""
    client_ip = request.client.host if request.client else None
    if is_bot(website, form="login"):
        # Même réponse qu'un mot de passe faux, sans toucher au compte visé :
        # un robot ne doit pas pouvoir verrouiller le compte d'un électeur.
        raise UnauthorizedError("Matricule ou mot de passe incorrect")
    try:
        user = auth_service.authenticate(db, matricule=form.username, password=form.password)
    except Exception:
        # Une tentative infructueuse est le signal le plus utile du journal :
        # sans elle, une attaque par force brute ne laisse aucune trace.
        audit_service.record(
            db,
            action=AuditAction.LOGIN_FAILED,
            target_type="matricule",
            target_id=form.username[:64],
            ip_address=client_ip,
        )
        raise

    raw_refresh, _ = refresh_token_service.issue(
        db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    access_token = _set_session_cookies(response, user=user, refresh_token=raw_refresh)

    audit_service.record(
        db,
        action=AuditAction.LOGIN,
        actor_id=user.id,
        target_type="student",
        target_id=user.id,
        ip_address=client_ip,
    )

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
    audit_service.record(
        db,
        action=AuditAction.LOGOUT,
        ip_address=request.client.host if request.client else None,
    )


@router.get("/me", response_model=MeResponse)
def me(
    request: Request,
    response: Response,
    current: Annotated[Student, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Un rechargement de page vide la mémoire du client : /me est le premier
    # appel qu'il émet, c'est donc ici qu'il récupère son jeton CSRF. La réponse
    # n'est lisible que par les origines autorisées (CORS).
    access_cookie = request.cookies.get(ACCESS_COOKIE)
    if access_cookie:
        try:
            csrf = decode_token(access_cookie).get("csrf")
        except ValueError:
            csrf = None
        if csrf:
            response.headers[CSRF_HEADER] = csrf

    user = (
        db.query(Student)
        .options(joinedload(Student.classroom))
        .filter(Student.id == current.id)
        .first()
    )
    return user


@router.post("/password-reset/request", status_code=202)
@limiter.limit("30/minute")
def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    if not is_bot(payload.website, form="password_reset"):
        auth_service.request_password_reset(
            db, email=payload.email, background_tasks=background_tasks
        )
    return {"detail": "Si l'email existe, un lien de réinitialisation a été envoyé."}


@router.post("/password-reset/confirm", status_code=200)
@limiter.limit("30/minute")
def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirm,
    db: Annotated[Session, Depends(get_db)],
):
    user = auth_service.confirm_password_reset(
        db, token=payload.token, new_password=payload.new_password
    )
    audit_service.record(
        db,
        action=AuditAction.PASSWORD_RESET_CONFIRMED,
        actor_id=user.id,
        target_type="student",
        target_id=user.id,
    )
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
    audit_service.record(
        db,
        action=AuditAction.PASSWORD_CHANGED,
        actor_id=current.id,
        target_type="student",
        target_id=current.id,
    )
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
    # Les jetons d'accès déjà émis restaient valables jusqu'à 15 minutes : un
    # appareil volé gardait la main. Changer de version les invalide tous
    # (deps.get_current_user compare `pwd_v`), comme un changement de mot de
    # passe — liens de réinitialisation en cours compris.
    current.password_version += 1
    db.commit()
    clear_auth_cookies(response)


# ───────────────────── connexion avec Google ─────────────────────


@router.get("/providers")
def providers():
    """Fournisseurs d'identité disponibles, et hébergeurs de photos autorisés."""
    return {"google": google_oauth.is_enabled(), "photo_hosts": settings.photo_hosts}


@router.get("/google/start")
@limiter.limit("20/minute")
def google_start(request: Request):
    if not google_oauth.is_enabled():
        raise HTTPException(status_code=404, detail="Connexion Google non configurée")
    auth = google_oauth.start()
    response = RedirectResponse(auth.url, status_code=302)
    # SameSite=Lax et non Strict : le retour de Google est une navigation
    # venue d'un autre site, sur laquelle un cookie Strict ne serait pas envoyé.
    response.set_cookie(
        google_oauth.STATE_COOKIE,
        auth.state_cookie,
        max_age=int(google_oauth.STATE_TTL.total_seconds()),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path=google_oauth.STATE_COOKIE_PATH,
        domain=settings.COOKIE_DOMAIN or None,
    )
    return response


@router.get("/google/callback")
@limiter.limit("20/minute")
def google_callback(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    frontend = settings.FRONTEND_URL.rstrip("/")
    client_ip = request.client.host if request.client else None

    try:
        if error:
            raise google_oauth.GoogleLoginError("annule", f"Google a renvoyé {error!r}")
        user = google_oauth.complete(
            db,
            code=code,
            state=state,
            state_cookie=request.cookies.get(google_oauth.STATE_COOKIE),
        )
    except google_oauth.GoogleLoginError as exc:
        audit_service.record(
            db,
            action=AuditAction.LOGIN_FAILED,
            target_type="google",
            details=exc.code,
            ip_address=client_ip,
        )
        response = RedirectResponse(f"{frontend}/login?erreur=google_{exc.code}", status_code=302)
        response.delete_cookie(google_oauth.STATE_COOKIE, path=google_oauth.STATE_COOKIE_PATH)
        return response

    raw_refresh, _ = refresh_token_service.issue(
        db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip,
    )
    response = RedirectResponse(f"{frontend}/connexion/google", status_code=302)
    _set_session_cookies(response, user=user, refresh_token=raw_refresh)
    response.delete_cookie(google_oauth.STATE_COOKIE, path=google_oauth.STATE_COOKIE_PATH)
    # Le jeton CSRF ne doit pas fuiter dans une redirection : le frontend le
    # récupère par /api/auth/me, comme après un rechargement de page.
    del response.headers[CSRF_HEADER]
    audit_service.record(
        db,
        action=AuditAction.LOGIN,
        actor_id=user.id,
        target_type="student",
        target_id=user.id,
        details="google",
        ip_address=client_ip,
    )
    return response


@router.post("/email/confirm")
@limiter.limit("10/minute")
def confirm_email(
    request: Request,
    payload: EmailConfirmRequest,
    db: Annotated[Session, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    """Confirme l'adresse e-mail en attente (lien reçu par e-mail)."""
    user, previous = email_change_service.confirm(db, token=payload.token)
    if previous and previous.lower() != (user.email or "").lower():
        background_tasks.add_task(
            email_service.send_email_changed_notice,
            to_email=previous,
            student_name=f"{user.first_name} {user.last_name}",
            new_email=user.email,
        )
    audit_service.record(
        db,
        action=AuditAction.STUDENT_UPDATED,
        actor_id=user.id,
        target_type="student",
        target_id=user.id,
        details="adresse e-mail confirmée",
        ip_address=request.client.host if request.client else None,
    )
    return {"detail": "Adresse e-mail confirmée.", "email": user.email}
