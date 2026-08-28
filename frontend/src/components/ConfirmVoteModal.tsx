import { useState } from "react";
import { Lock } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
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
  const [stage, setStage] = useState<"idle" | "signing" | "mining">("idle");

  const fire = async () => {
    setSubmitting(true);
    setStage("signing");
    setTimeout(() => setStage("mining"), 900);
    try {
      await onConfirm();
    } catch {
      setSubmitting(false);
      setStage("idle");
    }
  };

  return (
    <Modal open={true} onClose={!submitting ? onCancel : undefined} width={500}>
      <div style={{ padding: 32 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--orange-50)", color: "var(--orange-600)",
            display: "grid", placeItems: "center",
          }}
        >
          <Lock size={22} />
        </div>
        <h3
          style={{
            fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em",
            color: "var(--navy-900)", margin: "20px 0 8px",
          }}
        >
          Confirmer votre vote
        </h3>
        <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 }}>
          Vous êtes sur le point de voter pour{" "}
          <strong style={{ color: "var(--navy-900)" }}>{fullNameOf(candidate.student)}</strong>.
          Cette action est <strong>définitive</strong> et sera scellée sur la blockchain.
        </p>

        <div
          className="row items-center gap-3"
          style={{
            marginTop: 20, padding: 14,
            background: "var(--surface-2)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
          }}
        >
          <Avatar
            initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
            size={40}
            color={candidate.color}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy-900)" }}>
              {fullNameOf(candidate.student)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {classLabel || "—"}
            </div>
          </div>
          <span className="badge badge-orange">Sélectionné</span>
        </div>

        {submitting && (
          <div
            className="row items-center gap-3 fade-in"
            style={{
              marginTop: 20, padding: 16,
              background: "var(--navy-900)",
              borderRadius: "var(--r-md)",
              color: "white",
            }}
          >
            <div style={{ position: "relative", width: 36, height: 36 }}>
              <div
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: "2px solid rgba(255,122,0,0.3)",
                  borderTopColor: "var(--orange-500)",
                  animation: "sv-spin 0.8s linear infinite",
                }}
              />
              <div
                style={{
                  position: "absolute", inset: 0,
                  display: "grid", placeItems: "center",
                  color: "var(--orange-400)",
                }}
              >
                <Lock size={14} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {stage === "signing"
                  ? "Signature cryptographique du bulletin…"
                  : "Scellement on-chain en cours…"}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4,
                }}
              >
                {stage === "mining"
                  ? "transaction en attente de validation…"
                  : "préparation du payload"}
              </div>
            </div>
          </div>
        )}

        {!submitting && (
          <div className="row gap-3" style={{ marginTop: 24 }}>
            <button className="btn btn-outline btn-lg" onClick={onCancel} style={{ flex: 1 }}>
              Annuler
            </button>
            <button className="btn btn-primary btn-lg" onClick={fire} style={{ flex: 1 }}>
              Confirmer mon vote
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
