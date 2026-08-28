import { Link } from "react-router-dom";
import { Calendar, GraduationCap, Plus, Users, Vote } from "lucide-react";

import { useAdminDashboard } from "@/lib/queries";

export default function AdminDashboardPage() {
  const { data } = useAdminDashboard();

  return (
    <div style={{ padding: "40px 40px 80px" }}>
      <div className="row items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <div className="h-eyebrow">Administration</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Tableau de bord</h1>
        </div>
        <Link to="/admin/elections/new" className="btn btn-primary">
          <Plus size={16} /> Nouvelle élection
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        <KPI icon={<Calendar size={20} />} label="Élections actives" value={data?.active_elections ?? 0} />
        <KPI icon={<Vote size={20} />} label="Votes total" value={data?.total_votes ?? 0} accent />
        <KPI icon={<Users size={20} />} label="Étudiants" value={data?.total_students ?? 0} />
        <KPI icon={<GraduationCap size={20} />} label="Classes" value={data?.total_classes ?? 0} />
      </div>

      <div className="card card-pad" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, color: "var(--navy-900)", marginBottom: 16 }}>
          Participation par classe
        </div>
        <div className="col gap-2">
          {data?.participation_by_class.length ? (
            data.participation_by_class.map((row) => (
              <div
                key={row.class}
                className="row items-center justify-between"
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 14 }}>{row.class}</span>
                <span
                  className="mono"
                  style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 14 }}
                >
                  {row.votes}
                </span>
              </div>
            ))
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Aucune donnée disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="card card-pad">
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: accent ? "var(--orange-50)" : "var(--navy-50)",
          color: accent ? "var(--orange-600)" : "var(--navy-700)",
          display: "grid", placeItems: "center", marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 32, fontWeight: 600,
          color: "var(--navy-900)", letterSpacing: "-0.025em",
        }}
      >
        {value}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
