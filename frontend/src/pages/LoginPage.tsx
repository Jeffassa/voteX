import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, QrCode, User, X, AlertCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Brand } from "@/components/Brand";
import { useReveal } from "@/hooks/useReveal";
import { Modal } from "@/components/Modal";
import { trackEvent } from "@/lib/analytics";
import { extractErrorMessage, extractStatus } from "@/lib/errors";
import { useLogin } from "@/lib/queries";

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefilledMatricule =
    (location.state as { prefilledMatricule?: string } | null)?.prefilledMatricule || "";

  // Révèle les deux panneaux l'un après l'autre : le regard suit la page de
  // gauche à droite, jusqu'au champ de saisie qui reçoit le focus.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });

  const [matricule, setMatricule] = useState(prefilledMatricule);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (prefilledMatricule) {
      const t = setTimeout(() => {
        const passwordInput = document.querySelector<HTMLInputElement>("input[type=password]");
        passwordInput?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [prefilledMatricule]);

  const login = useLogin();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedMatricule = matricule.trim();

    if (!cleanedMatricule) {
      setErr("Saisis ton matricule pour te connecter.");
      return;
    }
    if (!password) {
      setErr("Saisis ton mot de passe.");
      return;
    }
    if (password.length < 4) {
      setErr("Le mot de passe doit faire au moins 4 caractères.");
      return;
    }

    setErr("");
    try {
      const data = await login.mutateAsync({ matricule: cleanedMatricule, password });
      toast.success("Connexion réussie");
      trackEvent("login_success", { role: data.role });
      navigate(data.role === "student" ? "/" : "/admin");
    } catch (e: unknown) {
      const status = extractStatus(e);
      const detail = extractErrorMessage(e, "Une erreur est survenue. Réessaie dans un instant.");
      trackEvent("login_failed", { status: status || 0 });

      if (status === 401 || status === 403) {
        setErr(detail);
      } else if (status === 429) {
        setErr("Trop de tentatives. Patiente une minute avant de réessayer.");
      } else if (status === 422) {
        setErr(detail);
      } else if (!status) {
        setErr("Impossible de joindre le serveur. Vérifie ta connexion internet.");
      } else {
        setErr(detail);
      }
    }
  }

  return (
    <div
      ref={pageRef}
      className="scene sv-auth-split"
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--surface)",
      }}
    >
      {/* Panneau latéral gauche */}
      <div
        className="sv-auth-side"
        style={{
          background: "var(--navy-900)",
          color: "white",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div style={{ position: "relative" }}>
          <Brand />
        </div>
        <div className="sv-auth-tagline" style={{ position: "relative", marginTop: "auto", maxWidth: 460, textAlign: "left" }}>
          <div className="h-eyebrow" style={{ color: "var(--orange-400)", textAlign: "left" }}>
            Élection en cours
          </div>
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              marginTop: 14,
              textAlign: "left",
            }}
          >
            Votre voix scellée
            <br />
            sur la blockchain.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.6,
              marginTop: 18,
              textAlign: "left",
            }}
          >
            Connectez-vous avec votre matricule ESATIC pour participer à l'élection
            du chef de classe de votre promotion.
          </p>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              gap: 12,
              alignItems: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <ShieldCheck size={16} style={{ color: "var(--orange-400)" }} /> Connexion chiffrée & authentifiée — TLS 1.3
          </div>
        </div>
      </div>

      {/* Formulaire centré avec alignement texte à gauche */}
      <div
        className="sv-auth-form"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420, textAlign: "left" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/")}
            style={{ marginBottom: 24, marginLeft: -10 }}
          >
            <ArrowLeft size={14} /> Retour à l'accueil
          </button>

          <h1
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "var(--navy-900)",
              margin: 0,
              textAlign: "left",
            }}
          >
            Connexion étudiant
          </h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 8, textAlign: "left" }}>
            Utilisez votre matricule ESATIC.
          </p>

          <form
            onSubmit={submit}
            style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 18, textAlign: "left" }}
          >
            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Matricule</label>
              <div className="input-wrap">
                <span className="input-icon"><User size={16} /></span>
                <input
                  className="input has-icon mono"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="22-ESATIC0273DN"
                />
              </div>
            </div>
            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Mot de passe</label>
              <div className="input-wrap">
                <span className="input-icon"><Lock size={16} /></span>
                <input
                  className="input has-icon"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {err && (
              <div
                className="row items-center gap-2"
                style={{
                  padding: "12px 14px",
                  background: "var(--danger-50)",
                  color: "var(--danger-600)",
                  borderRadius: "var(--r-md)",
                  fontSize: 13,
                  border: "1px solid var(--danger-200)",
                  textAlign: "left",
                }}
              >
                <AlertCircle size={16} /> {err}
              </div>
            )}

            <button className="btn btn-primary btn-lg" type="submit" disabled={login.isPending}>
              {login.isPending ? "Authentification…" : (<>Se connecter <ArrowRight size={16} /></>)}
            </button>

            <div style={{ textAlign: "center", marginTop: 4 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 13, color: "var(--ink-500)", textDecoration: "underline" }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <div
              style={{
                textAlign: "center", marginTop: 12, paddingTop: 16,
                borderTop: "1px solid var(--border)",
              }}
            >
              <span className="muted" style={{ fontSize: 13 }}>
                Première connexion ?{" "}
              </span>
              <Link
                to="/register"
                style={{
                  fontSize: 13, color: "var(--orange-600)",
                  fontWeight: 500, textDecoration: "underline",
                }}
              >
                Activer mon compte étudiant
              </Link>
            </div>

            <div
              className="row items-center gap-3"
              style={{ margin: "8px 0", color: "var(--ink-400)", fontSize: 12 }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              ou
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <button
              type="button"
              className="btn btn-outline btn-lg"
              onClick={() => setScanning(true)}
            >
              <QrCode size={18} /> Scanner mon QR code étudiant
            </button>
          </form>
        </div>
      </div>

      {/* Modal QR Code */}
      <Modal open={scanning} onClose={() => setScanning(false)} width={420}>
        <div style={{ padding: 28 }}>
          <div className="row items-center justify-between" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
              Scanner votre carte
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setScanning(false)}>
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              aspectRatio: "1", background: "#0F172A",
              borderRadius: "var(--r-lg)",
              position: "relative", overflow: "hidden",
              display: "grid", placeItems: "center",
            }}
          >
            <QrCode size={48} strokeWidth={1.4} style={{ color: "rgba(255,255,255,0.3)" }} />
            <div
              style={{
                position: "absolute", inset: 30,
                border: "2px solid var(--orange-500)", borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
              }}
            />
            <div
              style={{
                position: "absolute", left: 30, right: 30, top: "50%",
                height: 2, background: "var(--orange-500)",
                boxShadow: "0 0 12px var(--orange-500)",
                animation: "sv-scan 2.6s ease-in-out infinite",
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}>
            Présentez le QR code au dos de votre carte d'étudiant.
          </p>
        </div>
      </Modal>
    </div>
  );
}
