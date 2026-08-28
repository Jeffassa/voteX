import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Save, User } from "lucide-react";
import toast from "react-hot-toast";

import { AppHeader } from "@/components/AppHeader";
import { Avatar, getInitials } from "@/components/Avatar";
import { useChangePassword, useMe, useUpdateMyProfile } from "@/lib/queries";

export default function ProfilePage() {
  const { data: me } = useMe();
  const navigate = useNavigate();

  return (
    <div>
      <AppHeader />
      <div className="container container-narrow scene" style={{ padding: "40px 32px 80px" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16, marginLeft: -10 }}
        >
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="row items-center gap-4" style={{ marginBottom: 32 }}>
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)}
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
        <PasswordForm />
      </div>
    </div>
  );
}

function ProfileForm() {
  const { data: me } = useMe();
  const update = useUpdateMyProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [matricule, setMatricule] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    if (me) {
      setFirstName(me.first_name);
      setLastName(me.last_name);
      setEmail(me.email);
      setMatricule(me.matricule);
      setPhotoUrl(me.photo_url || "");
    }
  }, [me]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        matricule: matricule.trim(),
        photo_url: photoUrl.trim() || undefined,
      });
      toast.success("Profil mis à jour");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row items-center gap-2" style={{ marginBottom: 18 }}>
        <User size={18} style={{ color: "var(--ink-500)" }} />
        <div style={{ fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.01em" }}>
          Informations personnelles
        </div>
      </div>

      <div className="col gap-3">
        <div className="row gap-3">
          <div style={{ flex: 1 }}>
            <label className="label">Prénom</label>
            <input
              required
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Nom</label>
            <input
              required
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Matricule (Identifiant de connexion)</label>
          <input
            required
            className="input mono"
            value={matricule}
            onChange={(e) => setMatricule(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            required
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label">URL photo (optionnel)</label>
          <input
            className="input"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-primary" disabled={update.isPending}>
          <Save size={16} />
          {update.isPending ? "Sauvegarde…" : "Enregistrer"}
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
          <label className="label">Ancien mot de passe</label>
          <input
            required
            type="password"
            className="input"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div className="row gap-3">
          <div style={{ flex: 1 }}>
            <label className="label">Nouveau mot de passe</label>
            <input
              required
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Confirmer</label>
            <input
              required
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
