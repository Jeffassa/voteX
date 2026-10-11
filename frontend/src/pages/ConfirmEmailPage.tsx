import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Brand } from "@/components/Brand";
import { api } from "@/lib/api";
import { extractErrorMessage } from "@/lib/errors";
import { authKeys } from "@/lib/queries/auth";

/**
 * Arrivée depuis le lien « Confirmer mon adresse ».
 *
 * Le jeton est dans le fragment (#token=…) et non dans la requête : le
 * fragment n'est envoyé à aucun serveur, il n'apparaît donc ni dans les
 * journaux ni dans l'en-tête Referer.
 */
export default function ConfirmEmailPage() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; message?: string; email?: string }>({
    status: "loading",
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setState({ status: "error", message: "Ce lien est incomplet. Ouvrez-le directement depuis l'e-mail reçu." });
      return;
    }
    // Retire le jeton de la barre d'adresse et de l'historique.
    window.history.replaceState(null, "", window.location.pathname);
    api
      .post<{ email: string }>("/api/auth/email/confirm", { token })
      .then(({ data }) => {
        setState({ status: "ok", email: data.email });
        queryClient.invalidateQueries({ queryKey: authKeys.me });
      })
      .catch((e) => setState({ status: "error", message: extractErrorMessage(e, "Confirmation impossible.") }));
  }, [queryClient]);

  return (
    <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card card-pad" style={{ maxWidth: 460, width: "100%" }}>
        <Brand />
        {state.status === "loading" && (
          <p role="status" className="muted" style={{ marginTop: 24 }}>Confirmation de votre adresse…</p>
        )}
        {state.status === "ok" && (
          <div role="status" style={{ marginTop: 24 }}>
            <CheckCircle2 size={28} aria-hidden="true" style={{ color: "var(--success-600)" }} />
            <h1 style={{ fontSize: 22, margin: "12px 0 8px", color: "var(--ink-900)" }}>Adresse confirmée</h1>
            <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 }}>
              <strong>{state.email}</strong> est maintenant l'adresse de votre compte. Vous pouvez
              l'utiliser pour vous connecter avec Google.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: 20 }}>
              Aller à la connexion
            </Link>
          </div>
        )}
        {state.status === "error" && (
          <div role="alert" style={{ marginTop: 24 }}>
            <AlertCircle size={28} aria-hidden="true" style={{ color: "var(--danger-600)" }} />
            <h1 style={{ fontSize: 22, margin: "12px 0 8px", color: "var(--ink-900)" }}>Lien non valable</h1>
            <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 }}>{state.message}</p>
            <Link to="/profile" className="btn btn-outline" style={{ marginTop: 20 }}>
              Mon profil
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
