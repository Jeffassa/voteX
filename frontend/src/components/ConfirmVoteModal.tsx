import { useState } from "react";
import { Lock } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { HoldToConfirm } from "@/components/kokonutui/hold-to-confirm";
import { fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

interface Props {
  candidate: Candidate & { color: string };
  classLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmVoteModal({ candidate, classLabel, onCancel, onConfirm }: Props) {
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
    <Modal open={true} onClose={!submitting ? onCancel : undefined} width={480}>
      <div style={{ padding: 28 }}>
        <div
          aria-hidden="true"
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: "var(--surface-2)", color: "var(--navy-900)",
            border: "1px solid var(--border)",
            display: "grid", placeItems: "center",
          }}
        >
          <Lock size={20} />
        </div>
        <h2
          style={{
            fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em",
            color: "var(--ink-900)", margin: "18px 0 8px",
          }}
        >
          Confirmer votre vote
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

        {!blank && (
          <div
            className="row items-center gap-3"
            style={{
              marginTop: 18, padding: 12,
              background: "var(--surface-2)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
            }}
          >
            <Avatar
              initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
              name={fullNameOf(candidate.student)}
              size={40}
              color={candidate.color}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-900)" }}>
                {fullNameOf(candidate.student)}
              </div>
              {classLabel && (
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{classLabel}</div>
              )}
            </div>
          </div>
        )}

        {submitting ? (
          <div
            role="status"
            className="row items-center gap-3 fade-in"
            style={{ marginTop: 22, fontSize: 14, color: "var(--ink-700)" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "2px solid var(--border-strong)",
                borderTopColor: "var(--navy-900)",
                animation: "sv-spin 0.8s linear infinite",
              }}
            />
            Enregistrement de votre bulletin…
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
