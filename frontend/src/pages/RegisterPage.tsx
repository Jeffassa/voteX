import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, User, UserPlus, Mail, KeyRound, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Brand } from "@/components/Brand";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { extractErrorMessage, extractStatus } from "@/lib/errors";
import { isValidMatricule, MATRICULE_FORMAT_HUMAN, normalizeMatricule } from "@/lib/matricule";

export default function RegisterPage() {
  const [matricule, setMatricule] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const navigate = useNavigate();

  // Calcul visuel de la force du mot de passe
  function getPasswordStrength(pwd: string): { label: string; color: string; width: string } {
    if (!pwd) return { label: "", color: "transparent", width: "0%" };
    if (pwd.length < 8) return { label: "Trop court (min. 8)", color: "var(--danger-500)", width: "25%" };
    
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { label: "Moyen", color: "var(--warning-500)", width: "60%" };
    return { label: "Fort", color: "var(--success-500)", width: "100%" };
  }

  const pwdStrength = getPasswordStrength(password);

  function validate(): string | null {
    if (!matricule.trim()) return "Saisis ton matricule.";
    const m = normalizeMatricule(matricule);
    if (!isValidMatricule(m)) {
      return `Format de matricule invalide. Attendu : ${MATRICULE_FORMAT_HUMAN}`;
    }
    if (!firstName.trim()) return "Saisis ton prénom.";
    if (!lastName.trim()) return "Saisis ton nom de famille.";
    if (!email.trim()) return "Saisis ton email ESATIC ou Gmail.";
    if (!email.endsWith("@esatic.edu.ci") && !email.endsWith("@gmail.com")) return "L'email doit se terminer par @esatic.edu.ci ou @gmail.com";
    if (!activationCode.trim()) return "Saisis ton code d'activation.";
    if (!password) return "Choisis un mot de passe.";
    if (password.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
    if (!confirmPassword) return "Confirme ton mot de passe.";
    if (password !== confirmPassword) return "Les deux mots de passe ne correspondent pas.";
    return null;
  }

  async function requestActivationCode() {
    if (!matricule.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      setErr("Remplis le matricule, le nom, le prénom et l'email d'abord.");
      return;
    }
    if (!email.endsWith("@esatic.edu.ci") && !email.endsWith("@gmail.com")) {
      setErr("L'email doit se terminer par @esatic.edu.ci ou @gmail.com");
      return;
    }
    setErr("");
    setRequestingCode(true);
    try {
      await api.post("/api/auth/request-activation-code", {
        matricule: normalizeMatricule(matricule),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      });
      toast.success("Code envoyé ! Vérifie ta boîte mail.");
      trackEvent("activation_code_requested");
    } catch (e: unknown) {
      const detail = extractErrorMessage(e, "Impossible d'envoyer le code.");
      setErr(detail);
      trackEvent("activation_code_failed");
    } finally {
      setRequestingCode(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      setErr(error);
      return;
    }
    setErr("");
    setSubmitting(true);

    try {
      await api.post("/api/auth/register", {
        matricule: normalizeMatricule(matricule),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        activation_code: activationCode.trim(),
        password,
        confirm_password: confirmPassword,
      });

      toast.success("Compte activé. Connecte-toi maintenant.");
      trackEvent("account_activated");

      navigate("/login", {
        state: { prefilledMatricule: normalizeMatricule(matricule) },
        replace: true,
      });
    } catch (e: unknown) {
      const status = extractStatus(e);
      const detail = extractErrorMessage(e, "Inscription impossible. Réessaie dans un instant.");
      trackEvent("account_activation_failed", { status: status || 0 });

      if (status === 404) {
        setErr(
          "Ce matricule n'existe pas dans le système. Vérifie qu'il a été importé par l'administration."
        );
      } else if (status === 409) {
        setErr(detail.includes("activé") ? detail : "Ce compte est déjà activé. Va sur la page de connexion.");
      } else if (status === 400 || status === 422 || status === 403) {
        setErr(detail);
      } else if (!status) {
        setErr("Impossible de joindre le serveur. Vérifie ta connexion internet.");
      } else {
        setErr(detail);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const matriculeFormatOk = matricule === "" || isValidMatricule(normalizeMatricule(matricule));

  return (
    <div
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
            Inscription
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
            Activez votre compte
            <br />
            étudiant ESATIC.
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
            Votre matricule a été ajouté par l'administration. Saisissez-le avec
            votre nom complet pour définir votre mot de passe et accéder à la
            plateforme de vote.
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
            <ShieldCheck size={16} style={{ color: "var(--orange-400)" }} /> Processus de vérification en 2 étapes
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
        <div style={{ width: "100%", maxWidth: 440, textAlign: "left" }}>
          <Link
            to="/login"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 20, marginLeft: -10 }}
          >
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "var(--navy-900)",
              margin: 0,
              textAlign: "left",
            }}
          >
            Créer mon compte
          </h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 8, textAlign: "left" }}>
            Saisissez votre matricule ESATIC et demandez votre code.
          </p>

          <form
            onSubmit={submit}
            style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}
          >
            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Matricule ESATIC</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <User size={16} />
                </span>
                <input
                  required
                  className="input has-icon mono"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="22-ESATIC0273DN"
                  style={{
                    borderColor: !matriculeFormatOk ? "var(--danger-500)" : undefined,
                  }}
                />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4, textAlign: "left" }}>
                Format : {MATRICULE_FORMAT_HUMAN}
              </div>
            </div>

            <div className="row gap-3">
              <div style={{ flex: 1 }}>
                <label className="label" style={{ textAlign: "left", display: "block" }}>Prénom</label>
                <input
                  required
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Sékou"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ textAlign: "left", display: "block" }}>Nom</label>
                <input
                  required
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Bamba"
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Email ESATIC ou Gmail</label>
              <div className="row gap-2">
                <div className="input-wrap" style={{ flex: 1 }}>
                  <span className="input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    required
                    type="email"
                    className="input has-icon"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@esatic.edu.ci"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={requestActivationCode}
                  disabled={requestingCode}
                  style={{ height: "42px", minWidth: "120px" }}
                >
                  {requestingCode ? "Envoi..." : "Obtenir le code"}
                </button>
              </div>
            </div>

            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Code d'activation</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <KeyRound size={16} />
                </span>
                <input
                  required
                  className="input has-icon mono"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  placeholder="CODE REÇU PAR EMAIL"
                />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4, textAlign: "left" }}>
                Saisis le code secret envoyé à ton adresse email.
              </div>
            </div>

            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Mot de passe</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Lock size={16} />
                </span>
                <input
                  required
                  type={show ? "text" : "password"}
                  className="input has-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="Au moins 8 caractères"
                />
                <button
                  type="button"
                  className="input-suffix-btn"
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Indicateur visuel de la force du mot de passe */}
              {password && (
                <div style={{ marginTop: 6 }}>
                  <div
                    style={{
                      height: 4,
                      width: "100%",
                      background: "var(--border)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: pwdStrength.width,
                        background: pwdStrength.color,
                        transition: "width 0.3s ease, background 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: pwdStrength.color,
                      marginTop: 4,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    Force du mot de passe : {pwdStrength.label}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label" style={{ textAlign: "left", display: "block" }}>Confirmer le mot de passe</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Lock size={16} />
                </span>
                <input
                  required
                  type={show ? "text" : "password"}
                  className="input has-icon"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  placeholder="Répète ton mot de passe"
                />
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

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={submitting}
              style={{ marginTop: 6 }}
            >
              {submitting ? (
                "Activation…"
              ) : (
                <>
                  <UserPlus size={18} /> Activer mon compte <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 6 }}>
              Vous avez déjà un compte ?{" "}
              <Link to="/login" style={{ color: "var(--orange-600)", textDecoration: "underline" }}>
                Connectez-vous
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
