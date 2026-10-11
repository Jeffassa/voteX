import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { Brand } from "@/components/Brand";
import { Stamp } from "@/components/SecurityPattern";
import { Honeypot } from "@/components/Honeypot";
import { useRequestPasswordReset } from "@/lib/queries";

export default function ForgotPasswordPage() {
  // Carte unique et centrée : une entrée sobre suffit.
  const pageRef = useReveal<HTMLDivElement>({ rise: 14 });
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [website, setWebsite] = useState("");
  const request = useRequestPasswordReset();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await request.mutateAsync({ email: email.trim(), website });
    } finally {
      // Toujours afficher l'écran de succès, même si l'email n'existe pas
      // (anti-énumération)
      setSent(true);
    }
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

        {sent ? (
          <div style={{ textAlign: "center" }}>
            {/* Un cachet postal plutôt qu'une coche dans un rond. */}
            <div style={{ margin: "8px 0 26px" }}>
              <Stamp small style={{ color: "var(--navy-700)" }}>Envoyé</Stamp>
            </div>
            <h1
              style={{
                fontSize: 28, fontWeight: 560, color: "var(--navy-900)",
                margin: "0 0 8px",
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
                fontSize: 30, fontWeight: 560, color: "var(--navy-900)",
                margin: "0 0 8px",
              }}
            >
              Mot de passe oublié ?
            </h1>
            <p className="muted" style={{ fontSize: 14, marginBottom: 24, lineHeight: 1.55 }}>
              Entre l'email associé à ton compte ESATIC SmartVote. Tu recevras un
              lien pour choisir un nouveau mot de passe.
            </p>

            <div>
              <label className="label" htmlFor="forgot-password-f1">Email</label>
              <div className="input-wrap">
                <span className="input-icon"><Mail size={16} /></span>
                <input id="forgot-password-f1"
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={255}
                  className="input has-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@esatic.ci"
                />
              </div>
            </div>

            <Honeypot value={website} onChange={setWebsite} />

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
