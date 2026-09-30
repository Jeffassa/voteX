import { Link } from "react-router-dom";
import { Calendar, GraduationCap, Plus, Users, Vote } from "lucide-react";

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { useAdminDashboard } from "@/lib/queries";

export default function AdminDashboardPage() {
  const { data } = useAdminDashboard();
  const all = data?.participation_by_class ?? [];
  // Avec des dizaines de classes, la plupart sans vote pendant un scrutin
  // ciblé, un graphique complet ne montrait que des zéros illisibles.
  const byClass = all.filter((r) => r.votes > 0).sort((a, b) => b.votes - a.votes);
  const silent = all.length - byClass.length;
  const chartData = byClass.slice(0, 12).map((r) => ({ classe: r.class, votes: r.votes }));

  return (
    <div className="px-4 pb-20 pt-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h-title">Tableau de bord</h1>
        <Link to="/admin/elections/new" className="btn btn-primary">
          <Plus size={16} aria-hidden="true" /> Nouvelle élection
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI icon={<Calendar size={18} />} label="Élections ouvertes" value={data?.active_elections ?? 0} />
        <KPI icon={<Vote size={18} />} label="Votes enregistrés" value={data?.total_votes ?? 0} />
        <KPI icon={<Users size={18} />} label="Étudiants" value={data?.total_students ?? 0} />
        <KPI icon={<GraduationCap size={18} />} label="Classes" value={data?.total_classes ?? 0} />
      </div>

      <section aria-labelledby="by-class" className="card card-pad mt-6">
        <h2 id="by-class" className="text-[15px] font-semibold text-[var(--ink-900)]">Votes par classe</h2>
        {byClass.length > 12 && (
          <p className="mt-1 text-[13px] text-[var(--ink-500)]">Le graphique montre les 12 classes les plus actives ; le tableau les liste toutes.</p>
        )}
        {byClass.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--ink-500)]">Aucun vote enregistré pour l'instant.</p>
        ) : (
          <>
            <div className="mt-5" aria-hidden="true">
              <BarChart data={chartData} xDataKey="classe" aspectRatio="3 / 1" barGap={chartData.length < 4 ? 0.7 : 0.35}>
                <Grid horizontal />
                <Bar dataKey="votes" fill="var(--navy-900)" lineCap={6} />
                <BarXAxis />
                <ChartTooltip />
              </BarChart>
            </div>
            <table className="mt-6 w-full text-sm">
              <caption className="sr-only">Votes enregistrés par classe</caption>
              <thead>
                <tr className="border-b border-border text-left text-[var(--ink-500)]">
                  <th scope="col" className="py-2 font-medium">Classe</th>
                  <th scope="col" className="py-2 text-right font-medium">Votes</th>
                </tr>
              </thead>
              <tbody>
                {byClass.map((r) => (
                  <tr key={r.class} className="border-b border-border last:border-0">
                    <td className="py-2.5 text-[var(--ink-900)]">{r.class}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--ink-900)]">{r.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {silent > 0 && (
              <p className="mt-3 text-[13px] text-[var(--ink-500)]">
                {silent} classe{silent > 1 ? "s" : ""} sans vote enregistré.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 text-sm text-[var(--ink-500)]">
        <span aria-hidden="true" className="text-[var(--ink-500)]">{icon}</span>
        {label}
      </div>
      <div className="mt-3 font-mono text-[30px] font-semibold tracking-[-0.02em] text-[var(--ink-900)]">
        {value}
      </div>
    </div>
  );
}
