import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, ChevronRight, Lock } from "lucide-react";
import toast from "react-hot-toast";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { ConfirmVoteModal } from "@/components/ConfirmVoteModal";
import { useCandidates, useCastVote, useElection, useMe } from "@/lib/queries";
import { colorFor, fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

const RULES = [
  "1 seul vote par étudiant, irrévocable",
  "Vote anonyme, scellé sur la blockchain",
  "Résultats publiés dès la clôture",
];

type ColoredCandidate = Candidate & { color: string };

export default function VotingRoomPage() {
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

  const selectedCandidate = candidates.find((c) => c.id === selected);

  return (
    <div>
      <AppHeader />
      <div
        className="container container-narrow scene"
        style={{ padding: "32px 32px 120px" }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/")}
          style={{ marginLeft: -10 }}
        >
          <ArrowLeft size={14} /> Retour au tableau de bord
        </button>
        <div style={{ marginTop: 16 }}>
          <div className="h-eyebrow">
            Salle de vote{classLabel && ` · ${classLabel}`}
          </div>
          <h1 className="h-title" style={{ marginTop: 10, fontSize: 36 }}>
            {election?.title || "Élection"}
          </h1>
        </div>

        <div
          className="card"
          style={{
            marginTop: 20, padding: 18,
            background: "var(--orange-50)", borderColor: "#FFE0BD",
          }}
        >
          <div className="row items-start gap-3">
            <AlertCircle size={18} style={{ color: "var(--orange-600)", marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 14 }}>
                Règles du scrutin
              </div>
              <ul
                style={{
                  margin: "6px 0 0", padding: 0, listStyle: "none",
                  fontSize: 13, color: "var(--ink-700)",
                  display: "flex", gap: 18, flexWrap: "wrap",
                }}
              >
                {RULES.map((r, i) => (
                  <li key={i} className="row items-center gap-2">
                    <span
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: "var(--orange-500)",
                      }}
                    />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          className="sv-vote-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 20,
            marginTop: 24,
          }}
        >
          {isLoading && (
            <>
              <div className="card card-pad skel" style={{ height: 280 }} />
              <div className="card card-pad skel" style={{ height: 280 }} />
            </>
          )}
          {!isLoading && candidates.length === 0 && (
            <div className="card card-pad muted" style={{ gridColumn: "1 / -1" }}>
              Aucun candidat enregistré pour cette élection.
            </div>
          )}
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              selected={selected === c.id}
              onSelect={() => setSelected(c.id)}
              onProfile={() => setProfile(c)}
            />
          ))}
          {/* Option Vote Neutre */}
          {!isLoading && candidates.length > 0 && (
            <div
              onClick={() => setSelected("neutral")}
              className="card"
              style={{
                padding: 24, cursor: "pointer",
                borderColor: selected === "neutral" ? "var(--orange-500)" : "var(--border)",
                borderWidth: selected === "neutral" ? 2 : 1,
                boxShadow: selected === "neutral"
                  ? "0 0 0 4px var(--orange-50), var(--shadow-md)"
                  : "var(--shadow-sm)",
                transition: "all 200ms ease",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 12,
                minHeight: 200,
              }}
            >
              {selected === "neutral" && (
                <div
                  style={{
                    position: "absolute", top: 16, right: 16,
                    width: 28, height: 28, borderRadius: "50%",
                    background: "var(--orange-500)", color: "white",
                    display: "grid", placeItems: "center",
                    animation: "sv-fade-in 240ms ease",
                  }}
                >
                  <Check size={16} strokeWidth={3} />
                </div>
              )}
              <div style={{ fontSize: 40 }}>⚪</div>
              <div style={{ fontWeight: 600, fontSize: 18, color: "var(--navy-900)" }}>
                Vote Neutre / Blanc
              </div>
              <p className="muted text-center" style={{ fontSize: 13, margin: 0 }}>
                Choisissez cette option si vous ne souhaitez voter pour aucun candidat.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            position: "fixed",
            bottom: 24, left: 0, right: 0,
            display: "flex", justifyContent: "center",
            pointerEvents: "none", zIndex: 30,
          }}
        >
          <div
            className="sv-confirm-bar"
            style={{
              pointerEvents: "auto",
              background: "white",
              padding: "14px 16px 14px 24px",
              borderRadius: "var(--r-pill)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 16,
            }}
          >
            {selected === "neutral" ? (
              <>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--ink-300)", display: "grid", placeItems: "center",
                    fontWeight: 600, color: "white", fontSize: 14
                  }}
                >
                  N
                </div>
                <div style={{ fontSize: 13 }}>
                  <div className="muted" style={{ fontSize: 11 }}>Vous votez</div>
                  <div style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                    Neutre / Blanc
                  </div>
                </div>
              </>
            ) : selectedCandidate ? (
              <>
                <Avatar
                  initials={initialsOf(
                    selectedCandidate.student.first_name,
                    selectedCandidate.student.last_name
                  )}
                  size={32}
                  color={selectedCandidate.color}
                />
                <div style={{ fontSize: 13 }}>
                  <div className="muted" style={{ fontSize: 11 }}>Vous votez pour</div>
                  <div style={{ fontWeight: 600, color: "var(--navy-900)" }}>
                    {fullNameOf(selectedCandidate.student)}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  fontSize: 13, color: "var(--ink-500)", padding: "0 4px",
                }}
              >
                Sélectionnez un candidat pour continuer
              </div>
            )}
            <button
              className="btn btn-primary btn-lg"
              disabled={!selected || election?.status !== "open"}
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
              Confirmer mon vote <Lock size={16} />
            </button>
          </div>
        </div>
      </div>

      <CandidateProfileModal
        candidate={profile}
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

