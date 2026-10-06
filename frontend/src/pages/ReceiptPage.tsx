import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Box, Download, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { HashChip } from "@/components/HashChip";
import { useElection, useMe } from "@/lib/queries";
import { verifyVoteHash } from "@/lib/queries/votes";
import { etherscanTxUrl, explorerName } from "@/lib/blockchain";
import { fullNameOf } from "@/lib/palette";
import type { Candidate, VoteReceipt } from "@/types/api";

const ANCHOR_WAIT_MS = 2 * 60 * 1000;

export default function ReceiptPage() {
  // Le reçu est une confirmation : on le laisse s'installer posément.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", delay: 0.1 });
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as {
    state?: { receipt?: VoteReceipt; candidate?: Candidate };
  };
  const navigate = useNavigate();

  const { data: me } = useMe();
  const { data: election } = useElection(id);

  const receipt = state?.receipt;
  const candidate = state?.candidate;

  // Le bulletin est enregistré tout de suite ; son inscription sur la chaîne se
  // fait en arrière-plan. On interroge la vérification publique jusqu'à ce
  // qu'elle aboutisse (ou pendant ~2 minutes au plus).
  const startedAt = useRef(Date.now());
  const anchor = useQuery({
    queryKey: ["anchor", receipt?.vote_hash],
    queryFn: () => verifyVoteHash(receipt!.vote_hash),
    enabled: !!receipt && !receipt.tx_hash,
    refetchInterval: (q) =>
      q.state.data?.anchored || Date.now() - startedAt.current > ANCHOR_WAIT_MS ? false : 4000,
  });
  const txHash = receipt?.tx_hash ?? anchor.data?.tx_hash ?? null;
  const blockNumber = receipt?.block_number ?? anchor.data?.block_number ?? null;
  const anchoring = !txHash && Date.now() - startedAt.current <= ANCHOR_WAIT_MS;

  if (!receipt) {
    return (
      <div>
        <AppHeader />
        <div className="container container-narrow" style={{ padding: 64 }}>
          <p className="muted">Aucun reçu disponible. Retournez au tableau de bord.</p>
          <button className="btn btn-navy" onClick={() => navigate("/")}>
            Tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const ts = new Date(receipt.created_at);
  const tsLabel = `${ts.toISOString().replace("T", " · ").slice(0, 22)} UTC`;

  return (
    <div>
      <AppHeader />
      <div
        ref={pageRef}
        className="container container-narrow scene"
        style={{ padding: "64px 32px", textAlign: "center" }}
      >
        <div
          style={{
            width: 96, height: 96, margin: "0 auto",
            borderRadius: "50%", background: "var(--success-50)",
            display: "grid", placeItems: "center", position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute", inset: -8,
              border: "2px solid var(--success-500)",
              borderRadius: "50%", opacity: 0.3,
              animation: "sv-rcpt-pulse 2s ease-out infinite",
            }}
          />
          <svg aria-hidden="true" focusable="false" width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle
              cx="28" cy="28" r="26"
              stroke="var(--success-500)" strokeWidth="3" fill="none"
              style={{
                strokeDasharray: 164,
                strokeDashoffset: 164,
                animation: "sv-rcpt-circle 800ms 200ms ease forwards",
              }}
            />
            <path
              d="M16 29 L25 38 L41 20"
              stroke="var(--success-500)" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 50,
                animation: "sv-rcpt-check 500ms 900ms ease forwards",
              }}
            />
          </svg>
        </div>

        <h1
          style={{
            fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em",
            marginTop: 28, marginBottom: 10, color: "var(--navy-900)",
          }}
        >
          Votre vote a été enregistré.
        </h1>
        <p
          className="muted"
          style={{
            fontSize: 16, maxWidth: 540, margin: "0 auto", lineHeight: 1.6,
          }}
        >
          Merci{me?.first_name ? `, ${me.first_name}` : ""}. Votre bulletin
          {candidate && (
            <>
              {" "}pour{" "}
              <strong style={{ color: "var(--navy-900)" }}>
                {fullNameOf(candidate.student)}
              </strong>
            </>
          )}
          {" "}est enregistré{txHash ? " et scellé sur la blockchain" : ""}.
        </p>

        <div
          className="card"
          style={{ marginTop: 40, padding: 0, textAlign: "left", overflow: "hidden" }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <div className="row items-center gap-2">
              <Box size={16} style={{ color: "var(--orange-500)" }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Reçu de transaction</span>
            </div>
            <span className="badge badge-open">
              <span className="dot" /> {txHash ? "Ancré sur la chaîne" : "Enregistré"}
            </span>
          </div>
          <div
            style={{
              padding: 24, display: "grid",
              gridTemplateColumns: "140px 1fr",
              rowGap: 16, columnGap: 24,
              alignItems: "center", fontSize: 13,
            }}
          >
            <div className="muted">Hash de vote</div>
            <div><HashChip value={receipt.vote_hash} full /></div>

            <div className="muted">Hash transaction</div>
            <div>
              {txHash ? (
                <HashChip value={txHash} />
              ) : (
                <span className="muted">
                  {anchoring ? "ancrage en cours…" : "en attente, au plus tard à la clôture"}
                </span>
              )}
            </div>

            <div className="muted">Bloc</div>
            <div className="mono" style={{ color: "var(--navy-900)" }}>
              {blockNumber ? `#${blockNumber.toLocaleString("fr-FR")}` : "-"}
            </div>

            <div className="muted">Horodatage</div>
            <div className="mono" style={{ color: "var(--navy-900)" }}>
              {tsLabel}
            </div>

            <div className="muted">Élection</div>
            <div style={{ color: "var(--navy-900)" }}>{election?.title || "-"}</div>
          </div>
          <div
            style={{
              padding: 16,
              background: "var(--surface-2)",
              borderTop: "1px solid var(--border)",
              display: "flex", gap: 10, justifyContent: "flex-end",
            }}
          >
            {txHash ? (
              <a
                href={etherscanTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                <ExternalLink size={14} /> Vérifier sur {explorerName}
              </a>
            ) : (
              <button className="btn btn-outline btn-sm" disabled>
                <ExternalLink size={14} /> Pas encore ancré
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (!me) {
                  toast.error("Utilisateur indisponible");
                  return;
                }
                // jsPDF n'est chargé qu'au clic : il pèse plus lourd que toute la
                // page, pour un bouton que la plupart des électeurs n'utilisent pas.
                void import("@/lib/pdfReceipt").then(({ downloadVoteReceiptPdf }) => downloadVoteReceiptPdf({
                  receipt,
                  electionTitle: election?.title || "Élection",
                  voterFullName: `${me.first_name} ${me.last_name}`,
                  voterMatricule: me.matricule,
                }));
              }}
            >
              <Download size={14} /> Télécharger PDF
            </button>
          </div>
        </div>

        <button
          className="btn btn-navy btn-lg"
          style={{ marginTop: 32 }}
          onClick={() => navigate(`/elections/${id}/results`)}
        >
          Voir les résultats en direct <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
