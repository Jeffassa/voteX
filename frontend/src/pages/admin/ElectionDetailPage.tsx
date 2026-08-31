import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Lock, Pencil, Plus, Search, Trash2, Unlock, Users } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import {
  useCandidates,
  useCreateCandidate,
  useDeleteElection,
  useElection,
  useNonVoters,
  useSetElectionStatus,
  useStudents,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { candidateKeys } from "@/lib/queries";
import { colorFor, fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate, Election } from "@/types/api";

export default function ElectionDetailPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: election } = useElection(id);
  const { data: candidates } = useCandidates(id);
  const setStatus = useSetElectionStatus();
  const deleteElection = useDeleteElection();

  const [adding, setAdding] = useState(false);

  const handleDelete = async () => {
    if (!election) return;
    if (
      !confirm(
        `Supprimer définitivement l'élection « ${election.title} » ?\n\nCette action est irréversible. Les candidats associés seront aussi retirés.`
      )
    )
      return;
    try {
      await deleteElection.mutateAsync(election.id);
      toast.success("Élection supprimée");
      navigate("/admin/elections");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  };

  const colored = useMemo(
    () =>
      (candidates || []).map((c, i) => ({ ...c, color: colorFor(i) })),
    [candidates]
  );

  const handleStatus = async (status: "open" | "closed") => {
    if (!election) return;
    if (status === "open" && (candidates || []).length < 2) {
      toast.error("Ajoutez au moins 2 candidats avant d'ouvrir le scrutin");
      return;
    }
    try {
      await setStatus.mutateAsync({ id: election.id, status });
      toast.success(
        status === "open" ? "Scrutin ouvert — scellement on-chain en cours" : "Scrutin clôturé"
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Action impossible");
    }
  };

  if (!election) {
    return (
      <div style={{ padding: 40 }}>
        <div className="skel" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div ref={pageRef} style={{ padding: "40px 40px 80px" }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate("/admin/elections")}
        style={{ marginBottom: 16, marginLeft: -10 }}
      >
        <ArrowLeft size={14} /> Retour aux élections
      </button>

      <ElectionHeader
        election={election}
        onStatus={handleStatus}
        onEdit={() => navigate(`/admin/elections/${election.id}/edit`)}
        onDelete={handleDelete}
        pending={setStatus.isPending || deleteElection.isPending}
      />

      <div className="row items-center justify-between" style={{ marginTop: 36, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--navy-900)", margin: 0 }}>
          Candidats ({colored.length})
        </h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setAdding(true)}
          disabled={election.status !== "draft"}
          title={
            election.status !== "draft"
              ? "On ne peut ajouter de candidats qu'en mode brouillon"
              : ""
          }
        >
          <Plus size={14} /> Ajouter un candidat
        </button>
      </div>

      {colored.length === 0 ? (
        <div className="card card-pad text-center muted">
          Aucun candidat enregistré pour cette élection.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {colored.map((c) => (
            <CandidateRow
              key={c.id}
              c={c}
              canDelete={election.status === "draft"}
            />
          ))}
        </div>
      )}

      {(election.status === "open" || election.status === "closed") && (
        <NonVotersPanel electionId={election.id} classId={election.class_id} />
      )}

      {adding && (
        <AddCandidateModal
          election={election}
          existingStudentIds={new Set((candidates || []).map((c) => c.student.id))}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function ElectionHeader({
  election, onStatus, onEdit, onDelete, pending,
}: {
  election: Election;
  onStatus: (s: "open" | "closed") => void;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "28px 32px",
          background: "linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 100%)",
          color: "white",
        }}
      >
        <div className="row items-center gap-2" style={{ marginBottom: 12 }}>
          <span className={`badge ${
            election.status === "open" ? "badge-open" :
            election.status === "draft" ? "badge-draft" :
            election.status === "closed" ? "badge-closed" : "badge-navy"
          }`}>
            {election.status === "open" && <span className="dot" />}
            {election.status === "open" ? "Ouvert" :
             election.status === "draft" ? "Brouillon" :
             election.status === "closed" ? "Fermé" : "Publié"}
          </span>
          {election.blockchain_id !== null && (
            <span className="badge" style={{ background: "rgba(255,122,0,0.18)", color: "#FFB066" }}>
              On-chain #{election.blockchain_id}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.025em" }}>
          {election.title}
        </h1>
        {election.description && (
          <p style={{ marginTop: 8, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            {election.description}
          </p>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.6)" }} className="mono">
          {new Date(election.starts_at).toLocaleString("fr-FR")} → {new Date(election.ends_at).toLocaleString("fr-FR")}
        </div>
      </div>

      <div
        style={{
          padding: "16px 32px",
          background: "var(--surface-2)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {election.status === "draft" && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onEdit}
              disabled={pending}
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onDelete}
              disabled={pending}
              style={{ color: "var(--danger-600)" }}
            >
              <Trash2 size={14} /> Supprimer
            </button>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-primary"
              onClick={() => onStatus("open")}
              disabled={pending}
            >
              <Unlock size={16} /> Ouvrir le scrutin
            </button>
          </>
        )}
        {election.status === "open" && (
          <button
            className="btn btn-outline"
            onClick={() => onStatus("closed")}
            disabled={pending}
          >
            <Lock size={16} /> Clôturer le scrutin
          </button>
        )}
        {election.status === "closed" && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onDelete}
            disabled={pending}
            style={{ color: "var(--danger-600)" }}
          >
            <Trash2 size={14} /> Supprimer définitivement
          </button>
        )}
      </div>
    </div>
  );
}

function CandidateRow({
  c, canDelete,
}: {
  c: Candidate & { color: string };
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!confirm(`Retirer ${fullNameOf(c.student)} de cette élection ?`)) return;
    setRemoving(true);
    try {
      await api.delete(`/api/candidates/${c.id}`);
      queryClient.invalidateQueries({ queryKey: candidateKeys.byElection(c.election_id) });
      toast.success("Candidat retiré");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="card card-pad" style={{ position: "relative" }}>
      <div className="row items-center gap-3">
        <Avatar
          initials={initialsOf(c.student.first_name, c.student.last_name)}
          size={48}
          color={c.color}
          src={c.student.photo_url || c.photo_url || undefined}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 15 }}>
            {fullNameOf(c.student)}
          </div>
          <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>
            {c.student.matricule}
          </div>
        </div>
        {canDelete && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={remove}
            disabled={removing}
            title="Retirer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {c.slogan && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            background: "var(--surface-2)",
            borderRadius: "var(--r-sm)",
            borderLeft: `3px solid ${c.color}`,
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--ink-700)",
          }}
        >
          « {c.slogan} »
        </div>
      )}
    </div>
  );
}

