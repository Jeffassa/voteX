import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

import { Brand } from "@/components/Brand";
import { useRequestPasswordReset } from "@/lib/queries";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const request = useRequestPasswordReset();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await request.mutateAsync({ email });
    } finally {
      // Toujours afficher l'écran de succès, même si l'email n'existe pas
      // (anti-énumération)
      setSent(true);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        padding: 24, background: "var(--bg)",
      }}
    >
      <div className="card card-pad" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <Brand />
        </div>

        {sent ? (
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
            <h1
              style={{
                fontSize: 22, fontWeight: 600, color: "var(--navy-900)",
                margin: "0 0 8px", letterSpacing: "-0.02em",
              }}
            >
              Email envoyé
            </h1>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
              Si un compte existe avec l'adresse <strong>{email}</strong>, un lien
              de réinitialisation a été envoyé. Le lien expire dans 30 minutes.
            </p>
            <Link to="/login" className="btn btn-outline" style={{ marginTop: 24 }}>
              <ArrowLeft size={16} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1
              style={{
                fontSize: 24, fontWeight: 600, color: "var(--navy-900)",
                margin: "0 0 8px", letterSpacing: "-0.025em",
              }}
            >
              Mot de passe oublié ?
            </h1>
            <p className="muted" style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.55 }}>
              Entre l'email associé à ton compte ESATIC SmartVote. Tu recevras un
              lien pour choisir un nouveau mot de passe.
            </p>

            <div>
              <label className="label">Email</label>
              <div className="input-wrap">
                <span className="input-icon"><Mail size={16} /></span>
                <input
                  required
                  type="email"
                  className="input has-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@esatic.ci"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={request.isPending}
              style={{ width: "100%", marginTop: 16 }}
            >
              {request.isPending ? "Envoi…" : "Envoyer le lien"}
            </button>

            <Link
              to="/login"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12, width: "100%" }}
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
