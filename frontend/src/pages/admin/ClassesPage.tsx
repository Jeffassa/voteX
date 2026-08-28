import { useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { Modal } from "@/components/Modal";
import {
  useClasses,
  useCreateClass,
  useDeleteClass,
  useUpdateClass,
} from "@/lib/queries";
import type { ClassRoom } from "@/types/api";

export default function ClassesPage() {
  const { data: classes, isLoading } = useClasses();
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ padding: "40px 40px 80px" }}>
      <div className="row items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Administration</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Classes</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nouvelle classe
        </button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 1fr 80px",
            gap: 16,
            padding: "14px 20px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11, fontWeight: 600, color: "var(--ink-500)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          <div>Niveau</div>
          <div>Nom</div>
          <div>Filière</div>
          <div />
        </div>

        {isLoading && (
          <div style={{ padding: 20 }}>
            <div className="skel" style={{ height: 56, marginBottom: 8 }} />
            <div className="skel" style={{ height: 56 }} />
          </div>
        )}

        {!isLoading && classes?.length === 0 && (
          <div className="text-center muted" style={{ padding: 56 }}>
            <GraduationCap size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>Aucune classe — crée la première.</div>
          </div>
        )}

        {classes?.map((c) => (
          <ClassRow key={c.id} c={c} onEdit={() => setEditing(c)} />
        ))}
      </div>

      {creating && <ClassFormModal onClose={() => setCreating(false)} />}
      {editing && <ClassFormModal classroom={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClassRow({ c, onEdit }: { c: ClassRoom; onEdit: () => void }) {
  const deleteClass = useDeleteClass();

  async function remove() {
    if (!confirm(`Supprimer la classe "${c.level} ${c.name}" ?\n\nLa classe doit être vide (pas d'étudiants ni d'élections).`))
      return;
    try {
      await deleteClass.mutateAsync(c.id);
      toast.success("Classe supprimée");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 1fr 80px",
        gap: 16,
        padding: "14px 20px",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        fontSize: 14,
      }}
    >
      <div>
        <span className="badge badge-navy">{c.level}</span>
      </div>
      <div style={{ fontWeight: 500, color: "var(--navy-900)" }}>{c.name}</div>
      <div style={{ color: "var(--ink-700)" }}>{c.field}</div>
      <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Modifier">
          <Pencil size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={remove}
          disabled={deleteClass.isPending}
          title="Supprimer"
          style={{ color: "var(--danger-600)" }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
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
              <label className="label">Niveau</label>
              <select
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
              <label className="label">Nom court</label>
              <input
                required
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Génie Logiciel"
              />
            </div>
          </div>
          <div>
            <label className="label">Filière (libellé long)</label>
            <input
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
