import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CalendarRange, Check, GraduationCap, Lock, Pencil, Plus, Search, Trash2, Unlock, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { ElectionStatusBadge, EmptyState, Segmented } from "@/components/admin/AdminUI";
import { Avatar } from "@/components/Avatar";
import { askConfirm } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { BrandEcho } from "@/components/SecurityPattern";
import {
  useCandidates,
  useClasses,
  useCreateCandidate,
  useDeleteElection,
  useElection,
  useElectionResults,
  useNonVoters,
  useSetElectionStatus,
  useStudents,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { candidateKeys } from "@/lib/queries";
import { formatDateTime } from "@/lib/dates";
import { fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate, Election } from "@/types/api";

export default function ElectionDetailPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: election } = useElection(id);
  const { data: candidates } = useCandidates(id);
  const { data: classes } = useClasses();
  // Une élection close qui a reçu des votes est conservée (le serveur refuse
  // sa suppression) : on ne propose pas un bouton voué à l'échec.
  const { data: results } = useElectionResults(election?.status === "closed" ? id : undefined, 0);
  const setStatus = useSetElectionStatus();
  const deleteElection = useDeleteElection();

  const [adding, setAdding] = useState(false);

  const handleDelete = async () => {
    if (!election) return;
    if (!(await askConfirm({
      tone: "danger",
      irreversible: true,
      title: "Supprimer l'élection",
      subject: election.title,
      message: "L'élection et ses candidats seront effacés définitivement.",
      confirmLabel: "Supprimer définitivement",
    }))) return;
    try {
      await deleteElection.mutateAsync(election.id);
      toast.success("Élection supprimée");
      navigate("/admin/elections");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  };

  const colored = candidates ?? [];

  const handleStatus = async (status: "open" | "closed") => {
    if (!election) return;
    if (status === "open" && (candidates || []).length < 2) {
      toast.error("Ajoutez au moins 2 candidats avant d'ouvrir le scrutin");
      return;
    }
    // Les deux bascules sont sans retour : ouvrir fige la liste des candidats,
    // clôturer arrête le vote. Un clic égaré ne doit pas suffire.
    const opening = status === "open";
    if (!(await askConfirm({
      irreversible: true,
      eyebrow: "Scrutin",
      title: opening ? "Ouvrir le scrutin" : "Clôturer le scrutin",
      subject: election.title,
      message: opening
        ? "Les électeurs de la classe pourront voter. La liste des candidats et les informations de l'élection ne seront plus modifiables."
        : "Plus personne ne pourra voter. Les bulletins reçus seront dépouillés et les résultats publiés.",
      confirmLabel: opening ? "Ouvrir le scrutin" : "Clôturer le scrutin",
    }))) return;
    try {
      await setStatus.mutateAsync({ id: election.id, status });
      toast.success(
        status === "open" ? "Scrutin ouvert" : "Scrutin clôturé"
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Action impossible");
    }
  };

  if (!election) {
    return (
      <div className="sv-admin-page">
        <div className="skel" style={{ height: 28, width: 160, marginBottom: 16 }} />
        <div className="skel" style={{ height: 220 }} />
      </div>
    );
  }

  const isDraft = election.status === "draft";

  return (
    <div ref={pageRef} className="sv-admin-page sv-admin-page-narrow">
      <Link to="/admin/elections" className="btn btn-ghost btn-sm sv-back">
        <ArrowLeft size={14} aria-hidden="true" /> Élections
      </Link>

      <ElectionHeader
        election={election}
        classLabel={(() => {
          const c = classes?.find((x) => x.id === election.class_id);
          return c ? `${c.level} ${c.name}` : "Classe inconnue";
        })()}
        candidateCount={colored.length}
        canDeleteClosed={election.status === "closed" && results !== undefined && results.total_votes === 0}
        onStatus={handleStatus}
        onEdit={() => navigate(`/admin/elections/${election.id}/edit`)}
        onDelete={handleDelete}
        pending={setStatus.isPending || deleteElection.isPending}
      />

      <section aria-labelledby="candidates-title" style={{ marginTop: 32 }}>
        <div className="row items-center justify-between gap-3" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <h2 id="candidates-title" style={{ fontSize: 18, fontWeight: 600, color: "var(--navy-900)", margin: 0 }}>
              Candidats <span style={{ color: "var(--ink-400)", fontWeight: 500 }}>{colored.length}</span>
            </h2>
            {!isDraft && (
              <p className="row items-center gap-2" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-500)" }}>
                <Lock size={13} aria-hidden="true" /> Liste figée depuis l'ouverture du scrutin.
              </p>
            )}
          </div>
          {isDraft && colored.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} aria-hidden="true" /> Ajouter un candidat
            </button>
          )}
        </div>

        {colored.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<UserPlus size={20} />}
              title="Aucun candidat"
              action={
                isDraft ? (
                  <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                    <Plus size={14} aria-hidden="true" /> Ajouter un candidat
                  </button>
                ) : undefined
              }
            >
              {isDraft
                ? "Il en faut au moins deux pour ouvrir le scrutin. Les candidats sont choisis parmi les étudiants de la classe."
                : "Cette élection n'a enregistré aucun candidat."}
            </EmptyState>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {colored.map((c, i) => (
              <CandidateRow
                key={c.id}
                c={c}
                number={i + 1}
                canDelete={isDraft}
              />
            ))}
          </div>
        )}
      </section>

      {(election.status === "open" || election.status === "closed") && (
        <NonVotersPanel
          electionId={election.id}
          classId={election.class_id}
          isOpen={election.status === "open"}
          reminderSentAt={election.reminder_sent_at ?? null}
        />
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

const STEPS: { status: Election["status"]; label: string }[] = [
  { status: "draft", label: "Préparation" },
  { status: "open", label: "Vote en cours" },
  { status: "closed", label: "Clôture et résultats" },
];

function ElectionHeader({
  election, classLabel, candidateCount, canDeleteClosed, onStatus, onEdit, onDelete, pending,
}: {
  election: Election;
  classLabel: string;
  candidateCount: number;
  canDeleteClosed: boolean;
  onStatus: (s: "open" | "closed") => void;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const current = election.status === "published" ? 2 : STEPS.findIndex((s) => s.status === election.status);
  const overdue = election.status === "open" && new Date(election.ends_at).getTime() < Date.now();
  const tooFew = candidateCount < 2;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="sv-election-hero sv-navy-panel" style={{ padding: "28px 30px 26px" }}>
        <BrandEcho size={300} style={{ right: 28, bottom: -40 }} />
        <div className="row items-center gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <ElectionStatusBadge status={election.status} />
          {overdue && <span className="badge badge-warn">Échéance dépassée</span>}
          {election.blockchain_id !== null && (
            <span className="sv-chip-dark">
              Inscrite sur la blockchain, n° {election.blockchain_id}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 650, margin: 0, lineHeight: 1.04, maxWidth: 720, color: "var(--on-panel)" }}>
          {election.title}
        </h1>
        {election.description && (
          <p style={{ margin: "8px 0 0", color: "var(--on-panel-2)", fontSize: 14.5, lineHeight: 1.55, maxWidth: 680 }}>
            {election.description}
          </p>
        )}

        <dl
          className="row"
          style={{ margin: "18px 0 0", gap: "10px 24px", flexWrap: "wrap", fontSize: 13, color: "rgba(255,255,255,0.8)" }}
        >
          <Meta icon={<GraduationCap size={15} />} label="Classe">{classLabel}</Meta>
          <Meta icon={<CalendarRange size={15} />} label="Période">
            {formatDateTime(election.starts_at)} → {formatDateTime(election.ends_at)}
          </Meta>
          <Meta icon={<Users size={15} />} label="Candidats">
            {candidateCount} candidat{candidateCount > 1 ? "s" : ""}
          </Meta>
        </dl>

        <ol className="sv-steps" aria-label="Étapes du scrutin" style={{ listStyle: "none", margin: "22px 0 0", padding: 0 }}>
          {STEPS.map((s, i) => (
            <Fragment key={s.status}>
              {i > 0 && <li aria-hidden="true" className="sv-step-line" />}
              <li
                className={`sv-step${i < current ? " done" : ""}${i === current ? " current" : ""}`}
                aria-current={i === current ? "step" : undefined}
              >
                <span className="sv-step-dot" aria-hidden="true">
                  {i < current ? <Check size={12} /> : i + 1}
                </span>
                {s.label}
              </li>
            </Fragment>
          ))}
        </ol>
      </div>

      <div
        className="sv-election-actions"
        style={{
          padding: "14px 28px",
          background: "var(--surface)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {election.status === "draft" && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onEdit} disabled={pending}>
              <Pencil size={14} aria-hidden="true" /> Modifier
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDelete} disabled={pending} style={{ color: "var(--danger-600)" }}>
              <Trash2 size={14} aria-hidden="true" /> Supprimer
            </button>
            <span style={{ flex: 1 }} />
            {tooFew && (
              <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Encore {2 - candidateCount} candidat{2 - candidateCount > 1 ? "s" : ""} avant de pouvoir ouvrir.
              </span>
            )}
            <button className="btn btn-primary" onClick={() => onStatus("open")} disabled={pending || tooFew}>
              <Unlock size={16} aria-hidden="true" /> Ouvrir le scrutin
            </button>
          </>
        )}
        {election.status === "open" && (
          <>
            <span style={{ fontSize: 13, color: "var(--ink-500)", flex: "1 1 260px" }}>
              {overdue
                ? "La date de fin est passée : clôturez le scrutin pour publier les résultats."
                : "Le vote est en cours. Les scores restent masqués jusqu'à la clôture."}
            </span>
            <button className={`btn ${overdue ? "btn-primary" : "btn-outline"}`} onClick={() => onStatus("closed")} disabled={pending}>
              <Lock size={16} aria-hidden="true" /> Clôturer le scrutin
            </button>
          </>
        )}
        {(election.status === "closed" || election.status === "published") && (
          <>
            {canDeleteClosed ? (
              <button className="btn btn-ghost btn-sm" onClick={onDelete} disabled={pending} style={{ color: "var(--danger-600)" }}>
                <Trash2 size={14} aria-hidden="true" /> Supprimer définitivement
              </button>
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Archivée : une élection qui a reçu des votes est conservée.
              </span>
            )}
            <span style={{ flex: 1 }} />
            <Link to={`/elections/${election.id}/results`} className="btn btn-primary">
              <BarChart3 size={16} aria-hidden="true" /> Voir les résultats
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="row items-center" style={{ gap: 8 }}>
      <dt style={{ display: "inline-flex", color: "rgba(255,255,255,0.55)" }}>
        <span aria-hidden="true" style={{ display: "inline-flex" }}>{icon}</span>
        <span className="sr-only">{label}</span>
      </dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

function CandidateRow({
  c, number, canDelete,
}: {
  c: Candidate;
  number: number;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!(await askConfirm({
      tone: "danger",
      title: "Retirer le candidat",
      subject: `N° ${String(number).padStart(2, "0")} · ${fullNameOf(c.student)}`,
      message: "Il ne figurera plus sur le bulletin. Vous pourrez l'ajouter de nouveau tant que le scrutin n'est pas ouvert.",
      confirmLabel: "Retirer",
    }))) return;
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

  // Un bulletin et son talon : le numéro d'ordre identifie le candidat mieux
  // qu'une couleur tirée au hasard.
  const no = String(number).padStart(2, "0");
  return (
    <article className="sv-slip">
      <div className="sv-slip-no" aria-hidden="true">
        <small>N°</small>
        <b>{no}</b>
      </div>
      <div className="sv-slip-body">
        <div className="row items-start gap-3">
          <Avatar
            initials={initialsOf(c.student.first_name, c.student.last_name)}
            name={fullNameOf(c.student)}
            size={48}
            src={c.student.photo_url || c.photo_url || undefined}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="sv-slip-name">
              <span className="sr-only">Candidat n° {number} : </span>
              {fullNameOf(c.student)}
            </h3>
            <div className="sv-ref" style={{ marginTop: 5 }}>{c.student.matricule}</div>
          </div>
          {canDelete && (
            <button
              className="btn btn-ghost btn-icon danger"
              onClick={remove}
              disabled={removing}
              title="Retirer de l'élection"
              aria-label={`Retirer ${fullNameOf(c.student)} de l'élection`}
              style={{ marginTop: -4, marginRight: -6 }}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {c.slogan ? (
          <p className="sv-slip-slogan">« {c.slogan} »</p>
        ) : (
          <p className="sv-slip-slogan empty">Pas de slogan.</p>
        )}
      </div>
    </article>
  );
}

type VoteFilter = "all" | "voted" | "not_voted";

function NonVotersPanel({
  electionId, classId, isOpen, reminderSentAt,
}: {
  electionId: string;
  classId: string;
  isOpen: boolean;
  reminderSentAt: string | null;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VoteFilter>("all");

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
  const votedCount = studentsWithStatus.filter((s) => s.hasVoted).length;
  const rate = count ? Math.round((votedCount / count) * 100) : 0;

  return (
    <section aria-labelledby="turnout-title" className="card" style={{ marginTop: 32, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
        <div className="row items-center justify-between gap-3" style={{ flexWrap: "wrap" }}>
          <h2 id="turnout-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>
            Participation
          </h2>
          <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
            <strong style={{ color: "var(--ink-900)", fontVariantNumeric: "tabular-nums" }}>{votedCount}</strong> sur {count} électeur{count > 1 ? "s" : ""} ont voté
          </span>
        </div>
        <div className="row items-center gap-3" style={{ marginTop: 12 }}>
          <div
            className="sv-progress flex-1"
            role="progressbar"
            aria-label="Taux de participation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rate}
          >
            <span style={{ width: `${rate}%`, background: "var(--success-600)" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {rate} %
          </span>
        </div>
        {(isOpen || reminderSentAt) && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-500)" }}>
            {reminderSentAt
              ? `Relance par e-mail envoyée aux non-votants le ${formatDateTime(reminderSentAt)}.`
              : "Si l'envoi d'e-mails est configuré, les non-votants recevront un rappel avant la clôture, une seule fois."}
          </p>
        )}
      </div>

      <div className="sv-toolbar">
        <Segmented
          label="Filtrer les électeurs"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tous", count },
            { value: "voted", label: "Ont voté", count: votedCount },
            { value: "not_voted", label: "N'ont pas voté", count: count - votedCount },
          ]}
        />
        <div className="input-wrap sv-search">
          <span className="input-icon"><Search size={16} aria-hidden="true" /></span>
          <input
            type="search"
            aria-label="Rechercher un étudiant par nom ou matricule"
            className="input has-icon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou matricule…"
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 16 }}>
          <div className="skel" style={{ height: 44, marginBottom: 8 }} />
          <div className="skel" style={{ height: 44 }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="Aucun étudiant">
          Aucun électeur ne correspond à ce filtre.
        </EmptyState>
      ) : (
        <div className="sv-table-scroll" style={{ maxHeight: 440, overflowY: "auto" }}>
          <table className="sv-table">
            <caption className="sr-only">Électeurs de la classe et statut de vote</caption>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th scope="col">Étudiant</th>
                <th scope="col">Matricule</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="row items-center gap-3">
                      <Avatar
                        initials={initialsOf(s.first_name, s.last_name)} name={`${s.first_name ?? ""} ${s.last_name ?? ""}`}
                        size={30}
                        src={s.photo_url || undefined}
                      />
                      <span style={{ fontWeight: 500, color: "var(--navy-900)" }}>
                        {s.first_name} {s.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--ink-500)", whiteSpace: "nowrap" }}>{s.matricule}</td>
                  <td>
                    <span className={`badge ${s.hasVoted ? "badge-success" : "badge-muted"}`}>
                      {s.hasVoted ? "A voté" : "N'a pas voté"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
        <h3 className="sv-modal-title">
          Ajouter un candidat
        </h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          L'étudiant doit appartenir à la classe de l'élection.
        </p>

        <div className="col gap-3" style={{ marginTop: 20 }}>
          <div>
            <label className="label" htmlFor="election-detail-f1">Rechercher un étudiant</label>
            <input id="election-detail-f1"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Matricule ou nom…"
            />
          </div>

          <div>
            <label className="label" htmlFor="election-detail-f2">Étudiant</label>
            <select id="election-detail-f2"
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
            <label className="label" htmlFor="election-detail-f3">Slogan (optionnel)</label>
            <input id="election-detail-f3"
              className="input"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Une voix qui porte, des actes qui comptent."
              maxLength={200}
            />
          </div>

          <div>
            <label className="label" htmlFor="election-detail-f4">Programme (une ligne par point)</label>
            <textarea id="election-detail-f4"
              className="input"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              rows={3}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>

          <div>
            <label className="label" htmlFor="election-detail-f5">Biographie (optionnel)</label>
            <textarea id="election-detail-f5"
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
