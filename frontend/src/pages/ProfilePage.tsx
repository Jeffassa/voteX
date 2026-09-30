import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Lock, Mail, Save, User } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Avatar, getInitials } from "@/components/Avatar";
import { useChangePassword, useMe, useUpdateMyProfile } from "@/lib/queries";

export default function ProfilePage() {
  // Fiche de profil : cartes révélées de haut en bas.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *" });
  const { data: me } = useMe();
  const navigate = useNavigate();

  return (
    <div>
      <AppHeader />
      <div ref={pageRef} className="container container-narrow scene" style={{ padding: "40px 32px 80px" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16, marginLeft: -10 }}
        >
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="row items-center gap-4" style={{ marginBottom: 32 }}>
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)} name={`${me?.first_name ?? ""} ${me?.last_name ?? ""}`}
            size={64}
            color="#0A2540"
            src={me?.photo_url || undefined}
          />
          <div>
            <h1 className="h-title" style={{ margin: 0 }}>
              {me?.first_name} {me?.last_name}
            </h1>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              <span className="mono">{me?.matricule}</span>
              {me?.classroom && <> · {me.classroom.level} {me.classroom.name}</>}
            </div>
          </div>
        </div>

        <ProfileForm />
        <EmailForm />
        <PasswordForm />
      </div>
    </div>
  );
}

function ProfileForm() {
  const { data: me } = useMe();
  const update = useUpdateMyProfile();
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    if (me) setPhotoUrl(me.photo_url || "");
  }, [me]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Matricule, nom et prénom viennent de l'import administratif : le
      // serveur les refuse ici (schemas/student.py). On ne les envoie pas.
      await update.mutateAsync({ photo_url: photoUrl.trim() || undefined });
      toast.success("Profil mis à jour");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row items-center gap-2" style={{ marginBottom: 18 }}>
        <User size={18} aria-hidden="true" style={{ color: "var(--ink-500)" }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink-900)" }}>
          Informations personnelles
        </h2>
      </div>

      <div className="col gap-3">
        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label className="label" htmlFor="profile-first">Prénom</label>
            <input id="profile-first" className="input" value={me?.first_name ?? ""} readOnly disabled />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label className="label" htmlFor="profile-last">Nom</label>
            <input id="profile-last" className="input" value={me?.last_name ?? ""} readOnly disabled />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="profile-matricule">Matricule (identifiant de connexion)</label>
          <input id="profile-matricule" className="input mono" value={me?.matricule ?? ""} readOnly disabled />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Matricule, nom et prénom proviennent du fichier de l'école. Pour une correction,
            contactez l'administration.
          </div>
        </div>

        <div>
          <label className="label" htmlFor="profile-photo">URL de la photo (facultatif)</label>
          <input id="profile-photo"
            className="input"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-primary" disabled={update.isPending}>
          <Save size={16} aria-hidden="true" />
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/**
 * Changement d'adresse e-mail.
 *
 * L'adresse ouvre la connexion Google et reçoit les liens de réinitialisation :
 * la nouvelle reste en attente jusqu'au clic sur le lien envoyé, et le serveur
 * exige le mot de passe actuel (une session restée ouverte ne suffit pas).
 */
function EmailForm() {
  const { data: me } = useMe();
  const update = useUpdateMyProfile();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setErr("Saisissez une adresse e-mail valide.");
      return;
    }
    if (me?.email && address.toLowerCase() === me.email.toLowerCase()) {
      setErr("C'est déjà l'adresse de votre compte.");
      return;
    }
    if (!password) {
      setErr("Saisissez votre mot de passe actuel.");
      return;
    }
    setErr("");
    try {
      await update.mutateAsync({ email: address, current_password: password });
      toast.success(`Lien de confirmation envoyé à ${address}.`, { duration: 6000 });
      setNewEmail("");
      setPassword("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Impossible de modifier l'adresse.");
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad" style={{ marginBottom: 16 }} noValidate>
      <div className="row items-center gap-2" style={{ marginBottom: 14 }}>
        <Mail size={18} aria-hidden="true" style={{ color: "var(--ink-500)" }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink-900)" }}>Adresse e-mail</h2>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-700)" }}>
        Adresse actuelle : <strong style={{ color: "var(--ink-900)" }}>{me?.email || "aucune"}</strong>
      </p>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
        Elle sert à vous connecter avec Google et à recevoir vos reçus et liens de réinitialisation.
      </p>

      {me?.pending_email && (
        <div
          role="status"
          className="row items-center gap-2"
          style={{
            marginTop: 14, padding: "10px 12px", borderRadius: "var(--r-md)",
            background: "var(--warn-50)", color: "var(--warn-600)", fontSize: 13,
          }}
        >
          <Clock size={15} aria-hidden="true" />
          <span>
            En attente de confirmation : <strong>{me.pending_email}</strong>. Cliquez sur le lien
            reçu à cette adresse.
          </span>
        </div>
      )}

      <div className="col gap-3" style={{ marginTop: 16 }}>
        <div>
          <label className="label" htmlFor="profile-new-email">Nouvelle adresse</label>
          <input id="profile-new-email"
            type="email"
            className="input"
            autoComplete="email"
            maxLength={255}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="prenom.nom@gmail.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="profile-email-password">Mot de passe actuel</label>
          <input id="profile-email-password"
            type="password"
            className="input"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {err && (
        <div role="alert" className="field-error" style={{ marginTop: 12, fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <button type="submit" className="btn btn-outline" disabled={update.isPending}>
          {update.isPending ? "Envoi…" : "Envoyer le lien de confirmation"}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErr("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("La confirmation ne correspond pas.");
      return;
    }
    setErr("");
    try {
      await change.mutateAsync({ old_password: oldPassword, new_password: newPassword });
      toast.success("Mot de passe changé");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Erreur");
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad">
      <div className="row items-center gap-2" style={{ marginBottom: 18 }}>
        <Lock size={18} style={{ color: "var(--ink-500)" }} />
        <div style={{ fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.01em" }}>
          Changer le mot de passe
        </div>
      </div>

      <div className="col gap-3">
        <div>
          <label className="label" htmlFor="profile-f6">Ancien mot de passe</label>
          <input id="profile-f6"
            required
            type="password"
            className="input"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div className="row gap-3">
          <div style={{ flex: 1 }}>
            <label className="label" htmlFor="profile-f7">Nouveau mot de passe</label>
            <input id="profile-f7"
              required
              type="password"
              className="input"
              autoComplete="new-password"
              maxLength={128}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label" htmlFor="profile-f8">Confirmer</label>
            <input id="profile-f8"
              required
              type="password"
              className="input"
              autoComplete="new-password"
              maxLength={128}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
            />
          </div>
        </div>
      </div>

      {err && (
        <div role="alert"
          className="row items-center gap-2"
          style={{
            marginTop: 16, padding: "10px 12px",
            background: "var(--danger-50)", color: "var(--danger-600)",
            borderRadius: "var(--r-md)", fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-primary" disabled={change.isPending}>
          {change.isPending ? "Modification…" : "Modifier le mot de passe"}
        </button>
      </div>
    </form>
  );
}
