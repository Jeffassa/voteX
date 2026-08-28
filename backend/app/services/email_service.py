"""Envoi d'emails transactionnels (reçus de vote, etc.).

Best-effort : si la config SMTP est absente, on log et on continue.
Le vote ne doit JAMAIS échouer parce que l'email n'a pas pu partir.
"""

import logging
from datetime import datetime

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings


logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    return bool(settings.MAIL_USERNAME and settings.MAIL_PASSWORD and settings.MAIL_SERVER)


def _config() -> ConnectionConfig | None:
    if not _is_configured():
        return None
    try:
        return ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )
    except Exception as exc:
        logger.warning("email: invalid SMTP config: %s", exc)
        return None


def _build_receipt_html(
    *,
    voter_name: str,
    election_title: str,
    candidate_name: str | None,
    vote_hash: str,
    tx_hash: str | None,
    block_number: int | None,
    created_at: datetime,
    explorer_base: str,
) -> str:
    candidate_line = (
        f"<strong>{candidate_name}</strong>" if candidate_name else "votre candidat"
    )
    chain_block = ""
    if tx_hash:
        chain_block = f"""
        <tr><td style="color:#64748B;padding:6px 0;width:140px">Hash transaction</td>
            <td style="font-family:monospace;color:#0A2540;word-break:break-all">{tx_hash}</td></tr>
        <tr><td style="color:#64748B;padding:6px 0">Bloc</td>
            <td style="font-family:monospace;color:#0A2540">#{block_number:,}</td></tr>
        <tr><td colspan="2" style="padding-top:14px">
            <a href="{explorer_base}/tx/{tx_hash}"
               style="display:inline-block;padding:8px 14px;background:#FF7A00;color:white;
                      text-decoration:none;border-radius:8px;font-size:13px;font-weight:500">
              Vérifier sur l'explorateur →
            </a>
        </td></tr>
        """.replace("{:,}".format(block_number) if block_number else "—", str(block_number or "—"))

    return f"""
    <div style="font-family:-apple-system,Inter,sans-serif;max-width:560px;margin:0 auto;
                color:#0F172A;background:#F7F8FA;padding:32px">
      <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E8EE">
        <div style="background:#0A2540;color:white;padding:16px 20px;border-radius:12px;
                    margin:-32px -32px 24px;font-weight:600;font-size:16px;letter-spacing:-0.02em">
          ESATIC SmartVote — Reçu de vote
        </div>
        <h1 style="font-size:22px;margin:0 0 8px;color:#0A2540;letter-spacing:-0.025em">
          Votre vote a été enregistré.
        </h1>
        <p style="color:#334155;line-height:1.6;font-size:14px">
          Bonjour {voter_name}, votre bulletin pour {candidate_line} dans l'élection
          « {election_title} » est désormais scellé sur la blockchain.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px">
          <tr><td style="color:#64748B;padding:6px 0;width:140px">Hash de vote</td>
              <td style="font-family:monospace;color:#0A2540;word-break:break-all">{vote_hash}</td></tr>
          <tr><td style="color:#64748B;padding:6px 0">Horodatage</td>
              <td style="font-family:monospace;color:#0A2540">{created_at.isoformat(sep=" ", timespec="seconds")} UTC</td></tr>
          {chain_block}
        </table>

        <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin-top:24px;
                  border-top:1px solid #E5E8EE;padding-top:16px">
          Pour des raisons d'anonymat, le contenu de votre bulletin n'est pas révélé dans ce reçu.
          Seule la preuve d'enregistrement on-chain est confirmée.
        </p>
      </div>
    </div>
    """


