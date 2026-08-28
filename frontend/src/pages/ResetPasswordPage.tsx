import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

import { Brand } from "@/components/Brand";
import { useConfirmPasswordReset } from "@/lib/queries";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
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
