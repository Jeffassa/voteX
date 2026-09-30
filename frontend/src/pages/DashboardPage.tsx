import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Hash, History, Shield } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Avatar, getInitials } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { HashChip } from "@/components/HashChip";
import { useElections, useMe, useMyVotes } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  draft: "En préparation",
  open: "Scrutin ouvert",
  closed: "Scrutin clos",
  published: "Résultats publiés",
};

export default function DashboardPage() {
  // En-tête, carte de scrutin, puis les deux colonnes du bas : l'ordre
  // d'apparition suit l'ordre de lecture.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *" });
  const { data: me, isLoading: meLoading } = useMe();
  const { data: elections } = useElections();
  const { data: myVotes } = useMyVotes();

  const activeElection = useMemo(
    () => elections?.find((e) => e.status === "open") || elections?.[0],
    [elections]
  );

  const targetEnd = activeElection
    ? new Date(activeElection.ends_at).getTime()
    : Date.now() + 1000 * 60 * 60 * 38;

  const hasVoted = !!myVotes?.find((v) => v.election_id === activeElection?.id);

  const classLabel = me?.classroom
    ? `${me.classroom.level} ${me.classroom.name}`
    : "Aucune classe assignée";

  return (
    <div>
      <AppHeader />
      <div ref={pageRef} className="container" style={{ padding: "40px 32px 80px" }}>
        <div className="row items-center gap-4" style={{ marginBottom: 36 }}>
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)} name={`${me?.first_name ?? ""} ${me?.last_name ?? ""}`}
            size={56}
            color="#0A2540"
          />
          <div>
            <h1
              style={{
                margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em",
                color: "var(--navy-900)",
              }}
            >
              {meLoading ? "…" : me?.first_name ? `Bonjour, ${me.first_name}.` : "Bonjour."}
            </h1>
            <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
              <span className="mono">{me?.matricule ?? ""}</span> · {classLabel}
            </div>
          </div>
        </div>

        {activeElection ? (
          <ActiveElectionCard
            election={activeElection}
            targetEnd={targetEnd}
            hasVoted={hasVoted}
            isOpen={activeElection.status === "open"}
          />
        ) : (
          <div className="card card-pad text-center muted">
            Aucune élection en cours pour votre classe.
          </div>
        )}

        <div
          className="sv-dashboard-lower"
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 20,
            marginTop: 20,
          }}
        >
          <VoteHistoryCard votes={myVotes || []} elections={elections || []} />
          <VerificationPanel />
        </div>
      </div>
    </div>
  );
}

function ActiveElectionCard({
  election, targetEnd, hasVoted, isOpen,
}: {
  election: NonNullable<ReturnType<typeof useElections>["data"]>[number];
  targetEnd: number;
  hasVoted: boolean;
  isOpen: boolean;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          padding: "28px 32px",
          background: "var(--navy-900)",
          color: "white",
          position: "relative", overflow: "hidden",
        }}
      >
        <div className="row items-center gap-2" style={{ marginBottom: 12 }}>
          <span
            className="badge badge-open"
            style={{ background: "rgba(34, 197, 94, 0.18)", color: "#86EFAC" }}
          >
            <span className="dot" style={{ background: "#86EFAC" }} />
            {STATUS_LABEL[election.status] ?? election.status}
          </span>
        </div>
        <h2
          style={{
            fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em",
            margin: 0, position: "relative",
          }}
        >
          {election.title}
        </h2>
        <div
          style={{
            marginTop: 6, fontSize: 13,
            color: "rgba(255,255,255,0.6)", position: "relative",
          }}
        >
          Du {new Date(election.starts_at).toLocaleString("fr-FR")} au{" "}
          {new Date(election.ends_at).toLocaleString("fr-FR")}
        </div>
      </div>

      <div
        className="sv-dashboard-active"
        style={{
          padding: 32, display: "grid",
          gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center",
          position: "relative",
        }}
      >
        <div>
          <div className="row items-center gap-2">
            <Clock size={18} aria-hidden="true" style={{ color: "var(--ink-500)" }} />
            <span className="h-eyebrow">Clôture du scrutin dans</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <Countdown targetMs={targetEnd} />
          </div>
        </div>
        <div className="col gap-3" style={{ alignItems: "flex-end" }}>
          {hasVoted ? (
            <>
              <div
                className="row items-center gap-2"
                style={{ color: "var(--success-600)", fontWeight: 500, fontSize: 14 }}
              >
                <CheckCircle2 size={18} /> Vous avez voté
              </div>
              <Link
                to={`/elections/${election.id}/results`}
                className="btn btn-outline"
              >
                Suivre la participation <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          ) : isOpen ? (
            <Link
              to={`/elections/${election.id}/vote`}
              className="btn btn-primary btn-lg"
            >
              Voter maintenant <ArrowRight size={16} />
            </Link>
          ) : (
            <Link
              to={`/elections/${election.id}/results`}
              className="btn btn-outline"
            >
              Voir les résultats <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function VoteHistoryCard({
  votes, elections,
}: {
  votes: NonNullable<ReturnType<typeof useMyVotes>["data"]>;
  elections: NonNullable<ReturnType<typeof useElections>["data"]>;
}) {
  return (
    <div className="card card-pad">
      <div className="row items-center gap-2" style={{ marginBottom: 18 }}>
        <History size={18} style={{ color: "var(--ink-500)" }} />
        <div
          style={{
            fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.01em",
          }}
        >
          Historique de mes votes
        </div>
      </div>
      <div className="col gap-2">
        {votes.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            Aucun vote pour l'instant.
          </div>
        ) : (
          votes.map((v) => (
            <div
              key={v.id}
              className="row items-center justify-between"
              style={{
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14, fontWeight: 500, color: "var(--navy-900)",
                  }}
                >
                  {elections.find((e) => e.id === v.election_id)?.title || "Vote"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {new Date(v.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <HashChip value={v.vote_hash} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VerificationPanel() {
  return (
    <div className="card card-pad">
      <div className="row items-center gap-2" style={{ marginBottom: 18 }}>
        <Shield size={18} style={{ color: "var(--ink-500)" }} />
        <div
          style={{
            fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.01em",
          }}
        >
          Vérification
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
        Chaque vote produit un hash unique. Vous pouvez à tout moment vérifier
        qu'il a bien été enregistré sur la blockchain, sans dévoiler pour qui
        vous avez voté.
      </p>
      <Link
        to="/verify"
        className="btn btn-outline"
        style={{ marginTop: 16, width: "100%" }}
      >
        <Hash size={16} /> Vérifier un hash
      </Link>
    </div>
  );
}
