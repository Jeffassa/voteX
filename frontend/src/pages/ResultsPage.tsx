import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, TrendingUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { electionKeys, useElection, useElectionResults } from "@/lib/queries";
import { colorFor } from "@/lib/palette";
import { supabase } from "@/lib/supabase";
import type { CandidateResult } from "@/types/api";

type ColoredResult = CandidateResult & { color: string; initials: string };

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  const { data: results } = useElectionResults(id);
  const { data: election } = useElection(id);

  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => setTick((x) => x + 1), 4000);

    // Realtime via Supabase si configuré, sinon le refetchInterval (5s) fait office de polling.
    const sb = supabase;
    if (!sb) {
      return () => clearInterval(t);
    }

    const channel = sb
      .channel(`votes:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "votes",
          filter: `election_id=eq.${id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: electionKeys.results(id) })
      )
      .subscribe();
    return () => {
      clearInterval(t);
      sb.removeChannel(channel);
    };
  }, [id, queryClient]);

  const colored: ColoredResult[] = useMemo(
    () =>
      (results?.candidates || []).map((c, i) => ({
        ...c,
        color: colorFor(i),
        initials: c.full_name
          .split(" ")
          .map((s) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      })),
    [results]
  );

  return (
    <div>
      <AppHeader />
      <div className="container scene" style={{ padding: "32px 32px 80px" }}>
        <div className="row items-center justify-between sv-results-stats" style={{ marginBottom: 28 }}>
          <div>
            <div className="h-eyebrow">En direct</div>
            <h1 className="h-title" style={{ marginTop: 8 }}>
              {election?.title || "Élection"}
            </h1>
          </div>
          <div className="row items-center gap-2">
            <span className="badge badge-open">
              <span className="dot" /> Scrutin{" "}
              {election?.status === "open" ? "ouvert" : election?.status || ""}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              · mise à jour {tick % 2 === 0 ? "il y a 1s" : "à l'instant"}
            </span>
          </div>
        </div>

        <div
          className="sv-results-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr 320px",
            gap: 20,
          }}
        >
          <div
            className="card card-pad"
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center",
            }}
          >
            <div
              className="h-eyebrow"
              style={{ color: "var(--ink-500)", alignSelf: "flex-start" }}
            >
              Participation
            </div>
            <TurnoutCircle pct={Math.round(results?.participation_rate || 0)} />
            <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
              <span
                className="mono"
                style={{ color: "var(--navy-900)", fontWeight: 600 }}
              >
                {results?.total_votes ?? 0}
              </span>{" "}
              sur <span className="mono">{results?.total_eligible ?? 0}</span>{" "}
              votants inscrits
            </div>
            <div
              style={{
                marginTop: 22, padding: 14,
                background: "var(--orange-50)",
                borderRadius: "var(--r-md)",
                width: "100%", textAlign: "left",
              }}
            >
              <div className="h-eyebrow" style={{ color: "var(--orange-600)" }}>
                Tendance
              </div>
              <div
                className="row items-center gap-2"
                style={{
                  marginTop: 6, color: "var(--orange-600)",
                  fontSize: 13, fontWeight: 500,
                }}
              >
                <TrendingUp size={14} /> Mise à jour temps réel
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="row items-center justify-between" style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                Répartition par candidat
              </div>
              <div className="row items-center gap-2 muted" style={{ fontSize: 12 }}>
                <Activity size={14} /> Mise à jour live
              </div>
            </div>
            <div className="col gap-4">
              {colored.length === 0 && (
                <div className="muted" style={{ fontSize: 13 }}>
                  Aucun candidat enregistré.
                </div>
              )}
              {colored.map((c, i) => (
                <ResultBar
                  key={c.candidate_id}
                  c={c}
                  rank={i + 1}
                  pulse={tick % 4 === i}
                />
              ))}
              
              {results?.blank_votes !== undefined && results.blank_votes > 0 && (
                <div style={{ marginTop: 12, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div className="row items-center justify-between" style={{ marginBottom: 8 }}>
                    <div className="row items-center gap-3">
                      <div className="mono muted" style={{ width: 18, textAlign: "center", fontSize: 12 }}>—</div>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink-200, #e2e8f0)", display: "grid", placeItems: "center", color: "var(--ink-700)", fontSize: 14, fontWeight: 600 }}>N</div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 14 }}>Vote Blanc / Neutre</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--navy-900)" }}>
                        {results.total_votes ? ((results.blank_votes / results.total_votes) * 100).toFixed(1) : "0.0"}%
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {results.blank_votes} voix
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 12, background: "var(--surface-2)", borderRadius: "var(--r-pill)", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div style={{ height: "100%", width: `${results.total_votes ? (results.blank_votes / results.total_votes) * 100 : 0}%`, background: "var(--ink-400)", borderRadius: "var(--r-pill)", transition: "width 700ms cubic-bezier(.2,.7,.2,1)" }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col gap-5">
            <div className="card card-pad">
              <div className="h-eyebrow" style={{ color: "var(--ink-500)" }}>
                Évolution dans le temps
              </div>
              <Sparklines data={colored} tick={tick} />
            </div>
            <div className="card card-pad" style={{ flex: 1 }}>
              <div className="row items-center gap-2" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--success-500)",
                    animation: "sv-pulse 2s infinite",
                  }}
                />
                <div
                  style={{
                    fontWeight: 600, fontSize: 13, color: "var(--navy-900)",
                  }}
                >
                  Flux on-chain
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                Chaque vote enregistré apparaît ici dès sa validation par le réseau.{" "}
                {results?.total_votes ?? 0} vote
                {(results?.total_votes ?? 0) > 1 ? "s" : ""} scellé
                {(results?.total_votes ?? 0) > 1 ? "s" : ""} jusqu'à présent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultBar({
  c, rank, pulse,
}: {
  c: ColoredResult;
  rank: number;
  pulse: boolean;
}) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(c.percentage), 100);
    return () => clearTimeout(t);
  }, [c.percentage]);

  return (
    <div>
      <div className="row items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="row items-center gap-3">
          <div
            className="mono muted"
            style={{ width: 18, textAlign: "center", fontSize: 12 }}
          >
            {String(rank).padStart(2, "0")}
          </div>
          <Avatar
            initials={c.initials}
            size={36}
            color={c.color}
            src={c.photo_url || undefined}
          />
          <div>
            <div
              style={{
                fontWeight: 600, color: "var(--navy-900)",
                fontSize: 14, letterSpacing: "-0.01em",
              }}
            >
              {c.full_name}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="mono"
            style={{
              fontSize: 24, fontWeight: 600,
              color: "var(--navy-900)", letterSpacing: "-0.02em",
            }}
          >
            {c.percentage.toFixed(1)}%
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {c.votes} voix
          </div>
        </div>
      </div>
      <div
        style={{
          height: 12,
          background: "var(--surface-2)",
          borderRadius: "var(--r-pill)",
          overflow: "hidden", position: "relative",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            height: "100%", width: `${animPct}%`, background: c.color,
            borderRadius: "var(--r-pill)",
            transition: "width 700ms cubic-bezier(.2,.7,.2,1)",
            position: "relative",
          }}
        >
          {pulse && (
            <span
              style={{
                position: "absolute", right: 0, top: -2, bottom: -2, width: 12,
                background: "rgba(255,255,255,0.6)",
                borderRadius: "var(--r-pill)",
                animation: "sv-shimmer 1.2s ease",
                filter: "blur(4px)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TurnoutCircle({ pct }: { pct: number }) {
  const r = 72;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: 200, height: 200, margin: "24px 0 18px" }}>
      <svg className="sv-turnout-svg" width="200" height="200" viewBox="0 0 200 200">
        <circle
          cx="100" cy="100" r={r}
          stroke="var(--navy-50)" strokeWidth="14" fill="none"
        />
        <circle
          cx="100" cy="100" r={r}
          stroke="var(--orange-500)" strokeWidth="14"
          strokeLinecap="round" fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 100 100)"
          style={{
            transition: "stroke-dashoffset 800ms cubic-bezier(.2,.7,.2,1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="mono"
            style={{
              fontSize: 44, fontWeight: 600, color: "var(--navy-900)",
              letterSpacing: "-0.03em",
            }}
          >
            {pct}%
          </div>
          <div
            className="muted"
            style={{
              fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >
            de participation
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparklines({
  data, tick,
}: {
  data: ColoredResult[];
  tick: number;
}) {
  const W = 280, H = 120, P = 6;
  const N = 24;
  const lines = data.map((c) => {
    const points: number[] = [];
    for (let i = 0; i < N; i++) {
      const v = c.votes * (i / (N - 1)) * (0.7 + 0.3 * Math.sin(i * 0.4 + tick * 0.3));
      points.push(Math.max(0, v));
    }
    return { c, points };
  });
  const maxV = Math.max(1, ...lines.flatMap((l) => l.points));
  const x = (i: number) => P + (i / (N - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / maxV) * (H - 2 * P);

  return (
    <div style={{ marginTop: 12 }}>
      <svg
        width="100%" height={H}
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      >
        {lines.map((l) => {
          const path = l.points
            .map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(idx)} ${y(p)}`)
            .join(" ");
          return (
            <path
              key={l.c.candidate_id}
              d={path}
              stroke={l.c.color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <div className="row gap-3" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {data.map((c) => (
          <div
            key={c.candidate_id}
            className="row items-center gap-2"
            style={{ fontSize: 11, color: "var(--ink-700)" }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: 2, background: c.color,
              }}
            />
            {c.full_name.split(" ")[0]}
          </div>
        ))}
      </div>
    </div>
  );
}