async def send_password_reset_email(
    *,
    to_email: str,
    voter_name: str,
    reset_url: str,
) -> None:
    config = _config()
    if not config:
        logger.info("email: SMTP not configured — reset link for %s : %s", to_email, reset_url)
        return

    html = f"""
    <div style="font-family:-apple-system,Inter,sans-serif;max-width:520px;margin:0 auto;
                color:#0F172A;background:#F7F8FA;padding:32px">
      <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E8EE">
        <div style="background:#0A2540;color:white;padding:16px 20px;border-radius:12px;
                    margin:-32px -32px 24px;font-weight:600;font-size:16px">
          ESATIC SmartVote — Réinitialisation
        </div>
        <h1 style="font-size:22px;margin:0 0 8px;color:#0A2540">Bonjour {voter_name},</h1>
        <p style="color:#334155;line-height:1.6;font-size:14px">
          Tu as demandé à réinitialiser ton mot de passe SmartVote. Clique sur le bouton
          ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans
          <strong>30 minutes</strong>.
        </p>
        <p style="margin-top:20px">
          <a href="{reset_url}"
             style="display:inline-block;padding:12px 22px;background:#FF7A00;color:white;
                    text-decoration:none;border-radius:10px;font-weight:500">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="color:#94A3B8;font-size:11px;margin-top:24px;border-top:1px solid #E5E8EE;
                  padding-top:16px;line-height:1.5">
          Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe
          ne sera pas changé.
        </p>
      </div>
    </div>
    """

    message = MessageSchema(
        subject="[ESATIC SmartVote] Réinitialisation de votre mot de passe",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )
    try:
        await FastMail(config).send_message(message)
        logger.info("email: password reset link sent to %s", to_email)
    except Exception as exc:
        logger.warning("email: failed to send reset link to %s: %s", to_email, exc)


async def send_vote_receipt_email(
    *,
    to_email: str,
    voter_name: str,
    election_title: str,
    candidate_name: str | None,
    vote_hash: str,
    tx_hash: str | None,
    block_number: int | None,
    created_at: datetime,
) -> None:
    config = _config()
    if not config:
        logger.info("email: SMTP not configured — skipping receipt to %s", to_email)
        return

    explorer_base = "https://sepolia.etherscan.io"
    html = _build_receipt_html(
        voter_name=voter_name,
        election_title=election_title,
        candidate_name=candidate_name,
        vote_hash=vote_hash,
        tx_hash=tx_hash,
        block_number=block_number,
        created_at=created_at,
        explorer_base=explorer_base,
    )

    message = MessageSchema(
        subject=f"[ESATIC SmartVote] Reçu — {election_title}",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )

    try:
        await FastMail(config).send_message(message)
        logger.info("email: receipt sent to %s for vote %s", to_email, vote_hash[:10])
    except Exception as exc:
        logger.warning("email: failed to send receipt to %s: %s", to_email, exc)


async def send_activation_code_email(
    *,
    to_email: str,
    voter_name: str,
    activation_code: str,
) -> None:
    config = _config()
    if not config:
        logger.info("email: SMTP not configured — activation code for %s : %s", to_email, activation_code)
        return

    html = f"""
    <div style="font-family:-apple-system,Inter,sans-serif;max-width:520px;margin:0 auto;
                color:#0F172A;background:#F7F8FA;padding:32px">
      <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E8EE">
        <div style="background:#0A2540;color:white;padding:16px 20px;border-radius:12px;
                    margin:-32px -32px 24px;font-weight:600;font-size:16px">
          ESATIC SmartVote — Activation
        </div>
        <h1 style="font-size:22px;margin:0 0 8px;color:#0A2540">Bonjour {voter_name},</h1>
        <p style="color:#334155;line-height:1.6;font-size:14px">
          Ton compte SmartVote a été pré-créé par l'administration. Voici ton code d'activation
          secret pour finaliser ton inscription :
        </p>
        <div style="margin:20px 0;text-align:center">
          <span style="display:inline-block;padding:14px 28px;background:#F1F5F9;color:#0F172A;
                       border-radius:10px;font-weight:700;font-size:24px;letter-spacing:4px;
                       border:1px solid #CBD5E1">
            {activation_code}
          </span>
        </div>
        <p style="color:#334155;line-height:1.6;font-size:14px">
          Rends-toi sur la page d'activation et saisis ton matricule, ton nom et ce code.
        </p>
        <p style="color:#94A3B8;font-size:11px;margin-top:24px;border-top:1px solid #E5E8EE;
                  padding-top:16px;line-height:1.5">
          Si tu n'es pas étudiant à l'ESATIC, ignore cet email.
        </p>
      </div>
    </div>
    """

    message = MessageSchema(
        subject="[ESATIC SmartVote] Votre code d'activation",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )
    try:
        await FastMail(config).send_message(message)
        logger.info("email: activation code sent to %s", to_email)
    except Exception as exc:
        logger.warning("email: failed to send activation code to %s: %s", to_email, exc)
