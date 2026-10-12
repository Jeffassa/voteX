import { ArrowRight, X } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

interface Props {
  candidate: (Candidate & { color: string }) | null;
  /** Numéro du candidat sur le bulletin. */
  number?: number;
  classLabel?: string;
  onClose: () => void;
  onSelect: (c: Candidate) => void;
}

/** Profession de foi du candidat : portrait, programme, biographie, slogan. */
export function CandidateProfileModal({ candidate, number, classLabel, onClose, onSelect }: Props) {
  if (!candidate) return null;

  const programItems = (candidate.program || "").split("\n").filter(Boolean);
  const name = fullNameOf(candidate.student);

  return (
    <Modal open={true} onClose={onClose} width={640}>
      <div style={{ padding: "24px 32px 30px", position: "relative" }}>
        <button
          className="btn btn-ghost btn-icon"
          style={{ position: "absolute", top: 14, right: 16 }}
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="row items-start gap-4">
          <Avatar
            initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
            name={name}
            size={88}
            color={candidate.color}
            src={candidate.photo_url || candidate.student.photo_url || undefined}
          />
          <div style={{ minWidth: 0, paddingTop: 2 }}>
            <div className="sv-kicker">
              {number !== undefined ? `Candidat n° ${String(number).padStart(2, "0")}` : "Candidat"}
            </div>
            <h2 className="sv-display" style={{ fontSize: 30, fontWeight: 650, margin: "10px 0 0", color: "var(--ink-950)", lineHeight: 1.05 }}>
              {name}
            </h2>
            <div className="sv-ref" style={{ marginTop: 6 }}>
              {candidate.student.matricule}
              {classLabel && <> · {classLabel}</>}
            </div>
          </div>
        </div>

        {candidate.slogan && (
          <blockquote
            className="sv-quote"
            style={{
              margin: "24px 0 0", padding: "16px 18px", borderRadius: 14, background: "var(--copper-50)",
              boxShadow: "inset 3px 0 0 var(--copper-500)", fontSize: 19, fontWeight: 640, letterSpacing: "-0.015em",
              lineHeight: 1.4, color: "var(--ink-950)",
            }}
          >
            « {candidate.slogan} »
          </blockquote>
        )}

        {programItems.length > 0 && (
          <section style={{ marginTop: 22 }} aria-labelledby="cand-program">
            <h3 id="cand-program" className="sv-kicker" style={{ margin: 0 }}>
              Programme
            </h3>
            <ol style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
              {programItems.map((p, i) => (
                <li
                  key={i}
                  className="row items-start"
                  style={{ gap: 14, padding: "10px 0", borderTop: i ? "1px solid var(--border)" : undefined, fontSize: 14.5, color: "var(--ink-900)", lineHeight: 1.5 }}
                >
                  <span
                    aria-hidden="true"
                    className="mono"
                    style={{ width: 24, flexShrink: 0, fontSize: 12, lineHeight: 1.9, color: "var(--copper-700)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </section>
        )}

        {candidate.biography && (
          <section style={{ marginTop: 18 }} aria-labelledby="cand-bio">
            <h3 id="cand-bio" className="sv-kicker" style={{ margin: 0 }}>
              Biographie
            </h3>
            <p style={{ fontSize: 14.5, color: "var(--ink-700)", lineHeight: 1.65, margin: "8px 0 0" }}>
              {candidate.biography}
            </p>
          </section>
        )}

        <div className="row gap-3" style={{ marginTop: 28, flexWrap: "wrap" }}>
          <button className="btn btn-outline btn-lg" onClick={onClose} style={{ flex: "1 1 160px" }}>
            Fermer
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => onSelect(candidate)} style={{ flex: "1 1 160px" }}>
            Cocher ce candidat <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
