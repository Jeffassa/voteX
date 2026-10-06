import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { HashChip } from "@/components/HashChip";
import { Microtext, Rosette, Stamp } from "@/components/SecurityPattern";
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
  const blank = candidate?.id === "neutral";

  return (
    <div>
      <AppHeader />
      <div
        ref={pageRef}
        className="container container-narrow scene"
        style={{ padding: "48px 32px 72px", textAlign: "center" }}
      >
        {/* Le tampon de l'assesseur : « A voté ». */}
        <Stamp sub={ts.toLocaleDateString("fr-FR")}>A voté</Stamp>

        <h1 style={{ fontSize: 40, fontWeight: 540, marginTop: 30, marginBottom: 10, color: "var(--navy-900)", lineHeight: 1.1 }}>
          Votre vote a été enregistré.
        </h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
          Merci{me?.first_name ? `, ${me.first_name}` : ""}. Votre bulletin
          {candidate && !blank && (
            <>
              {" "}pour{" "}
              <strong style={{ color: "var(--navy-900)" }}>
                {fullNameOf(candidate.student)}
              </strong>
            </>
          )}
          {blank && " blanc"}
          {" "}est enregistré{txHash ? " et scellé sur la blockchain" : ""}.
        </p>

        <article className="sv-ticket" aria-labelledby="ticket-title">
          <header className="sv-ticket-head sv-navy-panel">
            <Rosette size={300} opacity={0.16} style={{ right: -90, top: -120 }} />
            <div className="row items-start justify-between gap-3" style={{ flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div className="sv-ref" style={{ color: "rgba(255,255,255,0.65)" }}>Reçu de vote</div>
                <h2 id="ticket-title" className="sv-display" style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 540, lineHeight: 1.15 }}>
                  {election?.title || "Élection"}
                </h2>
              </div>
              <span
                className="badge"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.3)", color: txHash ? "#9fe0b4" : "white" }}
              >
                {txHash ? "Ancré sur la chaîne" : anchoring ? "Ancrage en cours" : "Enregistré"}
              </span>
            </div>
          </header>
          <Microtext style={{ padding: "6px 26px 0" }} />

          <dl className="sv-ticket-fields">
            <dt>Empreinte du bulletin</dt>
            <dd><HashChip value={receipt.vote_hash} full /></dd>

            <dt>Transaction</dt>
            <dd>
              {txHash ? (
                <HashChip value={txHash} />
              ) : (
                <span className="muted">
                  {anchoring ? "ancrage en cours…" : "en attente, au plus tard à la clôture"}
                </span>
              )}
            </dd>

            <dt>Bloc</dt>
            <dd className="mono">{blockNumber ? `#${blockNumber.toLocaleString("fr-FR")}` : "en attente"}</dd>

            <dt>Horodatage</dt>
            <dd className="mono">{tsLabel}</dd>
          </dl>

          {/* Talon détachable : ce qu'on emporte. */}
          <div className="sv-perf" />
          <div className="sv-ticket-stub">
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-500)", flex: "1 1 240px", lineHeight: 1.5 }}>
              Conservez l'empreinte : elle prouve que votre bulletin est compté, sans dire pour qui.
            </p>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {txHash ? (
                <a
                  href={etherscanTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <ExternalLink size={14} aria-hidden="true" /> Vérifier sur {explorerName}
                </a>
              ) : (
                <button className="btn btn-outline btn-sm" disabled>
                  <ExternalLink size={14} aria-hidden="true" /> Pas encore ancré
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
                <Download size={14} aria-hidden="true" /> Télécharger le PDF
              </button>
            </div>
          </div>
        </article>

        <button
          className="btn btn-navy btn-lg"
          style={{ marginTop: 32 }}
          onClick={() => navigate(`/elections/${id}/results`)}
        >
          Suivre la participation <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
