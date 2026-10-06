import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Lock, Save } from "lucide-react";
import toast from "react-hot-toast";

import { ELECTION_STATUS, PageHeader } from "@/components/admin/AdminUI";
import { formatDuration } from "@/lib/dates";
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

const STEPS = [
  { title: "Créer le brouillon", text: "Titre, classe et dates du scrutin." },
  { title: "Ajouter les candidats", text: "Au moins deux, choisis parmi les étudiants de la classe." },
  { title: "Ouvrir le scrutin", text: "Les électeurs de la classe votent ; la liste est figée." },
  { title: "Clôturer", text: "Les bulletins sont dépouillés et les résultats publiés." },
];

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

  const [title, setTitle] = useState(mode === "edit" ? "" : "Chef de classe, ");
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

  // La fin doit suivre le début : dit ici, avant l'envoi, plutôt qu'en erreur
  // du serveur après coup.
  const span = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  const badRange = Number.isFinite(span) && span <= 0;
  const backTo = mode === "edit" && id ? `/admin/elections/${id}` : "/admin/elections";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      toast.error("Sélectionnez une classe");
      return;
    }
    if (badRange) {
      toast.error("La fin du scrutin doit suivre son début");
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
    <div ref={pageRef} className="sv-admin-page sv-admin-page-narrow">
      <PageHeader
        back={{ to: backTo, label: mode === "edit" ? "Retour à l'élection" : "Élections" }}
        title={mode === "create" ? "Nouvelle élection" : "Modifier l'élection"}
        subtitle={
          mode === "create"
            ? "L'élection est créée en brouillon. Vous y ajouterez ensuite les candidats, puis vous ouvrirez le scrutin."
            : "Une élection ne se modifie qu'en brouillon, avant l'ouverture du scrutin."
        }
      />

      {isEditingLocked && existing && (
        <div className="sv-callout" style={{ marginBottom: 20, background: "var(--warn-50)", borderColor: "#fcd34d" }}>
          <span className="sv-callout-icon" aria-hidden="true" style={{ background: "#fde68a", color: "var(--warn-600)" }}>
            <Lock size={15} />
          </span>
          <span>
            Cette élection est <strong>{ELECTION_STATUS[existing.status].label.toLowerCase()}</strong> : elle ne peut plus être modifiée.
          </span>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={submit} className="card" style={{ overflow: "hidden" }}>
          <fieldset disabled={!!isEditingLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <section aria-labelledby="ef-info" style={{ padding: 24 }}>
              <h2 id="ef-info" style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>
                Informations
              </h2>
              <div className="col gap-4">
                <div>
                  <label className="label" htmlFor="election-form-f1">Titre</label>
                  <input id="election-form-f1"
                    required
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Chef de classe, L3 Génie Logiciel"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="election-form-f3">Classe concernée</label>
                  <select id="election-form-f3"
                    required
                    className="input"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    aria-describedby="election-form-f3-hint"
                  >
                    <option value="">Sélectionner une classe…</option>
                    {classes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.level} {c.name} ({c.field})
                      </option>
                    ))}
                  </select>
                  <div id="election-form-f3-hint" style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 6 }}>
                    Seuls les étudiants de cette classe pourront voter et se présenter.
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="election-form-f2">
                    Description <span style={{ fontWeight: 400, color: "var(--ink-400)" }}>(facultatif)</span>
                  </label>
                  <textarea id="election-form-f2"
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Élection 2026 du chef de classe…"
                    style={{ resize: "vertical", minHeight: 80 }}
                  />
                </div>
              </div>
            </section>

            <section aria-labelledby="ef-dates" style={{ padding: 24, borderTop: "1px solid var(--border)" }}>
              <h2 id="ef-dates" style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>
                Calendrier
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="election-form-f4">Début du scrutin</label>
                  <input id="election-form-f4"
                    required
                    type="datetime-local"
                    className="input"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="election-form-f5">Fin du scrutin</label>
                  <input id="election-form-f5"
                    required
                    type="datetime-local"
                    className="input"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    aria-invalid={badRange || undefined}
                    aria-describedby="election-form-span"
                  />
                </div>
              </div>
              <div id="election-form-span" aria-live="polite">
                {badRange ? (
                  <div className="field-error" style={{ marginTop: 10 }}>
                    <AlertCircle size={14} aria-hidden="true" /> La fin du scrutin doit suivre son début.
                  </div>
                ) : Number.isFinite(span) ? (
                  <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 10 }}>
                    Durée du scrutin : {formatDuration(span)}.
                  </div>
                ) : null}
              </div>
            </section>

            <div
              className="row items-center gap-3"
              style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--bg)", justifyContent: "flex-end", flexWrap: "wrap" }}
            >
              <button type="button" className="btn btn-outline" onClick={() => navigate(backTo)}>
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pending || !!isEditingLocked || badRange}
              >
                <Save size={16} aria-hidden="true" />
                {pending
                  ? "Enregistrement…"
                  : mode === "create"
                  ? "Créer le brouillon"
                  : "Enregistrer"}
              </button>
            </div>
          </fieldset>
        </form>

        <aside aria-labelledby="ef-steps" className="card" style={{ padding: 20 }}>
          <h2 id="ef-steps" style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>
            Les étapes d'un scrutin
          </h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {STEPS.map((s, i) => {
              const here = mode === "create" ? i === 0 : i === 0 && !isEditingLocked;
              return (
                <li key={s.title} className="row" style={{ gap: 12 }} aria-current={here ? "step" : undefined}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 24, height: 24, borderRadius: 3, flexShrink: 0, display: "grid", placeItems: "center",
                      fontSize: 12, fontWeight: 600,
                      background: here ? "var(--navy-900)" : "var(--surface-2)",
                      color: here ? "white" : "var(--ink-500)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <span style={{ display: "block", fontWeight: 600, color: "var(--ink-900)" }}>{s.title}</span>
                    <span style={{ color: "var(--ink-500)" }}>{s.text}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
