import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Lock } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { ConfirmVoteModal } from "@/components/ConfirmVoteModal";
import { BallotCross, Microtext, WaveBand } from "@/components/SecurityPattern";
import { formatDateTime } from "@/lib/dates";
import { useCandidates, useCastVote, useElection, useMe } from "@/lib/queries";
import { colorFor, fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

const RULES = [
  "Un seul vote par étudiant, définitif",
  "Vote secret : votre choix n'est lié à aucun nom",
  "Résultats publiés à la clôture",
];

type ColoredCandidate = Candidate & { color: string };

export default function VotingRoomPage() {
  // Salle de vote : entrée volontairement discrète et rapide. Le geste à
  // accomplir prime, l'animation ne doit ni retarder ni distraire.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 10 });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string | null>(null);
  const [profile, setProfile] = useState<ColoredCandidate | null>(null);
  const [confirming, setConfirming] = useState<ColoredCandidate | null>(null);

  const { data: me } = useMe();
  const { data: election } = useElection(id);
  const { data: rawCandidates, isLoading } = useCandidates(id);
  const castVote = useCastVote();

  const candidates: ColoredCandidate[] = useMemo(
    () => (rawCandidates || []).map((c, i) => ({ ...c, color: colorFor(i) })),
    [rawCandidates]
  );

  const classLabel = me?.classroom
    ? `${me.classroom.level} ${me.classroom.name}`
    : undefined;

  const selectedIndex = candidates.findIndex((c) => c.id === selected);
  const selectedCandidate = selectedIndex >= 0 ? candidates[selectedIndex] : undefined;
  const isOpen = election?.status === "open";
  const numberOf = (c: Candidate) => candidates.findIndex((x) => x.id === c.id) + 1;

  return (
    <div>
      <AppHeader />
      <div
        ref={pageRef}
        className="container container-narrow scene"
        style={{ padding: "28px 32px 150px" }}
      >
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}>
          <ArrowLeft size={14} aria-hidden="true" /> Tableau de bord
        </Link>

        {/* Un bulletin unique : chaque candidat sur sa ligne, avec son numéro
            et la case où l'électeur trace sa croix. */}
        <article className="sv-ballot" aria-labelledby="ballot-title" style={{ marginTop: 14 }}>
          <header className="sv-ballot-head">
            <WaveBand height={22} />
            <div style={{ padding: "18px 28px 20px" }}>
              <div className="sv-ref">Bulletin de vote{classLabel && ` · ${classLabel}`}</div>
              <h1 id="ballot-title" className="sv-ballot-title">
                {election?.title || "Élection"}
              </h1>
              {election && (
                <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-500)" }}>
                  {isOpen
                    ? `Scrutin ouvert jusqu'au ${formatDateTime(election.ends_at)}.`
                    : "Ce scrutin n'est pas ouvert : le bulletin est présenté pour information."}
                </p>
              )}
              <ol className="sv-ballot-rules">
                {RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
            <Microtext style={{ padding: "0 28px 8px" }} />
          </header>

          <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} disabled={!isOpen}>
            <legend className="sr-only">Choisissez un candidat, ou le vote blanc</legend>
            {isLoading && (
              <div style={{ padding: 24 }}>
                <div className="skel" style={{ height: 88, marginBottom: 12 }} />
                <div className="skel" style={{ height: 88 }} />
              </div>
            )}
            {!isLoading && candidates.length === 0 && (
              <p className="muted" style={{ padding: 28, margin: 0 }}>
                Aucun candidat enregistré pour cette élection.
              </p>
            )}
            {candidates.map((c, i) => (
              <BallotEntry
                key={c.id}
                number={i + 1}
                name={fullNameOf(c.student)}
                detail={c.student.matricule}
                slogan={c.slogan}
                portrait={
                  <Avatar
                    initials={initialsOf(c.student.first_name, c.student.last_name)}
                    name={fullNameOf(c.student)}
                    size={60}
                    src={c.photo_url || c.student.photo_url || undefined}
                  />
                }
                selected={selected === c.id}
                onSelect={() => setSelected(c.id)}
                onProfile={() => setProfile(c)}
              />
            ))}
            {!isLoading && candidates.length > 0 && (
              <BallotEntry
                name="Vote blanc"
                detail="Aucun candidat"
                note="Vous ne choisissez personne ; votre participation est comptée."
                portrait={<span className="sv-ballot-blank" aria-hidden="true" />}
                selected={selected === "neutral"}
                onSelect={() => setSelected("neutral")}
              />
            )}
          </fieldset>
        </article>

        <div className="sv-confirm-dock">
          <div className="sv-confirm-bar">
            <div className="sv-confirm-choice" aria-live="polite">
              <small>Votre choix</small>
              <strong>
                {selected === "neutral"
                  ? "Vote blanc"
                  : selectedCandidate
                  ? `N° ${String(selectedIndex + 1).padStart(2, "0")} · ${fullNameOf(selectedCandidate.student)}`
                  : "Cochez une case du bulletin"}
              </strong>
            </div>
            <button
              className="btn btn-accent btn-lg"
              disabled={!selected || !isOpen}
              onClick={() => {
                if (selected === "neutral") {
                  setConfirming({
                    id: "neutral",
                    election_id: id!,
                    student: { id: "neutral", first_name: "Vote", last_name: "Neutre", matricule: "BLANC", photo_url: null },
                    color: "#94A3B8",
                    slogan: "Vote Blanc",
                    program: "",
                    photo_url: null,
                    biography: null,
                    blockchain_id: null,
                    created_at: new Date().toISOString(),
                  } as ColoredCandidate);
                } else if (selectedCandidate) {
                  setConfirming(selectedCandidate);
                }
              }}
            >
              Confirmer mon vote <Lock size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <CandidateProfileModal
        candidate={profile}
        number={profile ? numberOf(profile) : undefined}
        classLabel={classLabel}
        onClose={() => setProfile(null)}
        onSelect={(c) => {
          setSelected(c.id);
          setProfile(null);
        }}
      />

      {confirming && (
        <ConfirmVoteModal
          candidate={confirming}
          number={confirming.id === "neutral" ? undefined : numberOf(confirming)}
          classLabel={classLabel}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            try {
              const receipt = await castVote.mutateAsync({
                election_id: id!,
                candidate_id: confirming.id === "neutral" ? null : confirming.id,
              });
              toast.success("Vote enregistré");
              navigate(`/elections/${id}/receipt`, {
                state: { receipt, candidate: confirming },
              });
            } catch (e: any) {
              toast.error(e?.response?.data?.detail || "Erreur lors du vote");
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Une ligne du bulletin. Le choix est un vrai bouton radio (masqué) : flèches
 * du clavier, lecteur d'écran et formulaire natif fonctionnent sans code.
 */
function BallotEntry({
  number, name, detail, slogan, note, portrait, selected, onSelect, onProfile,
}: {
  number?: number;
  name: string;
  detail: string;
  slogan?: string | null;
  note?: string;
  portrait: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  onProfile?: () => void;
}) {
  return (
    <div className={`sv-ballot-entry${selected ? " is-selected" : ""}`}>
      <label className="sv-ballot-choice">
        <input type="radio" name="ballot" className="sr-only" checked={selected} onChange={onSelect} />
        <span className="sv-ballot-no" aria-hidden="true">
          {number !== undefined && (
            <>
              <small>N°</small>
              {String(number).padStart(2, "0")}
            </>
          )}
        </span>
        {portrait}
        <span style={{ minWidth: 0 }}>
          <span className="sv-ballot-name">{name}</span>
          <span className="sv-ref" style={{ display: "block", marginTop: 3 }}>{detail}</span>
          {slogan && <span className="sv-ballot-slogan">« {slogan} »</span>}
          {note && <span style={{ display: "block", marginTop: 6, fontSize: 13.5, color: "var(--ink-500)" }}>{note}</span>}
        </span>
        <span className="sv-ballot-box">{selected && <BallotCross />}</span>
      </label>
      {onProfile && (
        <button type="button" className="sv-ballot-more" onClick={onProfile}>
          Programme et biographie <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
