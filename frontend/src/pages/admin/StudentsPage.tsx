import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSpreadsheet, Pencil, Plus, Search, Shield, ShieldOff, Trash2, UserCheck, UserX, Users } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { EmptyState, MenuItem, MenuSeparator, PageHeader, RowMenu, Segmented, useDebounced } from "@/components/admin/AdminUI";
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
import { usePendingStudents, useActivateStudent, useRejectClaim } from "@/lib/queries/admin";
import type { UserRole } from "@/types/api";

/** Plafond de la liste côté serveur (GET /api/students/, limit=200). */
const LIST_LIMIT = 200;

const ROLE_BADGE: Record<UserRole, { label: string; badge: string }> = {
  super_admin: { label: "Super admin", badge: "badge-orange" },
  admin: { label: "Admin", badge: "badge-navy" },
  student: { label: "Étudiant", badge: "badge-muted" },
};

type View = "all" | "pending";

export default function StudentsPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const [params, setParams] = useSearchParams();
  const view: View = params.get("vue") === "attente" ? "pending" : "all";
  const setView = (v: View) => setParams(v === "pending" ? { vue: "attente" } : {}, { replace: true });
  const [classFilter, setClassFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  // Une requête par frappe interrogeait le serveur à chaque lettre.
  const query = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<AdminStudent | null>(null);

  const { data: classes } = useClasses();
  const { data: me } = useMe();
  const { data: students, isLoading } = useStudents({
    class_id: classFilter || undefined,
    search: query || undefined,
  });

  const { data: pendingStudents, isLoading: isLoadingPending } = usePendingStudents();
  const activateStudent = useActivateStudent();
  const rejectClaim = useRejectClaim();

  const classMap = new Map(classes?.map((c) => [c.id, `${c.level} ${c.name}`]) || []);
  const classOf = (id: string | null) => (id ? classMap.get(id) || "Sans classe" : "Sans classe");
  const isSuper = me?.role === "super_admin";
  const pendingCount = pendingStudents?.length ?? 0;

  const handleActivate = async (id: string) => {
    try {
      await activateStudent.mutateAsync(id);
      toast.success("Étudiant activé avec succès ! Un e-mail lui a été envoyé.");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'activation");
    }
  };

  /**
   * Refuse la revendication et rend le compte revendicable.
   *
   * La confirmation n'est pas une politesse : refuser à tort renvoie
   * l'étudiant légitime à la case départ. Le nom rappelé dans la question
   * évite le clic sur la mauvaise ligne.
   */
  const handleReject = async (id: string, label: string) => {
    if (!window.confirm(
      `Refuser la demande de ${label} ?

` +
      "Le compte redeviendra revendicable : personne ne le détiendra, et le " +
      "titulaire pourra recommencer son inscription."
    )) return;
    try {
      await rejectClaim.mutateAsync(id);
      toast.success("Demande refusée. Le compte est de nouveau revendicable.");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors du refus");
    }
  };

  const loading = view === "all" ? isLoading : isLoadingPending;
  const rows = view === "all" ? students ?? [] : pendingStudents ?? [];
  const truncated = view === "all" && rows.length >= LIST_LIMIT;
  const filtered = !!(query || classFilter);

  return (
    <div ref={pageRef} className="sv-admin-page">
      <PageHeader
        title="Étudiants"
        subtitle="Liste électorale : inscriptions, classes et droits d'administration."
        actions={
          <>
            <button className="btn btn-outline" onClick={() => setImporting(true)}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Importer Excel
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Inscrire un étudiant
            </button>
          </>
        }
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="sv-toolbar">
          <Segmented
            label="Vue"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "Tous les étudiants" },
              { value: "pending", label: "Salle d'attente", count: pendingCount, alert: true },
            ]}
          />
          {view === "all" ? (
            <>
              <div className="input-wrap sv-search">
                <span className="input-icon"><Search size={16} aria-hidden="true" /></span>
                <input
                  type="search"
                  aria-label="Rechercher par matricule, nom ou e-mail"
                  className="input has-icon"
                  placeholder="Matricule, nom ou e-mail…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                aria-label="Filtrer par classe"
                className="input"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                style={{ width: 220, flex: "0 1 220px" }}
              >
                <option value="">Toutes les classes</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.level} {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-500)", flex: "1 1 260px" }}>
              Vérifiez chaque demande sur pièce, carte d'étudiant à l'appui, avant d'ouvrir le vote.
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <div className="skel" style={{ height: 52, marginBottom: 8 }} />
            <div className="skel" style={{ height: 52, marginBottom: 8 }} />
            <div className="skel" style={{ height: 52 }} />
          </div>
        ) : rows.length === 0 ? (
          view === "pending" ? (
            <EmptyState icon={<UserCheck size={20} />} title="Personne en attente">
              Les demandes d'accès à valider apparaîtront ici.
            </EmptyState>
          ) : (
            <EmptyState icon={filtered ? <Search size={20} /> : <Users size={20} />} title="Aucun étudiant trouvé">
              {filtered
                ? "Modifiez la recherche ou le filtre de classe."
                : "Inscrivez des étudiants un par un ou importez un fichier Excel."}
            </EmptyState>
          )
        ) : (
          <>
            <div className="sv-table-scroll">
              <table className="sv-table" style={{ minWidth: 820 }}>
                <caption className="sr-only">
                  {view === "all" ? "Étudiants inscrits" : "Demandes en attente de validation"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Étudiant</th>
                    <th scope="col">Matricule</th>
                    <th scope="col">Classe</th>
                    {view === "all" ? (
                      <>
                        <th scope="col">Rôle</th>
                        <th scope="col">Statut</th>
                      </>
                    ) : (
                      <th scope="col">Vérification</th>
                    )}
                    <th scope="col" className="actions"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {view === "all" &&
                    students?.map((s) => (
                      <StudentRow
                        key={s.id}
                        s={s}
                        classLabel={classOf(s.class_id)}
                        isMe={me?.id === s.id}
                        canChangeRole={!!isSuper && me?.id !== s.id}
                        onEdit={() => setEditing(s)}
                      />
                    ))}
                  {view === "pending" &&
                    pendingStudents?.map((s) => (
                      <tr key={s.id}>
                        <td><Identity s={s} /></td>
                        <td className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{s.matricule}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{classOf(s.class_id)}</td>
                        <td>
                          {/* Le libellé dit à l'administrateur ce qu'il doit vérifier :
                              une identité non confirmée se contrôle sur pièce, carte
                              d'étudiant à l'appui, pas au jugé. */}
                          <span className={`badge ${s.identity_verified ? "badge-muted" : "badge-warn"}`}>
                            {s.identity_verified ? "En attente" : "Identité à vérifier"}
                          </span>
                        </td>
                        <td className="actions">
                          <div className="row items-center gap-2" style={{ justifyContent: "flex-end" }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleReject(s.id, `${s.first_name} ${s.last_name}`)}
                              disabled={rejectClaim.isPending || activateStudent.isPending}
                              title="Refuser et libérer le compte"
                            >
                              <UserX size={14} aria-hidden="true" /> Refuser
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleActivate(s.id)}
                              disabled={activateStudent.isPending || rejectClaim.isPending}
                            >
                              <UserCheck size={14} aria-hidden="true" /> Autoriser
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="sv-table-foot">
              {truncated
                ? `Seuls les ${LIST_LIMIT} premiers étudiants, par ordre alphabétique, sont affichés. Recherchez ou filtrez par classe pour trouver les autres.`
                : view === "all"
                  ? `${rows.length} étudiant${rows.length > 1 ? "s" : ""}`
                  : `${rows.length} demande${rows.length > 1 ? "s" : ""}`}
            </div>
          </>
        )}
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

/** Photo ou initiales, nom, et adresse e-mail en dessous. */
function Identity({
  s, isMe,
}: {
  s: { first_name: string; last_name: string; email?: string | null; photo_url?: string | null };
  isMe?: boolean;
}) {
  return (
    <div className="row items-center gap-3" style={{ minWidth: 0 }}>
      <Avatar
        initials={getInitials(s.first_name, s.last_name)}
        name={`${s.first_name ?? ""} ${s.last_name ?? ""}`}
        size={34}
        color="#0A2540"
        src={s.photo_url || undefined}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: "var(--navy-900)" }}>
          {s.first_name} {s.last_name}
          {isMe && <span className="badge badge-muted" style={{ marginLeft: 8, padding: "1px 8px", fontSize: 11 }}>vous</span>}
        </div>
        <div className="sv-truncate" style={{ fontSize: 12, color: s.email ? "var(--ink-500)" : "var(--ink-400)", maxWidth: 300 }}>
          {s.email || "Pas d'adresse e-mail"}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  s: AdminStudent;
  classLabel: string;
  isMe: boolean;
  canChangeRole: boolean;
  onEdit: () => void;
}

function StudentRow({ s, classLabel, isMe, canChangeRole, onEdit }: RowProps) {
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const changeRole = useChangeRole();
  const name = `${s.first_name} ${s.last_name}`;

  async function toggleActive() {
    try {
      await updateStudent.mutateAsync({ id: s.id, patch: { is_active: !s.is_active } });
      toast.success(s.is_active ? "Compte désactivé" : "Compte réactivé");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  async function remove() {
    if (!confirm(`Supprimer ${name} ?\n\nSi cet étudiant a déjà voté, il sera désactivé au lieu d'être supprimé (préservation de l'intégrité du vote).`))
      return;
    try {
      await deleteStudent.mutateAsync(s.id);
      toast.success("Étudiant retiré");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  async function promote(role: UserRole) {
    // Donner ou retirer des droits d'administration se confirme, le nom de la
    // personne sous les yeux : le menu est à un clic de la ligne voisine.
    const question =
      role === "admin"
        ? `Donner les droits d'administration à ${name} ?\n\nCette personne pourra gérer les élections, les classes et la liste électorale.`
        : `Retirer les droits d'administration de ${name} ?`;
    if (!confirm(question)) return;
    try {
      await changeRole.mutateAsync({ id: s.id, role });
      toast.success(role === "admin" ? `${name} a désormais les droits d'administration` : `${name} n'a plus les droits d'administration`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  }

  const role = ROLE_BADGE[s.role];

  return (
    <tr>
      <td><Identity s={s} isMe={isMe} /></td>
      <td className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{s.matricule}</td>
      <td style={{ whiteSpace: "nowrap" }}>{classLabel}</td>
      <td><span className={`badge ${role.badge}`}>{role.label}</span></td>
      <td>
        <span className={`badge ${s.is_active ? "badge-success" : "badge-muted"}`}>
          {s.is_active ? "Actif" : "Inactif"}
        </span>
      </td>
      <td className="actions">
        <RowMenu label={`Actions pour ${name}`}>
          {(close) => (
            <>
              <MenuItem icon={<Pencil size={14} />} onSelect={() => { close(); onEdit(); }}>
                Modifier
              </MenuItem>
              <MenuItem
                icon={s.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                onSelect={() => { close(); toggleActive(); }}
              >
                {s.is_active ? "Désactiver le compte" : "Réactiver le compte"}
              </MenuItem>
              {canChangeRole && (
                <>
                  <MenuSeparator />
                  {s.role === "student" && (
                    <MenuItem icon={<Shield size={14} />} onSelect={() => { close(); promote("admin"); }}>
                      Donner les droits d'administration
                    </MenuItem>
                  )}
                  {s.role !== "student" && (
                    <MenuItem icon={<ShieldOff size={14} />} onSelect={() => { close(); promote("student"); }}>
                      Retirer les droits d'administration
                    </MenuItem>
                  )}
                </>
              )}
              {!isMe && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 size={14} />} onSelect={() => { close(); remove(); }} danger>
                    Supprimer
                  </MenuItem>
                </>
              )}
            </>
          )}
        </RowMenu>
      </td>
    </tr>
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
  const [classId, setClassId] = useState(defaultClassId || "");
  const create = useCreateStudent();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const address = email.trim();
      await create.mutateAsync({
        matricule: matricule.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: address || undefined,
        class_id: classId,
      });
      toast.success(
        address
          ? `Compte créé. Le code d'activation a été envoyé à ${address}.`
          : "Compte créé. Sans adresse, l'étudiant passera par la salle d'attente pour l'activer.",
        { duration: 6000 }
      );
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
              <label className="label" htmlFor="students-f1">Prénom</label>
              <input id="students-f1" required className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="students-f2">Nom</label>
              <input id="students-f2" required className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="students-f3">Matricule ESATIC</label>
            <input id="students-f3" required className="input mono" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="22-ESATIC0273DN" />
          </div>
          <div>
            <label className="label" htmlFor="students-f4">E-mail de l'école (facultatif)</label>
            <input id="students-f4" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@esatic.edu.ci" aria-describedby="students-f4-hint" />
            <div id="students-f4-hint" className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Le code d'activation y est envoyé. Aucun mot de passe n'est créé : seul l'étudiant choisit le sien.
            </div>
          </div>
          <div>
            <label className="label" htmlFor="students-f6">Classe</label>
            <select id="students-f6" required className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="" disabled>Choisir une classe</option>
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
  const [email, setEmail] = useState(student.email ?? "");
  const [classId, setClassId] = useState(student.class_id || "");
  const update = useUpdateStudent();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    const emailChanged = address !== "" && address.toLowerCase() !== (student.email ?? "").toLowerCase();
    try {
      const saved = await update.mutateAsync({
        id: student.id,
        patch: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          ...(emailChanged ? { email: address } : {}),
          class_id: classId || null,
        },
      });
      // Compte déjà activé : l'adresse ne change qu'une fois confirmée par
      // son titulaire (elle ouvre la connexion Google et la réinitialisation).
      toast.success(
        emailChanged && saved.pending_email
          ? `Lien de confirmation envoyé à ${saved.pending_email}. L'adresse changera quand son titulaire l'aura confirmée.`
          : "Étudiant mis à jour",
        { duration: emailChanged ? 7000 : 4000 }
      );
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
              <label className="label" htmlFor="students-f7">Prénom</label>
              <input id="students-f7" required className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="students-f8">Nom</label>
              <input id="students-f8" required className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="students-f9">Email</label>
            <input id="students-f9" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="students-f10">Classe</label>
            <select id="students-f10" className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
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