function CandidateCard({
  c, selected, onSelect, onProfile,
}: {
  c: ColoredCandidate;
  selected: boolean;
  onSelect: () => void;
  onProfile: () => void;
}) {
  const programItems = (c.program || "").split("\n").filter(Boolean);
  return (
    <div
      onClick={onSelect}
      className="card"
      style={{
        padding: 24, cursor: "pointer",
        borderColor: selected ? "var(--orange-500)" : "var(--border)",
        borderWidth: selected ? 2 : 1,
        boxShadow: selected
          ? "0 0 0 4px var(--orange-50), var(--shadow-md)"
          : "var(--shadow-sm)",
        transition: "all 200ms ease",
        position: "relative",
      }}
    >
      {selected && (
        <div
          style={{
            position: "absolute", top: 16, right: 16,
            width: 28, height: 28, borderRadius: "50%",
            background: "var(--orange-500)", color: "white",
            display: "grid", placeItems: "center",
            animation: "sv-fade-in 240ms ease",
          }}
        >
          <Check size={16} strokeWidth={3} />
        </div>
      )}
      <div className="row items-center gap-3">
        <Avatar
          initials={initialsOf(c.student.first_name, c.student.last_name)}
          size={56}
          color={c.color}
          src={c.photo_url || c.student.photo_url || undefined}
        />
        <div>
          <div
            style={{
              fontSize: 18, fontWeight: 600,
              color: "var(--navy-900)", letterSpacing: "-0.015em",
            }}
          >
            {fullNameOf(c.student)}
          </div>
          <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>
            {c.student.matricule}
          </div>
        </div>
      </div>
      {c.slogan && (
        <div
          style={{
            marginTop: 16, padding: "10px 12px",
            background: "var(--surface-2)",
            borderRadius: "var(--r-md)",
            fontSize: 13, fontStyle: "italic",
            color: "var(--ink-700)",
            borderLeft: `3px solid ${c.color}`,
          }}
        >
          « {c.slogan} »
        </div>
      )}
      {programItems.length > 0 && (
        <ul
          style={{
            margin: "16px 0 0", padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          {programItems.slice(0, 3).map((p, i) => (
            <li
              key={i}
              className="row items-start gap-2"
              style={{ fontSize: 13, color: "var(--ink-700)" }}
            >
              <Check
                size={14}
                style={{ color: c.color, flexShrink: 0, marginTop: 3 }}
                strokeWidth={2.5}
              />
              {p}
            </li>
          ))}
        </ul>
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 16, padding: "6px 0", color: "var(--navy-700)" }}
        onClick={(e) => {
          e.stopPropagation();
          onProfile();
        }}
      >
        Voir le profil détaillé <ChevronRight size={14} />
      </button>
    </div>
  );
}
