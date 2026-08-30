import { useState } from "react";
import { FileSpreadsheet, MoreVertical, Pencil, Plus, Search, Shield, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { Avatar, getInitials } from "@/components/Avatar";
import { ImportStudentsModal } from "@/components/ImportStudentsModal";
import { Modal } from "@/components/Modal";
import {
  useChangeRole,
  useClasses,
  useCreateStudent,
  useDeleteStudent,
  useMe,
  useStudents,
  useUpdateStudent,
  type AdminStudent,
} from "@/lib/queries";
import { usePendingStudents, useActivateStudent } from "@/lib/queries/admin";
import type { UserRole } from "@/types/api";

export default function StudentsPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [classFilter, setClassFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: classes } = useClasses();
  const { data: me } = useMe();
  const { data: students, isLoading } = useStudents({
    class_id: classFilter || undefined,
    search: search || undefined,
  });
  
  const { data: pendingStudents, isLoading: isLoadingPending } = usePendingStudents();
  const activateStudent = useActivateStudent();

  const classMap = new Map(classes?.map((c) => [c.id, `${c.level} ${c.name}`]) || []);
  const isSuper = me?.role === "super_admin";

  const handleActivate = async (id: string) => {
    try {
      await activateStudent.mutateAsync(id);
      toast.success("Étudiant activé avec succès ! Un e-mail lui a été envoyé.");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'activation");
    }
  };

  return (
    <div ref={pageRef} style={{ padding: "40px 40px 80px" }} onClick={() => setOpenMenuId(null)}>
      <div className="row items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Administration</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Étudiants</h1>
        </div>
        <div className="row gap-2">
          <button className="btn btn-outline" onClick={() => setImporting(true)}>
            <FileSpreadsheet size={16} /> Importer Excel
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Inscrire un étudiant
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        <button 
          className={`btn ${activeTab === "all" ? "btn-primary" : "btn-ghost"}`} 
          onClick={() => setActiveTab("all")}
        >
          Tous les étudiants
        </button>
        <button 
          className={`btn ${activeTab === "pending" ? "btn-primary" : "btn-ghost"}`} 
          onClick={() => setActiveTab("pending")}
          style={{ position: "relative" }}
        >
          Salle d'attente
          {pendingStudents && pendingStudents.length > 0 && (
            <span style={{ 
              position: "absolute", top: -5, right: -5, 
              background: "var(--danger-500)", color: "white", 
              borderRadius: "50%", padding: "2px 6px", fontSize: 10, fontWeight: "bold" 
            }}>
              {pendingStudents.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "all" && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row gap-3">
            <div className="input-wrap" style={{ flex: 1 }}>
              <span className="input-icon"><Search size={16} /></span>
              <input
                className="input has-icon"
                placeholder="Matricule, nom ou email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{ width: 280 }}
            >
              <option value="">Toutes les classes</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.level} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 120px 220px 100px 140px 100px 60px",

            gap: 16,
            padding: "14px 20px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11, fontWeight: 600, color: "var(--ink-500)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          <div>Étudiant</div>
          <div>Matricule</div>
          <div>Email</div>
          <div>Statut</div>
          <div>Classe</div>
          <div>Rôle</div>
          <div />
        </div>

        {(activeTab === "all" ? isLoading : isLoadingPending) && (
          <div style={{ padding: 20 }}>
            <div className="skel" style={{ height: 56, marginBottom: 8 }} />
            <div className="skel" style={{ height: 56 }} />
          </div>
        )}

        {activeTab === "all" && !isLoading && students?.length === 0 && (
          <div className="text-center muted" style={{ padding: 56 }}>
            Aucun étudiant trouvé.
          </div>
        )}

        {activeTab === "pending" && !isLoadingPending && pendingStudents?.length === 0 && (
          <div className="text-center muted" style={{ padding: 56 }}>
            Aucun étudiant en attente.
          </div>
        )}

        {activeTab === "all" && students?.map((s) => (
          <StudentRow
            key={s.id}
            s={s}
            classLabel={s.class_id ? classMap.get(s.class_id) || "—" : "—"}
            isMe={me?.id === s.id}
            canChangeRole={!!isSuper && me?.id !== s.id}
            menuOpen={openMenuId === s.id}
            onToggleMenu={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === s.id ? null : s.id);
            }}
            onEdit={() => {
              setEditing(s);
              setOpenMenuId(null);
            }}
          />
        ))}

        {activeTab === "pending" && pendingStudents?.map((s) => (
          <div key={s.id} style={{
            display: "grid", gridTemplateColumns: "200px 120px 220px 100px 140px auto",
            gap: 16, padding: "14px 20px", minHeight: "56px", alignItems: "center",
            borderBottom: "1px solid var(--border)", fontSize: 14
          }}>
            <div className="row items-center gap-3">
              <Avatar initials={getInitials(s.first_name, s.last_name)} size={36} color="#0A2540" src={s.photo_url || undefined} />
              <div style={{ fontWeight: 500, color: "var(--navy-900)" }}>
                {s.first_name} {s.last_name}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink-700)" }}>{s.matricule}</div>
            <div style={{ fontSize: 13, color: "var(--ink-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
            <div>
              <div className="badge" style={{ background: "var(--orange-100)", color: "var(--orange-800)", padding: "2px 6px", borderRadius: "4px", fontSize: 11 }}>
                En attente
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{s.class_id ? classMap.get(s.class_id) || "—" : "—"}</div>
            <div style={{ textAlign: "right" }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleActivate(s.id)} disabled={activateStudent.isPending}>
                <UserCheck size={14} /> Autoriser
              </button>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CreateStudentModal
          classes={classes || []}
          defaultClassId={classFilter}
          onClose={() => setCreating(false)}
        />
      )}
      {importing && <ImportStudentsModal onClose={() => setImporting(false)} />}
      {editing && (
        <EditStudentModal
          student={editing}
          classes={classes || []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface RowProps {
  s: AdminStudent;
  classLabel: string;
  isMe: boolean;
  canChangeRole: boolean;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onEdit: () => void;
}

function StudentRow({ s, classLabel, isMe, canChangeRole, menuOpen, onToggleMenu, onEdit }: RowProps) {
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const changeRole = useChangeRole();

  async function toggleActive() {
    try {
      await updateStudent.mutateAsync({ id: s.id, patch: { is_active: !s.is_active } });
      toast.success(s.is_active ? "Compte désactivé" : "Compte réactivé");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  async function remove() {
    if (!confirm(`Supprimer ${s.first_name} ${s.last_name} ?\n\nSi cet étudiant a déjà voté, il sera désactivé au lieu d'être supprimé (préservation de l'intégrité du vote).`))
      return;
    try {
      await deleteStudent.mutateAsync(s.id);
      toast.success("Étudiant retiré");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  async function promote(role: UserRole) {
    try {
      await changeRole.mutateAsync({ id: s.id, role });
      toast.success(`Rôle modifié → ${role}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  const opacity = s.is_active ? 1 : 0.55;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 120px 220px 100px 140px 100px 60px",
        gap: 16,
        padding: "14px 20px",
        minHeight: "56px",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        fontSize: 14,
        opacity,
        position: "relative",
      }}
    >
      <div className="row items-center gap-3">
        <Avatar
          initials={getInitials(s.first_name, s.last_name)}
          size={36}
          color="#0A2540"
          src={s.photo_url || undefined}
        />
        <div style={{ fontWeight: 500, color: "var(--navy-900)" }}>
          {s.first_name} {s.last_name}
          {isMe && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>(vous)</span>}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13, color: "var(--ink-700)" }}>{s.matricule}</div>
      <div style={{ fontSize: 13, color: "var(--ink-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
      <div>
        <div className="badge" style={{ background: s.is_active ? "var(--green-100)" : "var(--red-100)", color: s.is_active ? "var(--green-800)" : "var(--red-800)", padding: "2px 6px", borderRadius: "4px", fontSize: 11 }}>
          {s.is_active ? "Activé" : "Inactif"}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{classLabel}</div>
      <div>
        <span className={`badge ${s.role === "super_admin" ? "badge-orange" : s.role === "admin" ? "badge-navy" : "badge-closed"}`}>
          {s.role === "super_admin" ? "Super" : s.role === "admin" ? "Admin" : "Étudiant"}
        </span>
      </div>
      <div style={{ position: "relative", textAlign: "right" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleMenu}
          title="Actions"
          style={{ padding: 4 }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", right: 0, top: 32, zIndex: 50,
              background: "white", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)",
              minWidth: 200, padding: 4, fontSize: 13,
            }}
          >
            <MenuItem icon={<Pencil size={14} />} label="Modifier" onClick={onEdit} />
            <MenuItem
              icon={s.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
              label={s.is_active ? "Désactiver" : "Réactiver"}
              onClick={toggleActive}
            />
            {canChangeRole && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                {s.role !== "admin" && (
                  <MenuItem
                    icon={<Shield size={14} />}
                    label="Promouvoir Admin"
                    onClick={() => promote("admin")}
                  />
                )}
                {s.role !== "student" && (
                  <MenuItem
                    icon={<ShieldOff size={14} />}
                    label="Rétrograder Étudiant"
                    onClick={() => promote("student")}
                  />
                )}
              </>
            )}
            {!isMe && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <MenuItem
                  icon={<Trash2 size={14} />}
                  label="Supprimer"
                  onClick={remove}
                  danger
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px",
        background: "transparent", border: 0,
        borderRadius: 6,
        color: danger ? "var(--danger-600)" : "var(--ink-900)",
        fontSize: 13, textAlign: "left",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "var(--danger-50)" : "var(--navy-50)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}

function CreateStudentModal({
  classes, defaultClassId, onClose,
}: {
  classes: NonNullable<ReturnType<typeof useClasses>["data"]>;
  defaultClassId: string;
  onClose: () => void;
}) {
  const [matricule, setMatricule] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("student12345");
  const [classId, setClassId] = useState(defaultClassId || "");
  const create = useCreateStudent();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        matricule: matricule.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        class_id: classId || undefined,
      });
      toast.success("Étudiant inscrit");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'inscription");
    }
  }

  return (
    <Modal open onClose={onClose} width={560}>
      <form onSubmit={submit} style={{ padding: 28 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--navy-900)" }}>
          Inscrire un étudiant
        </h3>

        <div className="col gap-3" style={{ marginTop: 20 }}>
          <div className="row gap-3">
            <div style={{ flex: 1 }}>
              <label className="label">Prénom</label>
              <input required className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Nom</label>
              <input required className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Matricule ESATIC</label>
            <input required className="input mono" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="20240412" />
          </div>
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@esatic.ci" />
          </div>
          <div>
            <label className="label">Mot de passe initial</label>
            <input required className="input mono" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>L'étudiant pourra le changer à sa première connexion.</div>
          </div>
          <div>
            <label className="label">Classe</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Aucune classe</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.level} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row gap-3" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending} style={{ flex: 1 }}>
            {create.isPending ? "Inscription…" : "Inscrire"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditStudentModal({
  student, classes, onClose,
}: {
  student: AdminStudent;
  classes: NonNullable<ReturnType<typeof useClasses>["data"]>;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [email, setEmail] = useState(student.email);
  const [classId, setClassId] = useState(student.class_id || "");
  const update = useUpdateStudent();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: student.id,
        patch: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          class_id: classId || null,
        },
      });
      toast.success("Étudiant mis à jour");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  return (
    <Modal open onClose={onClose} width={560}>
      <form onSubmit={submit} style={{ padding: 28 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--navy-900)" }}>
          Modifier {student.first_name} {student.last_name}
        </h3>
        <p className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>
          {student.matricule} (matricule non modifiable)
        </p>

        <div className="col gap-3" style={{ marginTop: 20 }}>
          <div className="row gap-3">
            <div style={{ flex: 1 }}>
              <label className="label">Prénom</label>
              <input required className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Nom</label>
              <input required className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Classe</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Aucune classe</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.level} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row gap-3" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={update.isPending} style={{ flex: 1 }}>
            {update.isPending ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
