import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CheckCheck, Plus, UserCheck, Vote } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/admin/AdminUI";
import { useReveal } from "@/hooks/useReveal";
import { auditActor, auditMeta } from "@/lib/auditActions";
import { formatDateTime, formatPeriod, timeAgo, timeLeft } from "@/lib/dates";
import { useAdminDashboard, useClasses, useElections, useMe } from "@/lib/queries";
import { useAuditLog, usePendingStudents } from "@/lib/queries/admin";

const CLASS_ROWS = 8;

export default function AdminDashboardPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const { data: me } = useMe();
  const { data } = useAdminDashboard();
  const { data: elections } = useElections();
  const { data: classes } = useClasses();
  const { data: pending } = usePendingStudents();
  const { data: events } = useAuditLog(8);
  const [allClasses, setAllClasses] = useState(false);

  const now = new Date();
  const hello = now.getHours() >= 18 ? "Bonsoir" : "Bonjour";
  const day = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const today = day.charAt(0).toUpperCase() + day.slice(1);

  const classLabel = new Map(classes?.map((c) => [c.id, `${c.level} ${c.name}`]) ?? []);
  const open = (elections ?? [])
    .filter((e) => e.status === "open")
    .sort((a, b) => a.ends_at.localeCompare(b.ends_at));
  const drafts = (elections ?? []).filter((e) => e.status === "draft").length;
  const pendingCount = pending?.length ?? 0;

  // Avec des dizaines de classes, la plupart sans vote pendant un scrutin
  // ciblé, la liste complète ne montrait que des zéros.
  const all = data?.participation_by_class ?? [];
  const byClass = all.filter((r) => r.votes > 0).sort((a, b) => b.votes - a.votes);
  const silent = all.length - byClass.length;
  const max = byClass[0]?.votes ?? 1;
  const shown = allClasses ? byClass : byClass.slice(0, CLASS_ROWS);

  return (
    <div ref={pageRef} className="sv-admin-page">
      <PageHeader
        title={`${hello}${me?.first_name ? `, ${me.first_name}` : ""}`}
        subtitle={today}
        actions={
          <Link to="/admin/elections/new" className="btn btn-primary">
            <Plus size={16} aria-hidden="true" /> Nouvelle élection
          </Link>
        }
      />

      {pendingCount > 0 && (
        <div className="sv-callout" style={{ marginBottom: 20 }}>
          <span className="sv-callout-icon" aria-hidden="true"><UserCheck size={16} /></span>
          <div style={{ flex: "1 1 280px" }}>
            <strong>
              {pendingCount} compte{pendingCount > 1 ? "s attendent" : " attend"} votre validation.
            </strong>{" "}
            <span style={{ color: "var(--ink-700)" }}>Vérifiez l'identité du demandeur avant de lui ouvrir le vote.</span>
          </div>
          <Link to="/admin/students?vue=attente" className="btn btn-outline btn-sm">
            Examiner <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      <section aria-label="Chiffres clés" className="sv-ledger">
        <Kpi to="/admin/elections?statut=open" label="Scrutins ouverts" value={data?.active_elections} />
        <Kpi label="Bulletins reçus" value={data?.total_votes} />
        <Kpi to="/admin/students" label="Électeurs inscrits" value={data?.total_students} />
        <Kpi to="/admin/classes" label="Classes" value={data?.total_classes} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="dash-open" className="card" style={{ overflow: "hidden" }}>
            <div className="sv-card-head">
              <h2 id="dash-open">Scrutins en cours</h2>
              <Link to="/admin/elections" className="sv-card-link">
                Toutes les élections <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {open.length === 0 ? (
              <EmptyState
                icon={<Vote size={20} />}
                title="Aucun scrutin ouvert"
                action={
                  drafts > 0 ? (
                    <Link to="/admin/elections" className="btn btn-outline btn-sm">
                      {drafts} brouillon{drafts > 1 ? "s" : ""} en préparation
                    </Link>
                  ) : undefined
                }
              >
                {drafts > 0
                  ? "Ouvrez un brouillon quand ses candidats sont prêts."
                  : "Créez une élection pour démarrer un scrutin."}
              </EmptyState>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {open.map((e) => {
                  const overdue = new Date(e.ends_at).getTime() < now.getTime();
                  return (
                    <li key={e.id} className="border-b border-border last:border-0">
                      <Link
                        to={`/admin/elections/${e.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--bg)]"
                      >
                        <span style={{ width: 7, height: 7, borderRadius: 1, background: overdue ? "var(--warn-500)" : "var(--success-500)", flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="sv-cell-title sv-truncate" style={{ display: "block" }}>{e.title}</span>
                          <span className="sv-cell-sub" style={{ display: "block" }}>
                            {classLabel.get(e.class_id) ?? "Classe inconnue"} · {formatPeriod(e.starts_at, e.ends_at)}
                          </span>
                        </span>
                        {overdue ? (
                          <span className="badge badge-warn" title={`Fin prévue le ${formatDateTime(e.ends_at)}`}>À clôturer</span>
                        ) : (
                          <span className="sv-hide-mobile" style={{ fontSize: 13, color: "var(--ink-500)", whiteSpace: "nowrap" }}>
                            {timeLeft(e.ends_at)}
                          </span>
                        )}
                        <ArrowRight size={16} aria-hidden="true" style={{ color: "var(--ink-400)", flexShrink: 0 }} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="dash-classes" className="card" style={{ overflow: "hidden" }}>
            <div className="sv-card-head">
              <h2 id="dash-classes">Votes par classe</h2>
              {byClass.length > 0 && (
                <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  {byClass.length} classe{byClass.length > 1 ? "s ont" : " a"} voté
                </span>
              )}
            </div>
            {byClass.length === 0 ? (
              <EmptyState icon={<CheckCheck size={20} />} title="Aucun vote pour l'instant">
                Les votes apparaissent ici dès l'ouverture d'un scrutin.
              </EmptyState>
            ) : (
              <>
                <table className="sv-table">
                  <caption className="sr-only">Votes enregistrés par classe</caption>
                  <thead>
                    <tr>
                      <th scope="col">Classe</th>
                      <th scope="col" className="sv-hide-mobile" style={{ width: "50%" }}>
                        <span className="sr-only">Part relative</span>
                      </th>
                      <th scope="col" className="num">Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.class}>
                        <td style={{ color: "var(--ink-900)", fontWeight: 500 }}>{r.class}</td>
                        <td className="sv-hide-mobile" aria-hidden="true">
                          <div className="sv-progress"><span style={{ width: `${Math.max((r.votes / max) * 100, 3)}%` }} /></div>
                        </td>
                        <td className="num mono" style={{ color: "var(--ink-900)" }}>{r.votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(byClass.length > CLASS_ROWS || silent > 0) && (
                  <div className="sv-table-foot row items-center justify-between gap-3" style={{ flexWrap: "wrap" }}>
                    <span>{silent > 0 && `${silent} classe${silent > 1 ? "s" : ""} sans vote enregistré`}</span>
                    {byClass.length > CLASS_ROWS && (
                      <button type="button" className="sv-link-button" onClick={() => setAllClasses((v) => !v)}>
                        {allClasses ? "Réduire" : `Afficher les ${byClass.length - CLASS_ROWS} autres`}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <section aria-labelledby="dash-activity" className="card self-start" style={{ overflow: "hidden" }}>
          <div className="sv-card-head">
            <h2 id="dash-activity">Activité récente</h2>
            <Link to="/admin/audit" className="sv-card-link">
              Journal <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!events || events.length === 0 ? (
            <EmptyState icon={<Activity size={20} />} title="Rien à signaler">
              Les actions sensibles s'afficheront ici.
            </EmptyState>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: "6px 0" }}>
              {events.map((e) => {
                const meta = auditMeta(e.action);
                return (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 1, background: meta.color, marginTop: 6, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <span style={{ display: "block", color: "var(--ink-900)", fontWeight: 500 }}>{meta.label}</span>
                      <span className="sv-truncate" style={{ display: "block", color: "var(--ink-500)" }}>{auditActor(e)}</span>
                    </span>
                    <time dateTime={e.created_at} title={formatDateTime(e.created_at)} style={{ fontSize: 12, color: "var(--ink-500)", whiteSpace: "nowrap" }}>
                      {timeAgo(e.created_at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** Une cellule de la bande des totaux ; cliquable quand elle mène à une liste. */
function Kpi({ label, value, to }: { label: string; value: number | undefined; to?: string }) {
  const body = (
    <>
      <span className="sv-ledger-label">
        {label}
        {to && <ArrowRight size={14} aria-hidden="true" className="sv-ledger-go" />}
      </span>
      <span className="sv-ledger-value">
        {value === undefined ? <span className="skel" style={{ display: "inline-block", width: 56, height: 36 }} /> : value.toLocaleString("fr-FR")}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="sv-ledger-cell">{body}</Link>
  ) : (
    <div className="sv-ledger-cell">{body}</div>
  );
}
