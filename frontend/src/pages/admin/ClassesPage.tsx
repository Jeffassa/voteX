import { useState } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { EmptyState, PageHeader, Segmented } from "@/components/admin/AdminUI";
import { Modal } from "@/components/Modal";
import {
  useClasses,
  useCreateClass,
  useDeleteClass,
  useUpdateClass,
} from "@/lib/queries";
import type { ClassRoom } from "@/types/api";

const LEVEL_ORDER = ["L1", "L2", "L3", "M1", "M2"];

export default function ClassesPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const { data: classes, isLoading } = useClasses();
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [creating, setCreating] = useState(false);
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");

  const all = classes ?? [];
  // Niveaux connus d'abord, dans l'ordre du cursus ; un niveau inattendu suit.
  const levels = Array.from(new Set(all.map((c) => c.level))).sort(
    (a, b) => (LEVEL_ORDER.indexOf(a) + 1 || 99) - (LEVEL_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b)
  );
  const q = search.trim().toLowerCase();
  const list = all.filter(
    (c) =>
      (level === "all" || c.level === level) &&
      (!q || c.name.toLowerCase().includes(q) || c.field.toLowerCase().includes(q))
  );

  return (
    <div ref={pageRef} className="sv-admin-page sv-admin-page-narrow">
      <PageHeader
        title="Classes"
        subtitle={
          classes
            ? `${all.length} classe${all.length > 1 ? "s" : ""} sur ${levels.length} niveau${levels.length > 1 ? "x" : ""}. Chaque élection vise une classe.`
            : undefined
        }
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> Nouvelle classe
          </button>
        }
      />

      <div className="card" style={{ overflow: "hidden" }}>
        {all.length > 0 && (
          <div className="sv-toolbar">
            <Segmented
              label="Filtrer par niveau"
              value={level}
              onChange={setLevel}
              options={[
                { value: "all", label: "Tous", count: all.length },
                ...levels.map((l) => ({ value: l, label: l, count: all.filter((c) => c.level === l).length })),
              ]}
            />
            <div className="input-wrap sv-search">
              <span className="input-icon"><Search size={16} aria-hidden="true" /></span>
              <input
                type="search"
                aria-label="Rechercher une classe"
                className="input has-icon"
                placeholder="Nom ou filière…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: 16 }}>
            <div className="skel" style={{ height: 48, marginBottom: 8 }} />
            <div className="skel" style={{ height: 48 }} />
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={20} />}
            title="Aucune classe"
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                <Plus size={14} aria-hidden="true" /> Créer la première
              </button>
            }
          >
            Créez les classes une à une, ou laissez l'import Excel des étudiants les créer pour vous.
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState icon={<Search size={20} />} title="Aucune classe ne correspond">
            Changez de niveau ou de recherche.
          </EmptyState>
        ) : (
          <div className="sv-table-scroll">
            <table className="sv-table" style={{ minWidth: 520 }}>
              <caption className="sr-only">Classes</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 90 }}>Niveau</th>
                  <th scope="col">Classe</th>
                  <th scope="col">Filière</th>
                  <th scope="col" className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <ClassRow key={c.id} c={c} onEdit={() => setEditing(c)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <ClassFormModal onClose={() => setCreating(false)} />}
      {editing && <ClassFormModal classroom={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClassRow({ c, onEdit }: { c: ClassRoom; onEdit: () => void }) {
  const deleteClass = useDeleteClass();
  const label = `${c.level} ${c.name}`;

  async function remove() {
    if (!confirm(`Supprimer la classe "${label}" ?\n\nLa classe doit être vide (pas d'étudiants ni d'élections).`))
      return;
    try {
      await deleteClass.mutateAsync(c.id);
      toast.success("Classe supprimée");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  }

  return (
    <tr>
      <td><span className="badge badge-navy">{c.level}</span></td>
      <td className="sv-cell-title" style={{ fontWeight: 500 }}>{c.name}</td>
      <td style={{ color: c.field === c.name ? "var(--ink-400)" : undefined }}>{c.field}</td>
      <td className="actions">
        <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-icon" onClick={onEdit} title="Modifier" aria-label={`Modifier la classe ${label}`}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            className="btn btn-ghost btn-icon danger"
            onClick={remove}
            disabled={deleteClass.isPending}
            title="Supprimer"
            aria-label={`Supprimer la classe ${label}`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ClassFormModal({
  classroom, onClose,
}: {
  classroom?: ClassRoom;
  onClose: () => void;
}) {
  const [name, setName] = useState(classroom?.name || "");
  const [level, setLevel] = useState(classroom?.level || "L3");
  const [field, setField] = useState(classroom?.field || "");

  const create = useCreateClass();
  const update = useUpdateClass();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (classroom) {
        await update.mutateAsync({
          id: classroom.id,
          patch: { name: name.trim(), level: level.trim(), field: field.trim() },
        });
        toast.success("Classe mise à jour");
      } else {
        await create.mutateAsync({
          name: name.trim(),
          level: level.trim(),
          field: field.trim(),
        });
        toast.success("Classe créée");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Modal open onClose={onClose} width={520}>
      <form onSubmit={submit} style={{ padding: 28 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--navy-900)" }}>
          {classroom ? `Modifier ${classroom.level} ${classroom.name}` : "Nouvelle classe"}
        </h3>

        <div className="col gap-3" style={{ marginTop: 20 }}>
          <div className="row gap-3">
            <div style={{ width: 120 }}>
              <label className="label" htmlFor="classes-f1">Niveau</label>
              <select id="classes-f1"
                required
                className="input"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option>L1</option>
                <option>L2</option>
                <option>L3</option>
                <option>M1</option>
                <option>M2</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="classes-f2">Nom court</label>
              <input id="classes-f2"
                required
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Génie Logiciel"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="classes-f3">Filière (libellé long)</label>
            <input id="classes-f3"
              required
              className="input"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Génie Logiciel"
            />
          </div>
        </div>

        <div className="row gap-3" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ flex: 1 }}>
            {pending ? "Sauvegarde…" : classroom ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
