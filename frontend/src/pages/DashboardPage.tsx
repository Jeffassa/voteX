import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Hash } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Avatar, getInitials } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { HashChip } from "@/components/HashChip";
import { Rosette, Stamp } from "@/components/SecurityPattern";
import { formatDateTime } from "@/lib/dates";
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
      <div ref={pageRef} className="container" style={{ padding: "36px 32px 80px" }}>
        <div className="row items-center gap-4" style={{ marginBottom: 28 }}>
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)} name={`${me?.first_name ?? ""} ${me?.last_name ?? ""}`}
            size={60}
            src={me?.photo_url || undefined}
          />
          <div style={{ minWidth: 0 }}>
            <div className="sv-ref">Espace électeur</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 34, fontWeight: 540, color: "var(--navy-900)", lineHeight: 1.1 }}>
              {meLoading ? "…" : me?.first_name ? `Bonjour, ${me.first_name}.` : "Bonjour."}
            </h1>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
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
          <div className="card" style={{ padding: 32 }}>
            <p className="sv-display" style={{ margin: 0, fontSize: 22, fontWeight: 540, color: "var(--navy-900)" }}>
              Aucune élection en cours pour votre classe.
            </p>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
              Vous serez convoqué ici dès l'ouverture d'un scrutin.
            </p>
          </div>
        )}

        <div
          className="sv-dashboard-lower"
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
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
  // Un compte à rebours figé sur 00:00:00 ne dit rien : on l'explique.
  const overdue = targetEnd < Date.now();
  return (
    <section aria-labelledby="active-election" className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Convocation : en-tête guilloché, comme un document officiel. */}
      <div className="sv-navy-panel" style={{ padding: "26px 32px 28px" }}>
        <Rosette size={440} style={{ right: -130, top: -150 }} />
        <div className="row items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span
            className="badge"
            style={{
              background: isOpen ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.08)",
              borderColor: isOpen ? "rgba(134,239,172,0.45)" : "rgba(255,255,255,0.3)",
              color: isOpen ? "#a7f3c0" : "white",
            }}
          >
            {isOpen && <span className="dot" style={{ background: "#86EFAC", width: 6, height: 6, borderRadius: 1 }} />}
            {STATUS_LABEL[election.status] ?? election.status}
          </span>
          <span className="sv-ref" style={{ color: "rgba(255,255,255,0.6)" }}>Convocation au scrutin</span>
        </div>
        <h2 id="active-election" className="sv-display" style={{ fontSize: 34, fontWeight: 540, margin: "14px 0 0", lineHeight: 1.1, maxWidth: 680 }}>
          {election.title}
        </h2>
        <div style={{ marginTop: 8, fontSize: 13.5, color: "rgba(255,255,255,0.7)" }}>
          Du {formatDateTime(election.starts_at)} au {formatDateTime(election.ends_at)}
        </div>
      </div>

      <div
        className="sv-dashboard-active"
        style={{
          padding: "26px 32px 28px", display: "grid",
          gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: "var(--ink-500)" }}>
            {!isOpen ? "Scrutin clos" : overdue ? "Date de fin passée" : "Clôture du scrutin dans"}
          </div>
          {isOpen && !overdue && (
            <div style={{ marginTop: 10 }}>
              <Countdown targetMs={targetEnd} />
            </div>
          )}
          {isOpen && overdue && (
            <p className="sv-display" style={{ margin: "6px 0 0", fontSize: 20, color: "var(--navy-900)" }}>
              Le scrutin va être clôturé par l'administration.
            </p>
          )}
        </div>
        <div className="col gap-3" style={{ alignItems: "flex-end" }}>
          {hasVoted ? (
            <>
              <Stamp small>A voté</Stamp>
              <span className="sr-only">Vous avez voté.</span>
              <Link to={`/elections/${election.id}/results`} className="btn btn-outline" style={{ marginTop: 6 }}>
                Suivre la participation <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          ) : isOpen ? (
            <Link to={`/elections/${election.id}/vote`} className="btn btn-primary btn-lg">
              Voter maintenant <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link to={`/elections/${election.id}/results`} className="btn btn-outline">
              Voir les résultats <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function VoteHistoryCard({
  votes, elections,
}: {
  votes: NonNullable<ReturnType<typeof useMyVotes>["data"]>;
  elections: NonNullable<ReturnType<typeof useElections>["data"]>;
}) {
  return (
    <section aria-labelledby="my-receipts" className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="sv-card-head">
        <h2 id="my-receipts">Mes reçus de vote</h2>
        <span className="sv-ref">{votes.length}</span>
      </div>
      {votes.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5, margin: 0, padding: "18px 20px 22px" }}>
          Aucun vote pour l'instant. Chaque vote vous laissera ici un reçu et son empreinte.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {votes.map((v, i) => (
            <li
              key={v.id}
              className="row items-center justify-between gap-3"
              style={{ padding: "14px 20px", borderTop: i ? "1.5px dashed var(--border)" : undefined, flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="sv-display" style={{ fontSize: 17, fontWeight: 560, color: "var(--navy-900)" }}>
                  {elections.find((e) => e.id === v.election_id)?.title || "Vote"}
                </div>
                <div className="sv-ref" style={{ marginTop: 3 }}>
                  {new Date(v.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <HashChip value={v.vote_hash} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VerificationPanel() {
  return (
    <section aria-labelledby="verify-title" className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="sv-card-head">
        <h2 id="verify-title">Vérifier un reçu</h2>
      </div>
      <div style={{ padding: "16px 20px 20px" }}>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
          Chaque vote produit une empreinte unique. Vous pouvez à tout moment vérifier
          qu'elle a bien été enregistrée sur la blockchain, sans dévoiler pour qui
          vous avez voté.
        </p>
        <Link to="/verify" className="btn btn-outline" style={{ marginTop: 16, width: "100%" }}>
          <Hash size={16} aria-hidden="true" /> Vérifier une empreinte
        </Link>
      </div>
    </section>
  );
}
