import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { CheckMark } from "@/components/SecurityPattern";
import { HoldToConfirm } from "@/components/HoldToConfirm";
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
      <div style={{ padding: "26px 26px 24px" }}>
        <div className="sv-kicker">Dernière étape</div>
        <h2 className="sv-modal-title" style={{ fontSize: 26, margin: "12px 0 8px" }}>
          Déposer votre bulletin
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 }}>
          {blank ? (
            <>Vous allez voter <strong>blanc</strong>.</>
          ) : (
            <>
              Vous allez voter pour{" "}
              <strong style={{ color: "var(--ink-950)" }}>{fullNameOf(candidate.student)}</strong>.
            </>
          )}{" "}
          Un vote enregistré ne peut plus être modifié.
        </p>

        {/* Le bulletin tel qu'il sera déposé : la ligne choisie, cochée. */}
        <div className="sv-confirm-slip">
          <span className="sv-confirm-slip-no mono" aria-hidden="true">
            {number !== undefined ? String(number).padStart(2, "0") : ""}
          </span>
          {blank ? (
            <span className="sv-ballot-blank" aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 13 }} />
          ) : (
            <Avatar
              initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
              name={fullNameOf(candidate.student)}
              size={44}
              color={candidate.color}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sv-confirm-slip-name">{blank ? "Vote blanc" : fullNameOf(candidate.student)}</div>
            {classLabel && <div className="sv-ref" style={{ marginTop: 3 }}>{classLabel}</div>}
          </div>
          <span className="sv-ballot-box" aria-hidden="true">
            <CheckMark size={15} />
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
