import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, Hash, ShieldCheck } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Avatar, getInitials } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { HashChip } from "@/components/HashChip";
import { BrandEcho, Stamp } from "@/components/SecurityPattern";
import { formatDateTime } from "@/lib/dates";
import { useElections, useMe, useMyVotes } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  draft: "En préparation",
  open: "Scrutin ouvert",
  closed: "Scrutin clos",
  published: "Résultats publiés",
};

type Election = NonNullable<ReturnType<typeof useElections>["data"]>[number];
type MyVote = NonNullable<ReturnType<typeof useMyVotes>["data"]>[number];

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

  const hasVoted = !!myVotes?.find((v) => v.election_id === activeElection?.id);
  const classLabel = me?.classroom ? `${me.classroom.level} ${me.classroom.name}` : "Aucune classe assignée";

  return (
    <div>
      <AppHeader />
      <div ref={pageRef} className="container" style={{ maxWidth: 1120, padding: "40px 32px 88px" }}>
        <header className="sv-dash-head">
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)}
            name={`${me?.first_name ?? ""} ${me?.last_name ?? ""}`}
            size={56}
            src={me?.photo_url || undefined}
          />
          <div style={{ minWidth: 0 }}>
            <div className="sv-kicker">Espace électeur</div>
            <h1 className="sv-dash-title">
              {meLoading ? "…" : me?.first_name ? `Bonjour, ${me.first_name}` : "Bonjour"}
            </h1>
            <div className="sv-dash-meta">
              <span className="mono">{me?.matricule ?? ""}</span>
              <span aria-hidden="true" className="sv-dot-sep" />
              <span>{classLabel}</span>
            </div>
          </div>
        </header>

        {activeElection ? (
          <ElectionHero election={activeElection} hasVoted={hasVoted} />
        ) : (
          <section className="card sv-dash-empty">
            <span className="sv-empty-icon" aria-hidden="true"><CalendarDays size={20} /></span>
            <div>
              <p className="sv-dash-empty-title">Aucun scrutin pour votre classe</p>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                Le bulletin apparaîtra ici dès l'ouverture d'un scrutin.
              </p>
            </div>
          </section>
        )}

        <div className="sv-dashboard-lower sv-dash-lower">
          <VoteHistoryCard votes={myVotes || []} elections={elections || []} />
          <VerificationPanel />
        </div>
      </div>
    </div>
  );
}

function ElectionHero({ election, hasVoted }: { election: Election; hasVoted: boolean }) {
  const isOpen = election.status === "open";
  const targetEnd = new Date(election.ends_at).getTime();
  const notStarted = isOpen && new Date(election.starts_at).getTime() > Date.now();
  // Un compte à rebours figé sur 00:00:00 ne dit rien : on l'explique.
  const overdue = isOpen && targetEnd < Date.now();

  return (
    <section aria-labelledby="active-election" className="sv-navy-panel sv-hero-card">
      <BrandEcho size={400} style={{ right: 28, bottom: -36 }} />
      <div className="sv-hero-top">
        <span className={`sv-chip-dark${isOpen ? " is-live" : ""}`}>
          {isOpen && <span className="dot" aria-hidden="true" />}
          {STATUS_LABEL[election.status] ?? election.status}
        </span>
        <span className="sv-hero-sub">Scrutin de votre classe</span>
      </div>

      <h2 id="active-election" className="sv-hero-title">{election.title}</h2>
      <p className="sv-hero-period">
        <CalendarDays size={15} aria-hidden="true" />
        Du {formatDateTime(election.starts_at)} au {formatDateTime(election.ends_at)}
      </p>

      <div className="sv-hero-bottom">
        <div style={{ minWidth: 0 }}>
          {isOpen && !overdue ? (
            <>
              <div className="sv-hero-label">{notStarted ? "Ouverture prévue" : "Clôture dans"}</div>
              <div style={{ marginTop: 12 }}>
                <Countdown targetMs={notStarted ? new Date(election.starts_at).getTime() : targetEnd} />
              </div>
            </>
          ) : isOpen ? (
            <p className="sv-hero-note">L'heure de fin est passée : le scrutin se clôt dans un instant.</p>
          ) : (
            <p className="sv-hero-note">
              Clos le {formatDateTime(election.ends_at)}.{" "}
              {election.status === "published" ? "Les résultats sont publiés." : "Les résultats sont disponibles."}
            </p>
          )}
        </div>

        <div className="sv-hero-actions">
          {hasVoted ? (
            <>
              <Stamp small>A voté</Stamp>
              <span className="sr-only">Vous avez voté.</span>
              <Link to={`/elections/${election.id}/results`} className="btn sv-btn-on-dark">
                {isOpen ? "Suivre la participation" : "Voir les résultats"} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          ) : isOpen && !notStarted && !overdue ? (
            <Link to={`/elections/${election.id}/vote`} className="btn btn-accent btn-lg">
              Voter maintenant <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link to={`/elections/${election.id}/results`} className="btn sv-btn-on-dark">
              Voir les résultats <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function VoteHistoryCard({ votes, elections }: { votes: MyVote[]; elections: Election[] }) {
  return (
    <section aria-labelledby="my-receipts" className="card" style={{ overflow: "hidden" }}>
      <div className="sv-card-head">
        <h2 id="my-receipts">Mes participations</h2>
        <span className="sv-count-pill">{votes.length}</span>
      </div>
      {votes.length === 0 ? (
        <p className="muted" style={{ fontSize: 14, margin: 0, padding: "20px 20px 24px" }}>
          Aucun vote pour l'instant. Chaque participation s'inscrira ici.
        </p>
      ) : (
        <ol className="sv-timeline">
          {votes.map((v) => (
            <li key={v.id}>
              <span className="sv-timeline-mark" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sv-timeline-title">
                  {elections.find((e) => e.id === v.election_id)?.title || "Scrutin"}
                </div>
                <div className="sv-timeline-meta">
                  {new Date(v.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  {" · "}Participation enregistrée
                </div>
              </div>
              {/* Le serveur ne réexpose pas l'empreinte (elle relierait un
                  compte à son bulletin) : elle ne figure que sur le reçu remis
                  au moment du vote. */}
              {v.vote_hash.startsWith("0x") && <HashChip value={v.vote_hash} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function VerificationPanel() {
  return (
    <section aria-labelledby="verify-title" className="card sv-verify-card">
      <span className="sv-verify-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
      <h2 id="verify-title" className="sv-verify-title">Vérifier un reçu</h2>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "6px 0 0" }}>
        Chaque vote produit une empreinte unique. Contrôlez qu'elle est bien comptée,
        sans révéler votre choix.
      </p>
      <Link to="/verify" className="btn btn-outline" style={{ marginTop: 18, width: "100%" }}>
        <Hash size={16} aria-hidden="true" /> Vérifier une empreinte
      </Link>
    </section>
  );
}
