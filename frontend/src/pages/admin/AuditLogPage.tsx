import { Activity, Filter } from "lucide-react";
import { useState } from "react";

import { useAuditLog, useStudents } from "@/lib/queries";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Connexion", color: "var(--ink-500)" },
  password_changed: { label: "Mdp modifié", color: "var(--info-500)" },
  password_reset_requested: { label: "Reset demandé", color: "var(--info-500)" },
  password_reset_confirmed: { label: "Reset confirmé", color: "var(--success-500)" },
  election_created: { label: "Élection créée", color: "var(--info-500)" },
  election_updated: { label: "Élection modifiée", color: "var(--warn-500)" },
  election_deleted: { label: "Élection supprimée", color: "var(--danger-500)" },
  election_opened: { label: "Scrutin ouvert", color: "var(--success-500)" },
  election_closed: { label: "Scrutin clôturé", color: "var(--warn-500)" },
  candidate_created: { label: "Candidat ajouté", color: "var(--info-500)" },
  candidate_deleted: { label: "Candidat retiré", color: "var(--danger-500)" },
  student_created: { label: "Étudiant inscrit", color: "var(--info-500)" },
  student_updated: { label: "Étudiant modifié", color: "var(--warn-500)" },
  student_deleted: { label: "Étudiant supprimé", color: "var(--danger-500)" },
  student_role_changed: { label: "Rôle modifié", color: "var(--orange-500)" },
  class_created: { label: "Classe créée", color: "var(--info-500)" },
  class_updated: { label: "Classe modifiée", color: "var(--warn-500)" },
  class_deleted: { label: "Classe supprimée", color: "var(--danger-500)" },
  vote_cast: { label: "Vote enregistré", color: "var(--success-500)" },
};

export default function AuditLogPage() {
  const [filter, setFilter] = useState("");
  const { data: events, isLoading } = useAuditLog(200);
  const { data: students } = useStudents();

  const studentMap = new Map(
    (students || []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  );

  const filtered = (events || []).filter((e) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      e.action.toLowerCase().includes(f) ||
      (e.details || "").toLowerCase().includes(f) ||
      (e.actor_id ? studentMap.get(e.actor_id) || "" : "").toLowerCase().includes(f)
    );
  });

  return (
    <div style={{ padding: "40px 40px 80px" }}>
      <div className="row items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Administration</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Journal d'audit</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Trace des actions sensibles. {events?.length || 0} événements affichés.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="input-wrap">
          <span className="input-icon"><Filter size={16} /></span>
          <input
            className="input has-icon"
            placeholder="Filtrer par action, acteur, ou détail…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {isLoading && (
          <div style={{ padding: 20 }}>
            <div className="skel" style={{ height: 56, marginBottom: 8 }} />
            <div className="skel" style={{ height: 56 }} />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center muted" style={{ padding: 56 }}>
            <Activity size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>Aucun événement à afficher.</div>
          </div>
        )}

        {filtered.map((e) => {
          const meta = ACTION_LABELS[e.action] || {
            label: e.action,
            color: "var(--ink-500)",
          };
          const actor = e.actor_id ? studentMap.get(e.actor_id) || "—" : "Système";

          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 200px 1fr 120px",
                gap: 16,
                padding: "12px 20px",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              <div className="row items-center gap-2">
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: meta.color, flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500, color: "var(--navy-900)" }}>
                  {meta.label}
                </span>
              </div>
              <div style={{ color: "var(--ink-700)" }}>{actor}</div>
              <div className="muted mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.details || "—"}
              </div>
              <div className="muted mono" style={{ fontSize: 11, textAlign: "right" }}>
                {new Date(e.created_at).toLocaleString("fr-FR")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
