import { Activity, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, PageHeader, Segmented } from "@/components/admin/AdminUI";
import { useReveal } from "@/hooks/useReveal";
import { AUDIT_CATEGORIES, auditActor, auditMeta, type AuditCategory } from "@/lib/auditActions";
import { dayKey, dayLabel, formatDateTime, formatTime } from "@/lib/dates";
import { useAuditLog, type AuditEvent } from "@/lib/queries/admin";

const LIMIT = 200;

export default function AuditLogPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const { data: events, isLoading } = useAuditLog(LIMIT);

  const all = events ?? [];
  const f = filter.trim().toLowerCase();
  const filtered = all.filter((e) => {
    const meta = auditMeta(e.action);
    if (category !== "all" && meta.category !== category) return false;
    if (!f) return true;
    return (
      meta.label.toLowerCase().includes(f) ||
      e.action.toLowerCase().includes(f) ||
      (e.details || "").toLowerCase().includes(f) ||
      (e.ip_address || "").includes(f) ||
      auditActor(e).toLowerCase().includes(f)
    );
  });

  // Regroupement par jour : le journal se lit comme un fil, du plus récent au
  // plus ancien, plutôt qu'en horodatages complets répétés sur chaque ligne.
  const days: { key: string; label: string; items: AuditEvent[] }[] = [];
  for (const e of filtered) {
    const key = dayKey(e.created_at);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(e);
    else days.push({ key, label: dayLabel(e.created_at), items: [e] });
  }

  return (
    <div ref={pageRef} className="sv-admin-page">
      <PageHeader
        title="Journal d'audit"
        subtitle={`Actions sensibles, les plus récentes en tête (${LIMIT} au plus). Le journal ne peut être ni modifié ni effacé.`}
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="sv-toolbar">
          <Segmented
            label="Filtrer par type d'action"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "Tout", count: all.length },
              ...AUDIT_CATEGORIES.map((c) => ({
                value: c.value,
                label: c.label,
                count: all.filter((e) => auditMeta(e.action).category === c.value).length,
              })),
            ]}
          />
          <div className="input-wrap sv-search">
            <span className="input-icon"><Search size={16} aria-hidden="true" /></span>
            <input
              type="search"
              aria-label="Filtrer le journal d'audit"
              className="input has-icon"
              placeholder="Action, auteur, détail, adresse IP…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}>
            <div className="skel" style={{ height: 44, marginBottom: 8 }} />
            <div className="skel" style={{ height: 44 }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Activity size={20} />} title="Aucun événement à afficher">
            {all.length ? "Aucune action ne correspond à ce filtre." : "Les actions sensibles s'inscriront ici."}
          </EmptyState>
        ) : (
          <div className="sv-table-scroll">
            <table className="sv-table" style={{ minWidth: 760, fontSize: 13 }}>
              <caption className="sr-only">Journal d'audit, regroupé par jour</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 72 }}>Heure</th>
                  <th scope="col" style={{ width: 220 }}>Action</th>
                  <th scope="col" style={{ width: 200 }}>Auteur</th>
                  <th scope="col">Détail</th>
                  <th scope="col" style={{ width: 130 }}>Adresse IP</th>
                </tr>
              </thead>
              {days.map((d) => (
                <tbody key={d.key}>
                  <tr className="sv-day-row">
                    <th scope="colgroup" colSpan={5}>
                      {d.label}
                      <span style={{ fontWeight: 400, color: "var(--ink-400)", marginLeft: 8 }}>
                        {d.items.length} événement{d.items.length > 1 ? "s" : ""}
                      </span>
                    </th>
                  </tr>
                  {d.items.map((e) => {
                    const meta = auditMeta(e.action);
                    return (
                      <tr key={e.id}>
                        <td className="mono" style={{ color: "var(--ink-500)", fontSize: 12 }}>
                          <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>{formatTime(e.created_at)}</time>
                        </td>
                        <td>
                          <span className="row items-center gap-2">
                            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 1, background: meta.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500, color: "var(--navy-900)" }}>{meta.label}</span>
                          </span>
                        </td>
                        <td style={{ color: e.actor_name ? "var(--ink-700)" : "var(--ink-400)" }}>{auditActor(e)}</td>
                        <td className="mono sv-truncate" style={{ maxWidth: 0, fontSize: 12, color: "var(--ink-500)" }} title={e.details || undefined}>
                          {e.details || ""}
                        </td>
                        <td className="mono" style={{ fontSize: 12, color: "var(--ink-500)" }}>{e.ip_address || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
