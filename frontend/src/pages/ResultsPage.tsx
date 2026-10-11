import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { ElectionStatusBadge } from "@/components/admin/AdminUI";
import { useReveal } from "@/hooks/useReveal";
import { electionKeys, useElection, useElectionResults } from "@/lib/queries";
import { supabase } from "@/lib/supabase";

/** Au-delà, une case par inscrit ne tiendrait plus : on passe à la barre. */
const REGISTER_MAX = 240;

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

  // Classement du procès-verbal : par voix décroissantes, le vote blanc à part.
  const rows = useMemo(() => {
    const list = [...(results?.candidates || [])]
      .sort((a, b) => b.votes - a.votes)
      .map((c) => ({ key: c.candidate_id, name: c.full_name, votes: c.votes, percentage: c.percentage, photo: c.photo_url }));
    const blank = results?.blank_votes ?? 0;
    if (results && blank > 0) {
      const pct = results.total_votes ? (blank / results.total_votes) * 100 : 0;
      list.push({ key: "blank", name: "Vote blanc", votes: blank, percentage: Math.round(pct * 100) / 100, photo: null });
    }
    return list;
  }, [results]);

  const eligible = results?.total_eligible ?? 0;
  const turnout = results?.total_votes ?? 0;
  const rate = Math.round(results?.participation_rate ?? 0);
  const isOpen = election?.status === "open";
  const max = Math.max(...rows.map((r) => r.votes), 1);
  const leaderVotes = rows.find((r) => r.key !== "blank")?.votes ?? 0;

  return (
    <div>
      <AppHeader />
      <div ref={pageRef} className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)]">
            <ArrowLeft size={15} aria-hidden="true" /> Tableau de bord
          </Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-[var(--navy-900)] pb-5">
            <div className="min-w-0">
              <div className="sv-ref">Procès-verbal du scrutin</div>
              <h1 className="mt-1 text-[38px] font-[540] leading-[1.08] text-[var(--navy-900)]">
                {election?.title || "Résultats"}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {election && <ElectionStatusBadge status={election.status} />}
              {isOpen && <span className="text-[var(--ink-500)]">Actualisé automatiquement</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section aria-labelledby="participation-title" className="card self-start" style={{ padding: 24 }}>
            <h2 id="participation-title" className="sv-display text-[20px] font-[560] text-[var(--navy-900)]">Participation</h2>
            <p className="m-0 mt-3">
              <span className="sv-display text-[64px] font-[480] leading-none text-[var(--navy-900)]" style={{ fontVariantNumeric: "lining-nums tabular-nums" }}>
                {rate}
              </span>
              <span className="sv-display ml-1 text-[28px] text-[var(--ink-500)]">%</span>
            </p>
            <p className="m-0 mt-2 text-sm text-[var(--ink-700)]">
              <strong className="text-[var(--ink-900)]">{turnout}</strong> bulletin{turnout > 1 ? "s" : ""} pour{" "}
              <strong className="text-[var(--ink-900)]">{eligible}</strong> inscrit{eligible > 1 ? "s" : ""}.
            </p>
            {results && eligible > 0 && eligible <= REGISTER_MAX ? (
              <figure className="m-0 mt-5">
                {/* Registre d'émargement : une case par électeur inscrit, noircie
                    pour chaque bulletin reçu. Aucun nom : seul le compte compte. */}
                <div className="sv-register" aria-hidden="true">
                  {Array.from({ length: eligible }, (_, i) => (
                    <span key={i} className={i < turnout ? "on" : undefined} />
                  ))}
                </div>
                <figcaption className="mt-3 text-xs text-[var(--ink-500)]">
                  Registre d'émargement : une case par électeur inscrit.
                </figcaption>
              </figure>
            ) : (
              results && (
                <div className="sv-progress mt-5" aria-hidden="true">
                  <span style={{ width: `${rate}%` }} />
                </div>
              )
            )}
          </section>

          <section aria-labelledby="scores-title" className="card" style={{ padding: 24 }}>
            <h2 id="scores-title" className="sv-display text-[20px] font-[560] text-[var(--navy-900)]">Répartition des voix</h2>

            {results?.scores_hidden ? (
              <div className="sv-sealed mt-5">
                <span className="sv-sealed-icon" aria-hidden="true"><Lock size={18} /></span>
                <div>
                  <p className="sv-display m-0 text-[19px] font-[560] text-[var(--navy-900)]">Urne scellée jusqu'à la clôture</p>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--ink-700)]">
                    Les scores restent masqués pour tous, administrateurs compris, tant que le scrutin
                    est ouvert : ils ne doivent ni influencer ceux qui n'ont pas encore voté, ni révéler
                    le choix de ceux qui viennent de voter. Ils seront publiés à la clôture.
                  </p>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <p className="mt-6 text-sm text-[var(--ink-500)]">Aucun vote enregistré pour l'instant.</p>
            ) : (
              <table className="sv-table mt-4">
                <caption className="sr-only">Voix par candidat, de la plus élevée à la plus faible</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 48, paddingLeft: 0 }}>Rang</th>
                    <th scope="col">Candidat</th>
                    <th scope="col" className="sv-hide-mobile" style={{ width: "34%" }}><span className="sr-only">Part relative</span></th>
                    <th scope="col" className="num">Voix</th>
                    <th scope="col" className="num" style={{ paddingRight: 0 }}>Part</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const blank = r.key === "blank";
                    const leads = !blank && !isOpen && r.votes > 0 && r.votes === leaderVotes;
                    return (
                      <tr key={r.key}>
                        <td className="sv-display" style={{ paddingLeft: 0, fontSize: 22, color: leads ? "var(--orange-600)" : "var(--navy-900)" }}>
                          {blank ? "" : i + 1}
                        </td>
                        <td>
                          <span className="flex items-center gap-3">
                            {blank ? (
                              <span aria-hidden="true" className="sv-ballot-blank" style={{ width: 32, height: 32 }} />
                            ) : (
                              <Avatar initials={initials(r.name)} name={r.name} size={32} src={r.photo || undefined} />
                            )}
                            <span className="font-medium text-[var(--ink-900)]">{r.name}</span>
                            {leads && <span className="badge badge-orange">En tête</span>}
                          </span>
                        </td>
                        <td className="sv-hide-mobile" aria-hidden="true">
                          <div className={`sv-progress${blank ? " sv-progress-blank" : ""}`}>
                            <span style={{ width: `${Math.max((r.votes / max) * 100, r.votes ? 3 : 0)}%`, background: leads ? "var(--orange-500)" : undefined }} />
                          </div>
                        </td>
                        <td className="num mono text-[var(--ink-900)]">{r.votes}</td>
                        <td className="num mono text-[var(--ink-700)]" style={{ paddingRight: 0 }}>{r.percentage.toFixed(1)} %</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
