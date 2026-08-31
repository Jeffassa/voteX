import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { useClasses, useElections } from "@/lib/queries";
import type { Election } from "@/types/api";

const STATUS_LABEL: Record<Election["status"], string> = {
  draft: "Brouillon",
  open: "Ouverte",
  closed: "Fermée",
  published: "Publiée",
};

const STATUS_BADGE: Record<Election["status"], string> = {
  draft: "badge-draft",
  open: "badge-open",
  closed: "badge-closed",
  published: "badge-navy",
};

export default function ElectionsListPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const { data: elections, isLoading } = useElections();
  const { data: classes } = useClasses();

  const classMap = new Map(classes?.map((c) => [c.id, `${c.level} ${c.name}`]) || []);

  return (
    <div ref={pageRef} style={{ padding: "40px 40px 80px" }}>
      <div className="row items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Administration</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Élections</h1>
        </div>
        <Link to="/admin/elections/new" className="btn btn-primary">
          <Plus size={16} /> Nouvelle élection
        </Link>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px 240px 120px 60px",
            gap: 16,
            padding: "14px 20px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-500)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <div>Élection</div>
          <div>Classe</div>
          <div>Période</div>
          <div>Statut</div>
          <div />
        </div>

        {isLoading && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="skel" style={{ height: 56, marginBottom: 8 }} />
            <div className="skel" style={{ height: 56, marginBottom: 8 }} />
          </div>
        )}

        {!isLoading && elections?.length === 0 && (
          <div className="text-center muted" style={{ padding: 56 }}>
            Aucune élection. Cliquez sur « Nouvelle élection » pour en créer une.
          </div>
        )}

        {elections?.map((e) => (
          <Link
            key={e.id}
            to={`/admin/elections/${e.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px 240px 120px 60px",
              gap: 16,
              padding: "16px 20px",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
              transition: "background 160ms ease",
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
          >
            <div>
              <div style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 14 }}>
                {e.title}
              </div>
              {e.description && (
                <div
                  className="muted"
                  style={{
                    fontSize: 12, marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 480,
                  }}
                >
                  {e.description}
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
              {classMap.get(e.class_id) || "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }} className="mono">
              {new Date(e.starts_at).toLocaleDateString("fr-FR")}
              {" → "}
              {new Date(e.ends_at).toLocaleDateString("fr-FR")}
            </div>
            <div>
              <span className={`badge ${STATUS_BADGE[e.status]}`}>
                {e.status === "open" && <span className="dot" />}
                {STATUS_LABEL[e.status]}
              </span>
            </div>
            <div style={{ textAlign: "right", color: "var(--ink-400)" }}>
              <ArrowRight size={16} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
