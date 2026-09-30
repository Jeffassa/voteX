import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock, User } from "lucide-react";
import toast from "react-hot-toast";

import { Brand } from "@/components/Brand";
import { useReveal } from "@/hooks/useReveal";
import { Honeypot } from "@/components/Honeypot";
import { GOOGLE_ERRORS, GoogleSignInButton } from "@/components/GoogleSignInButton";
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
  // Retour d'une connexion Google refusée : /login?erreur=google_…
  const googleError = new URLSearchParams(location.search).get("erreur");
  const [err, setErr] = useState(googleError ? GOOGLE_ERRORS[googleError] ?? "" : "");
  const [website, setWebsite] = useState("");
  // Champ en faute, pour y placer le focus et l'annoncer aux lecteurs d'écran.
  const [errField, setErrField] = useState<"matricule" | "password" | null>(null);

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
      setErrField("matricule");
      document.getElementById("login-f1")?.focus();
      return;
    }
    if (!password) {
      setErr("Saisis ton mot de passe.");
      setErrField("password");
      document.getElementById("login-f2")?.focus();
      return;
    }

    setErr("");
    setErrField(null);
    try {
      const data = await login.mutateAsync({ matricule: cleanedMatricule, password, website });
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
        <div className="sv-auth-tagline" style={{ position: "relative", marginTop: "auto", maxWidth: 440, textAlign: "left" }}>
          <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Élections des chefs de classe
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.78)", lineHeight: 1.6, marginTop: 14 }}>
            Connectez-vous pour voter dans l'élection de votre classe.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "grid", gap: 10 }}>
            {["Votre choix reste secret", "Un reçu pour vérifier votre bulletin", "Résultats publiés à la clôture"].map((t) => (
              <li key={t} className="row items-center gap-2" style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                <Check size={16} aria-hidden="true" style={{ color: "var(--orange-400)" }} /> {t}
              </li>
            ))}
          </ul>
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
              color: "var(--ink-900)",
              margin: 0,
              textAlign: "left",
            }}
          >
            Connexion
          </h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 8, textAlign: "left" }}>
            Utilisez votre matricule ESATIC.
          </p>

          <form
            onSubmit={submit}
            noValidate
            style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 18, textAlign: "left" }}
          >
            <div>
              <label className="label" htmlFor="login-f1" style={{ textAlign: "left", display: "block" }}>Matricule</label>
              <div className="input-wrap">
                <span className="input-icon"><User size={16} /></span>
                <input id="login-f1"
                  name="username"
                  required
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={32}
                  aria-invalid={errField === "matricule"}
                  aria-describedby={err ? "login-error" : undefined}
                  className="input has-icon mono"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="22-ESATIC0273DN"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="login-f2" style={{ textAlign: "left", display: "block" }}>Mot de passe</label>
              <div className="input-wrap">
                <span className="input-icon"><Lock size={16} /></span>
                <input id="login-f2"
                  name="password"
                  required
                  autoComplete="current-password"
                  maxLength={128}
                  aria-invalid={errField === "password"}
                  aria-describedby={err ? "login-error" : undefined}
                  className="input has-icon"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="input-suffix-btn"
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={show}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {err && (
              <div role="alert"
                id="login-error"
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
                <AlertCircle size={16} aria-hidden="true" /> {err}
              </div>
            )}

            <Honeypot value={website} onChange={setWebsite} />

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

            <GoogleSignInButton />
          </form>
        </div>
      </div>

    </div>
  );
}
