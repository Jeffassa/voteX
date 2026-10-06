import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { BallotCross, WaveBand } from "@/components/SecurityPattern";
import { HoldToConfirm } from "@/components/kokonutui/hold-to-confirm";
import { fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

interface Props {
  candidate: Candidate & { color: string };
  /** Numéro du candidat sur le bulletin ; absent pour le vote blanc. */
  number?: number;
  classLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmVoteModal({ candidate, number, classLabel, onCancel, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const blank = candidate.id === "neutral";

  const fire = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={true} onClose={!submitting ? onCancel : undefined} width={500}>
      <WaveBand height={18} />
      <div style={{ padding: "22px 28px 26px" }}>
        <div className="sv-ref">Dernière étape</div>
        <h2 className="sv-display" style={{ fontSize: 28, fontWeight: 560, color: "var(--navy-900)", margin: "4px 0 8px", lineHeight: 1.1 }}>
          Déposer votre bulletin
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 }}>
          {blank ? (
            <>Vous allez voter <strong>blanc</strong>.</>
          ) : (
            <>
              Vous allez voter pour{" "}
              <strong style={{ color: "var(--ink-900)" }}>{fullNameOf(candidate.student)}</strong>.
            </>
          )}{" "}
          Un vote enregistré ne peut plus être modifié.
        </p>

        {/* Le bulletin tel qu'il sera déposé : la ligne choisie, croix tracée. */}
        <div
          className="row items-center gap-3"
          style={{
            marginTop: 18, padding: "12px 14px 12px 0",
            border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "#fff8ef",
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden="true"
            className="sv-display"
            style={{
              alignSelf: "stretch", margin: "-12px 0", width: 56, display: "grid", placeItems: "center",
              borderRight: "1.5px dashed var(--border-strong)", fontSize: 24, color: "var(--orange-600)",
              background: "repeating-linear-gradient(135deg, rgba(255,122,0,0.1) 0 1px, transparent 1px 6px), #fff3e6",
            }}
          >
            {number !== undefined ? String(number).padStart(2, "0") : ""}
          </span>
          {blank ? (
            <span className="sv-ballot-blank" aria-hidden="true" style={{ width: 40, height: 40 }} />
          ) : (
            <Avatar
              initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
              name={fullNameOf(candidate.student)}
              size={40}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sv-display" style={{ fontWeight: 560, fontSize: 18, color: "var(--navy-900)", lineHeight: 1.2 }}>
              {blank ? "Vote blanc" : fullNameOf(candidate.student)}
            </div>
            {classLabel && <div className="sv-ref" style={{ marginTop: 2 }}>{classLabel}</div>}
          </div>
          <span className="sv-ballot-box" aria-hidden="true" style={{ width: 30, height: 30 }}>
            <BallotCross size={18} />
          </span>
        </div>

        {submitting ? (
          <div
            role="status"
            className="row items-center gap-3 fade-in"
            style={{ marginTop: 22, fontSize: 14, color: "var(--ink-700)" }}
          >
            <span className="sv-spinner" aria-hidden="true" style={{ width: 18, height: 18, borderWidth: 2 }} />
            Dépôt de votre bulletin dans l'urne…
          </div>
        ) : (
          <div className="row gap-3" style={{ marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn btn-outline btn-lg" onClick={onCancel} style={{ flex: "1 1 140px" }}>
              Annuler
            </button>
            <HoldToConfirm onConfirm={fire} className="sv-hold-confirm">
              Maintenir pour voter
            </HoldToConfirm>
          </div>
        )}
        {!submitting && (
          <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
            Gardez le bouton appuyé une seconde, à la souris, au doigt ou avec la touche Espace.
          </p>
        )}
      </div>
    </Modal>
  );
}
