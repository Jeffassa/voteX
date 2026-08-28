import { ArrowRight, X } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { fullNameOf, initialsOf } from "@/lib/palette";
import type { Candidate } from "@/types/api";

interface Props {
  candidate: (Candidate & { color: string }) | null;
  classLabel?: string;
  onClose: () => void;
  onSelect: (c: Candidate) => void;
}

export function CandidateProfileModal({ candidate, classLabel, onClose, onSelect }: Props) {
  if (!candidate) return null;

  const programItems = (candidate.program || "").split("\n").filter(Boolean);

  return (
    <Modal open={true} onClose={onClose} width={620}>
      <div style={{ padding: 32, position: "relative" }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ position: "absolute", top: 16, right: 16 }}
          onClick={onClose}
        >
          <X size={16} />
        </button>

        <div className="row items-center gap-4">
          <Avatar
            initials={initialsOf(candidate.student.first_name, candidate.student.last_name)}
            size={88}
            color={candidate.color}
            src={candidate.photo_url || candidate.student.photo_url || undefined}
          />
          <div>
            <div className="h-eyebrow" style={{ color: candidate.color }}>
              Candidat
            </div>
            <h2
              style={{
                fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em",
                margin: "4px 0 0", color: "var(--navy-900)",
              }}
            >
              {fullNameOf(candidate.student)}
            </h2>
            <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>
              {candidate.student.matricule}
              {classLabel && <> · {classLabel}</>}
            </div>
          </div>
        </div>

        {candidate.biography && (
          <p
            style={{
              fontSize: 14, color: "var(--ink-700)",
              lineHeight: 1.6, marginTop: 24,
            }}
          >
            {candidate.biography}
          </p>
        )}

        {programItems.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="h-eyebrow" style={{ color: "var(--ink-500)" }}>Programme</div>
            <ul
              style={{
                margin: "10px 0 0", padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              {programItems.map((p, i) => (
                <li
                  key={i}
                  className="row items-start gap-2"
                  style={{ fontSize: 14, color: "var(--ink-900)" }}
                >
                  <span
                    style={{
                      width: 22, height: 22, flexShrink: 0,
                      borderRadius: 6,
                      background: `${candidate.color}1A`,
                      color: candidate.color,
                      display: "grid", placeItems: "center",
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {candidate.slogan && (
          <blockquote
            style={{
              margin: "28px 0 0", padding: "20px 22px",
              background: "var(--surface-2)",
              borderRadius: "var(--r-md)",
              borderLeft: `3px solid ${candidate.color}`,
              fontStyle: "italic", fontSize: 15,
              color: "var(--navy-900)", lineHeight: 1.5,
              fontFamily: "Georgia, serif",
            }}
          >
            « {candidate.slogan} »
          </blockquote>
        )}

        <div className="row gap-3" style={{ marginTop: 28 }}>
          <button className="btn btn-outline btn-lg" onClick={onClose} style={{ flex: 1 }}>
            Fermer
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => onSelect(candidate)}
            style={{ flex: 1 }}
          >
            Choisir ce candidat <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