function NonVotersPanel({ electionId, classId }: { electionId: string; classId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "voted" | "not_voted">("all");
  
  const { data: nonVoters, isLoading: loadingNonVoters } = useNonVoters(electionId, true);
  const { data: students, isLoading: loadingStudents } = useStudents({ class_id: classId });

  const studentsWithStatus = useMemo(() => {
    if (!students) return [];
    const nonVoterIds = new Set(nonVoters?.map((s) => s.id) || []);
    
    return students.map((s) => ({
      ...s,
      hasVoted: !nonVoterIds.has(s.id),
    }));
  }, [students, nonVoters]);

  const filtered = useMemo(() => {
    let list = studentsWithStatus;
    
    if (filter === "voted") {
      list = list.filter((s) => s.hasVoted);
    } else if (filter === "not_voted") {
      list = list.filter((s) => !s.hasVoted);
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.matricule.toLowerCase().includes(q) ||
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [studentsWithStatus, filter, search]);

  const isLoading = loadingNonVoters || loadingStudents;
  const count = studentsWithStatus.length;
  const votedCount = studentsWithStatus.filter(s => s.hasVoted).length;

  return (
    <div style={{ marginTop: 36 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 20px",
          background: "var(--surface-2)",
          border: `1px solid var(--border)`,
          borderRadius: "var(--r-md)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--surface-3, rgba(0,0,0,0.06))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Users size={18} color="var(--ink-500)" />
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--navy-900)" }}>
            Statut des votes des étudiants
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
            {votedCount} sur {count} ont voté
          </div>
        </div>
        <ChevronDown size={18} color="var(--ink-500)" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div
          className="card"
          style={{
            marginTop: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderTop: "none",
            padding: 0,
            overflow: "hidden",
            animation: "sv-fade-in 0.2s ease",
          }}
        >
          {/* Controls */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface-2)",
                borderRadius: "var(--r-sm)",
                padding: "6px 12px",
                flex: 1,
              }}
            >
              <Search size={14} color="var(--ink-400)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou matricule…"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--ink-800)",
                }}
              />
            </div>
            
            <select
              className="input"
              style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">Tous</option>
              <option value="voted">Ont voté</option>
              <option value="not_voted">N'ont pas voté</option>
            </select>
          </div>

          {isLoading ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>
              Aucun étudiant trouvé.
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 140px 100px",
                  padding: "8px 16px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-400)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--border)",
                  position: "sticky",
                  top: 0,
                  background: "var(--surface-1, white)",
                  zIndex: 1,
                }}
              >
                <span />
                <span>Nom</span>
                <span>Matricule</span>
                <span>Statut</span>
              </div>

              {filtered.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 140px 100px",
                    padding: "10px 16px",
                    alignItems: "center",
                    borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Avatar
                    initials={initialsOf(s.first_name, s.last_name)}
                    size={32}
                    color="#94A3B8"
                    src={s.photo_url || undefined}
                  />
                  <div style={{ fontWeight: 500, fontSize: 14, color: "var(--navy-900)" }}>
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    {s.matricule}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: s.hasVoted
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(245,158,11,0.12)",
                      color: s.hasVoted ? "#15803D" : "#B45309",
                    }}
                  >
                    {s.hasVoted ? "A voté" : "N'a pas voté"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddCandidateModal({
  election, existingStudentIds, onClose,
}: {
  election: Election;
  existingStudentIds: Set<string>;
  onClose: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [slogan, setSlogan] = useState("");
  const [program, setProgram] = useState("");
  const [bio, setBio] = useState("");
  const [search, setSearch] = useState("");

  const { data: students } = useStudents({
    class_id: election.class_id,
    search: search || undefined,
  });

  const eligibleStudents = (students || []).filter(
    (s) => s.role === "student" && !existingStudentIds.has(s.id)
  );

  const createCandidate = useCreateCandidate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      toast.error("Sélectionnez un étudiant");
      return;
    }
    try {
      await createCandidate.mutateAsync({
        election_id: election.id,
        student_id: studentId,
        slogan: slogan.trim() || null,
        program: program.trim() || null,
        biography: bio.trim() || null,
      });
      toast.success("Candidat ajouté");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  }

  return (
    <Modal open onClose={onClose} width={560}>
      <form onSubmit={submit} style={{ padding: 28 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--navy-900)" }}>
          Ajouter un candidat
        </h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          L'étudiant doit appartenir à la classe de l'élection.
        </p>

        <div className="col gap-3" style={{ marginTop: 20 }}>
          <div>
            <label className="label">Rechercher un étudiant</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Matricule ou nom…"
            />
          </div>

          <div>
            <label className="label">Étudiant</label>
            <select
              required
              className="input"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Sélectionner…</option>
              {eligibleStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.matricule})
                </option>
              ))}
            </select>
            {eligibleStudents.length === 0 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Aucun étudiant disponible dans cette classe.
              </div>
            )}
          </div>

          <div>
            <label className="label">Slogan (optionnel)</label>
            <input
              className="input"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Une voix qui porte, des actes qui comptent."
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Programme — une ligne par point</label>
            <textarea
              className="input"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              rows={3}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>

          <div>
            <label className="label">Biographie (optionnel)</label>
            <textarea
              className="input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>
        </div>

        <div className="row gap-3" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createCandidate.isPending}
            style={{ flex: 1 }}
          >
            {createCandidate.isPending ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
