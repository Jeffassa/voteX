"""Service d'envoi d'e-mail avec Resend pour l'activation."""

import html
import logging
import os

import resend
from app.core.config import settings

logger = logging.getLogger(__name__)


def _esc(value: object) -> str:
    """Voir email_service._esc : les noms sont des données utilisateur."""
    return html.escape(str(value), quote=True)

def send_activation_code_email(to_email: str, student_name: str, activation_code: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY non configurée. Impossible d'envoyer le code d'activation via Resend.")
        return

    resend.api_key = settings.RESEND_API_KEY

    html = f"""
    <div style="font-family:-apple-system,Inter,sans-serif;max-width:520px;margin:0 auto;color:#0F172A;background:#F7F8FA;padding:32px">
        <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E8EE">
            <div style="background:#0A2540;color:white;padding:16px 20px;border-radius:12px;margin:-32px -32px 24px;font-weight:600;font-size:16px">
                ESATIC SmartVote — Code d'activation
            </div>
            <h1 style="font-size:22px;margin:0 0 8px;color:#0A2540">Bonjour {_esc(student_name)},</h1>
            <p style="color:#334155;line-height:1.6;font-size:14px">
                Voici ton code d'activation pour finaliser ton inscription à SmartVote :
            </p>
            <div style="margin:20px 0;text-align:center">
                <span style="display:inline-block;padding:14px 28px;background:#F1F5F9;color:#0F172A;border-radius:10px;font-weight:700;font-size:24px;letter-spacing:4px;border:1px solid #CBD5E1">
                    {_esc(activation_code)}
                </span>
            </div>
            <p style="color:#334155;line-height:1.6;font-size:14px">
                Renseigne ce code sur la page d'inscription avec ton mot de passe. Ton compte sera ensuite placé en salle d'attente pour validation par un administrateur.
            </p>
        </div>
    </div>
    """

    try:
        response = resend.Emails.send({
            "from": f"ESATIC SmartVote <{settings.RESEND_DOMAIN_FROM}>",
            "to": [to_email],
            "subject": "[ESATIC SmartVote] Ton code d'activation",
            "html": html,
        })
        logger.info(f"email: activation code sent via Resend to {to_email}. ID: {response.get('id')}")
    except Exception as exc:
        logger.warning(f"email: failed to send activation code via Resend to {to_email}: {exc}")


def send_account_activated_email(to_email: str, student_name: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY non configurée. Impossible d'envoyer la confirmation via Resend.")
        return

    resend.api_key = settings.RESEND_API_KEY

    html = f"""
    <div style="font-family:-apple-system,Inter,sans-serif;max-width:520px;margin:0 auto;color:#0F172A;background:#F7F8FA;padding:32px">
        <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E8EE">
            <div style="background:#0A2540;color:white;padding:16px 20px;border-radius:12px;margin:-32px -32px 24px;font-weight:600;font-size:16px">
                ESATIC SmartVote — Compte Autorisé
            </div>
            <h1 style="font-size:22px;margin:0 0 8px;color:#0A2540">Bonjour {_esc(student_name)},</h1>
            <p style="color:#334155;line-height:1.6;font-size:14px">
                Bonne nouvelle ! Ton compte SmartVote a été vérifié et autorisé par l'administration.
            </p>
            <p style="color:#334155;line-height:1.6;font-size:14px">
                Tu peux dès à présent te connecter à la plateforme en utilisant ton matricule et le mot de passe que tu as défini lors de ton inscription.
            </p>
            <p style="margin-top:20px">
                <a href="{settings.FRONTEND_URL}/login"
                   style="display:inline-block;padding:12px 22px;background:#FF7A00;color:white;text-decoration:none;border-radius:10px;font-weight:500">
                    Se connecter à SmartVote
                </a>
            </p>
        </div>
    </div>
    """

    try:
        response = resend.Emails.send({
            "from": f"ESATIC SmartVote <{settings.RESEND_DOMAIN_FROM}>",
            "to": [to_email],
            "subject": "[ESATIC SmartVote] Ton compte est activé !",
            "html": html,
        })
        logger.info(f"email: account activation confirmation sent via Resend to {to_email}. ID: {response.get('id')}")
    except Exception as exc:
        logger.warning(f"email: failed to send account activation confirmation via Resend to {to_email}: {exc}")
