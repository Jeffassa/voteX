import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import toast from "react-hot-toast";

import {
  useClasses,
  useCreateElection,
  useElection,
  useUpdateElection,
} from "@/lib/queries";

function isoFromLocal(value: string): string {
  return new Date(value).toISOString();
}

function localFromIso(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function defaultEnd(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  d.setDate(d.getDate() + 2);
  d.setHours(18, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

interface Props {
  mode: "create" | "edit";
}

export default function ElectionFormPage({ mode }: Props) {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: classes } = useClasses();
  const { data: existing } = useElection(mode === "edit" ? id : undefined);

  const createElection = useCreateElection();
  const updateElection = useUpdateElection();

  const [title, setTitle] = useState(mode === "edit" ? "" : "Chef de classe — ");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [endsAt, setEndsAt] = useState(defaultEnd());

  useEffect(() => {
    if (mode === "edit" && existing) {
      setTitle(existing.title);
      setDescription(existing.description || "");
      setClassId(existing.class_id);
      setStartsAt(localFromIso(existing.starts_at));
      setEndsAt(localFromIso(existing.ends_at));
    }
  }, [mode, existing]);

  const isEditingLocked =
    mode === "edit" && existing && existing.status !== "draft";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      toast.error("Sélectionnez une classe");
      return;
    }
    try {
      if (mode === "create") {
        const created = await createElection.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          class_id: classId,
          starts_at: isoFromLocal(startsAt),
          ends_at: isoFromLocal(endsAt),
        });
        toast.success("Élection créée");
        navigate(`/admin/elections/${created.id}`);
      } else if (id) {
        await updateElection.mutateAsync({
          id,
          patch: {
            title: title.trim(),
            description: description.trim() || null,
            class_id: classId,
            starts_at: isoFromLocal(startsAt),
            ends_at: isoFromLocal(endsAt),
          },
        });
        toast.success("Élection mise à jour");
        navigate(`/admin/elections/${id}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  const pending = createElection.isPending || updateElection.isPending;

  return (
    <div ref={pageRef} style={{ padding: "40px 40px 80px", maxWidth: 720 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(mode === "edit" && id ? `/admin/elections/${id}` : "/admin/elections")}
        style={{ marginBottom: 16, marginLeft: -10 }}
      >
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="h-eyebrow">
        {mode === "create" ? "Nouvelle élection" : "Modifier l'élection"}
      </div>
      <h1 className="h-title" style={{ marginTop: 8 }}>
        {mode === "create" ? "Configurer le scrutin" : title || "Modification"}
      </h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        {mode === "create"
          ? "L'élection sera créée en brouillon. Tu pourras ajouter les candidats puis l'ouvrir pour démarrer le scrutin."
          : "Les modifications ne sont possibles qu'en mode brouillon."}
      </p>

      {isEditingLocked && (
        <div
          className="card card-pad"
          style={{
            background: "var(--warn-50)",
            borderColor: "#FCD34D",
            color: "#92400E",
            marginTop: 16,
            fontSize: 13,
          }}
        >
          Cette élection est en statut <strong>{existing?.status}</strong> et ne peut plus être modifiée.
        </div>
      )}

      <form onSubmit={submit} className="card card-pad" style={{ marginTop: 24 }}>
        <fieldset disabled={!!isEditingLocked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="col gap-4">
            <div>
              <label className="label">Titre</label>
              <input
                required
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Chef de classe — L3 Génie Logiciel"
              />
            </div>

            <div>
              <label className="label">Description (optionnel)</label>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Élection 2026 du chef de classe…"
                style={{ resize: "vertical", minHeight: 80 }}
              />
            </div>

            <div>
              <label className="label">Classe concernée</label>
              <select
                required
                className="input"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Sélectionner une classe…</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.level} {c.name} — {c.field}
                  </option>
                ))}
              </select>
            </div>

            <div className="row gap-4">
              <div style={{ flex: 1 }}>
                <label className="label">Début du scrutin</label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Fin du scrutin</label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="row gap-3" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/admin/elections")}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pending || !!isEditingLocked}
                style={{ flex: 1 }}
              >
                <Save size={16} />
                {pending
                  ? "Enregistrement…"
                  : mode === "create"
                  ? "Créer l'élection"
                  : "Enregistrer"}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
