import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { Brand } from "@/components/Brand";
import { useConfirmPasswordReset } from "@/lib/queries";

/**
 * Récupère le jeton du lien reçu par e-mail, puis l'efface de l'URL.
 *
 * Il arrive dans le FRAGMENT (`#token=…`) : un fragment n'est pas transmis au
 * serveur, il ne se retrouve donc ni dans les journaux d'accès ni dans un
 * en-tête Referer. On le retire ensuite de la barre d'adresse — sans quoi il
 * resterait visible et consultable dans l'historique du navigateur, sur une
 * machine potentiellement partagée.
 *
 * La query string reste acceptée en repli, le temps que les liens déjà envoyés
 * expirent (trente minutes).
 */
let cachedToken: string | null = null;

function readResetToken(): string {
  // Mémorisé au niveau du module : React StrictMode monte deux fois en
  // développement, et la seconde lecture arriverait après le nettoyage de
  // l'URL — l'utilisateur verrait « lien invalide » avec un lien valide.
  if (cachedToken !== null) return cachedToken;
  if (typeof window === "undefined") return "";

  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  const fromQuery = new URLSearchParams(window.location.search).get("token");
  cachedToken = fromHash || fromQuery || "";

  if (cachedToken) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return cachedToken;
}

export default function ResetPasswordPage() {
  // Carte unique et centrée : une entrée sobre suffit.
  const pageRef = useReveal<HTMLDivElement>({ rise: 14 });
  // Lu une seule fois : l'URL est nettoyée dans la foulée.
  const [token] = useState(readResetToken);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const confirmReset = useConfirmPasswordReset();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setErr("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setErr("");
    try {
      await confirmReset.mutateAsync({ token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Lien invalide ou expiré");
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 420, textAlign: "center" }}>
          <AlertCircle size={32} style={{ color: "var(--danger-500)", margin: "0 auto 12px" }} />
          <h2 style={{ margin: 0, color: "var(--navy-900)" }}>Lien invalide</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
            Le lien de réinitialisation est incomplet. Demande un nouveau lien.
          </p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ marginTop: 16 }}>
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        padding: 24, background: "var(--bg)",
      }}
    >
      <div className="card card-pad" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <Brand />
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 64, height: 64, margin: "0 auto 20px",
                borderRadius: "50%", background: "var(--success-50)",
                display: "grid", placeItems: "center", color: "var(--success-500)",
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--navy-900)", margin: "0 0 8px" }}>
              Mot de passe modifié !
            </h1>
            <p className="muted" style={{ fontSize: 14 }}>
              Redirection vers la page de connexion…
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1
              style={{
                fontSize: 24, fontWeight: 600, color: "var(--navy-900)",
                margin: "0 0 8px", letterSpacing: "-0.025em",
              }}
            >
              Nouveau mot de passe
            </h1>
            <p className="muted" style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.55 }}>
              Choisis un mot de passe d'au moins 8 caractères.
            </p>

            <div className="col gap-3">
              <div>
                <label className="label">Nouveau mot de passe</label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock size={16} /></span>
                  <input
                    required
                    type={show ? "text" : "password"}
                    className="input has-icon"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="input-suffix-btn"
                    onClick={() => setShow((s) => !s)}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirmer le mot de passe</label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock size={16} /></span>
                  <input
                    required
                    type={show ? "text" : "password"}
                    className="input has-icon"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            {err && (
              <div
                className="row items-center gap-2"
                style={{
                  marginTop: 16, padding: "10px 12px",
                  background: "var(--danger-50)", color: "var(--danger-600)",
                  borderRadius: "var(--r-md)", fontSize: 13,
                }}
              >
                <AlertCircle size={16} /> {err}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={confirmReset.isPending}
              style={{ width: "100%", marginTop: 20 }}
            >
              {confirmReset.isPending ? "Modification…" : "Modifier le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
