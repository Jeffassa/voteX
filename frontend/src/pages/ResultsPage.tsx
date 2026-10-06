import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Trophy } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { useReveal } from "@/hooks/useReveal";
import { electionKeys, useElection, useElectionResults } from "@/lib/queries";
import { colorFor } from "@/lib/palette";
import { supabase } from "@/lib/supabase";

const STATUS_LABEL: Record<string, string> = {
  draft: "En préparation",
  open: "Scrutin ouvert",
  closed: "Scrutin clos",
  published: "Résultats publiés",
};

// Constante hors du composant : bklit relance son animation d'entrée quand la
// référence de `margin` change, et un objet recréé à chaque rendu l'empêchait
// de jamais se terminer (barres invisibles).
const BAR_MARGIN = { left: 150, right: 24 };

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: results } = useElectionResults(id);
  const { data: election } = useElection(id);
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", deps: [!!results] });

  // Temps réel via Supabase si configuré ; sinon, la requête se renouvelle
  // toutes les 5 secondes (voir useElectionResults).
  useEffect(() => {
    const sb = supabase;
    if (!id || !sb) return;
    const channel = sb
      .channel(`votes:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `election_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: electionKeys.results(id) })
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [id, queryClient]);

  const rows = useMemo(() => {
    const list = (results?.candidates || []).map((c, i) => ({
      key: c.candidate_id,
      name: c.full_name,
      votes: c.votes,
      percentage: c.percentage,
      photo: c.photo_url,
      color: colorFor(i),
    }));
    const blank = results?.blank_votes ?? 0;
    if (results && blank > 0) {
      const pct = results.total_votes ? (blank / results.total_votes) * 100 : 0;
      list.push({ key: "blank", name: "Vote blanc", votes: blank, percentage: Math.round(pct * 100) / 100, photo: null, color: "#a1a1aa" });
    }
    return list;
  }, [results]);

  const chartData = rows.map((r) => ({ name: r.name, voix: r.votes }));
  const eligible = results?.total_eligible ?? 0;
  const turnout = results?.total_votes ?? 0;
  const rate = Math.round(results?.participation_rate ?? 0);
  const leader = rows.find((r) => r.key !== "blank");
  const isOpen = election?.status === "open";

  return (
    <div>
      <AppHeader />
      <div ref={pageRef} className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)]">
              <ArrowLeft size={15} aria-hidden="true" /> Tableau de bord
            </Link>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink-900)]">
              {election?.title || "Résultats"}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`badge ${isOpen ? "badge-open" : "badge-closed"}`}>
              {isOpen && <span className="dot" />}
              {STATUS_LABEL[election?.status ?? ""] ?? ""}
            </span>
            {isOpen && <span className="text-[var(--ink-500)]">Actualisé automatiquement</span>}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
          <section aria-labelledby="participation-title" className="card card-pad">
            <h2 id="participation-title" className="text-[15px] font-semibold text-[var(--ink-900)]">Participation</h2>
            <div className="mt-4 flex justify-center">
              {results && (
                <RingChart
                  data={[{ label: `sur ${eligible} inscrits`, value: turnout, maxValue: Math.max(eligible, 1), color: "var(--navy-900)" }]}
                  size={220}
                  strokeWidth={16}
                  baseInnerRadius={72}
                >
                  <Ring index={0} />
                  <RingCenter defaultLabel={`sur ${eligible} inscrits`} />
                </RingChart>
              )}
            </div>
            <p className="mt-4 text-center text-sm text-[var(--ink-700)]">
              <strong className="text-[var(--ink-900)]">{rate} %</strong> des électeurs ont voté.
            </p>
          </section>

          <section aria-labelledby="scores-title" className="card card-pad">
            <h2 id="scores-title" className="text-[15px] font-semibold text-[var(--ink-900)]">Répartition des voix</h2>

            {results?.scores_hidden ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm text-[var(--ink-700)]">
                <EyeOff size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--ink-500)]" />
                <p className="m-0 leading-relaxed">
                  Les scores restent masqués pour tous, administrateurs compris, tant que le scrutin
                  est ouvert : ils ne doivent ni influencer ceux qui n'ont pas encore voté, ni révéler
                  le choix de ceux qui viennent de voter. Ils seront publiés à la clôture.
                </p>
              </div>
            ) : rows.length === 0 ? (
              <p className="mt-6 text-sm text-[var(--ink-500)]">Aucun vote enregistré pour l'instant.</p>
            ) : (
              <>
                {leader && !isOpen && leader.votes > 0 && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-[var(--ink-700)]">
                    <Trophy size={16} aria-hidden="true" className="text-[var(--orange-600)]" />
                    <span>
                      En tête : <strong className="text-[var(--ink-900)]">{leader.name}</strong>, {leader.votes}{" "}
                      voix
                    </span>
                  </p>
                )}
                <div className="mt-5" aria-hidden="true">
                  <BarChart data={chartData} xDataKey="name" orientation="horizontal" margin={BAR_MARGIN} barGap={0.45} aspectRatio={`4 / ${(0.6 + rows.length * 0.5).toFixed(2)}`}>
                    <Grid vertical />
                    <Bar dataKey="voix" fill="var(--navy-900)" lineCap={6} />
                    <BarYAxis showAllLabels />
                    <ChartTooltip />
                  </BarChart>
                </div>

                {/* Le graphique est décoratif pour un lecteur d'écran : les chiffres
                    exacts sont dans ce tableau, lisible par tous. */}
                <table className="mt-6 w-full text-sm">
                  <caption className="sr-only">Voix par candidat</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-[var(--ink-500)]">
                      <th scope="col" className="py-2 font-medium">Candidat</th>
                      <th scope="col" className="py-2 text-right font-medium">Voix</th>
                      <th scope="col" className="py-2 text-right font-medium">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-border last:border-0">
                        <td className="py-2.5">
                          <span className="flex items-center gap-3">
                            {r.key === "blank" ? (
                              <span aria-hidden="true" className="h-8 w-8 rounded-full bg-muted" />
                            ) : (
                              <Avatar initials={initials(r.name)} name={r.name} size={32} color={r.color} src={r.photo || undefined} />
                            )}
                            <span className="font-medium text-[var(--ink-900)]">{r.name}</span>
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-[var(--ink-900)]">{r.votes}</td>
                        <td className="py-2.5 text-right font-mono text-[var(--ink-700)]">{r.percentage.toFixed(1)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
