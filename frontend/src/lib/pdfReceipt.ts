import { jsPDF } from "jspdf";

import { etherscanTxUrl } from "@/lib/blockchain";
import type { Candidate, VoteReceipt } from "@/types/api";

interface BuildPdfArgs {
  receipt: VoteReceipt;
  candidate?: Candidate | null;
  electionTitle: string;
  voterFullName: string;
  voterMatricule: string;
}

const NAVY: [number, number, number] = [10, 37, 64];
const ORANGE: [number, number, number] = [255, 122, 0];
const INK_500: [number, number, number] = [100, 116, 139];
const INK_700: [number, number, number] = [51, 65, 85];

export function buildVoteReceiptPdf({
  receipt,
  candidate,
  electionTitle,
  voterFullName,
  voterMatricule,
}: BuildPdfArgs): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header band navy
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(margin, 28, 36, 36, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("ESATIC SmartVote", margin + 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Reçu de vote — preuve d'enregistrement on-chain", margin + 50, 68);

  let y = 130;

  // Title
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Votre vote a été enregistré.", margin, y);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK_700);
  const intro = candidate
    ? `Bulletin pour ${candidate.student.first_name} ${candidate.student.last_name} scellé sur la blockchain.`
    : "Bulletin scellé sur la blockchain.";
  doc.text(intro, margin, y);

  y += 36;

  // Voter block
  drawSection(doc, "Votant", margin, y);
  y += 18;
  drawKeyValue(doc, "Nom", voterFullName, margin, y);
  y += 16;
  drawKeyValue(doc, "Matricule", voterMatricule, margin, y, true);

  y += 32;
  drawSection(doc, "Élection", margin, y);
  y += 18;
  drawKeyValue(doc, "Intitulé", electionTitle, margin, y);

  y += 32;
  drawSection(doc, "Reçu blockchain", margin, y);
  y += 18;
  drawKeyValue(doc, "Hash de vote", receipt.vote_hash, margin, y, true, pageWidth - margin * 2);
  y += 16;
  drawKeyValue(
    doc,
    "Hash transaction",
    receipt.tx_hash || "— hors chaîne —",
    margin,
    y,
    !!receipt.tx_hash,
    pageWidth - margin * 2
  );
  y += 16;
  drawKeyValue(
    doc,
    "Bloc",
    receipt.block_number ? `#${receipt.block_number.toLocaleString("fr-FR")}` : "—",
    margin,
    y,
    true
  );
  y += 16;
  drawKeyValue(
    doc,
    "Horodatage",
    new Date(receipt.created_at).toISOString().replace("T", " · ").slice(0, 22) + " UTC",
    margin,
    y,
    true
  );

  if (receipt.tx_hash) {
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ORANGE);
    doc.textWithLink("Vérifier la transaction sur l'explorateur →", margin, y, {
      url: etherscanTxUrl(receipt.tx_hash),
    });
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 36;
  doc.setDrawColor(229, 232, 238);
  doc.line(margin, footerY - 16, pageWidth - margin, footerY - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_500);
  doc.text(
    "Ce reçu prouve l'existence de votre vote. Pour des raisons d'anonymat, le bulletin lui-même n'est pas révélé.",
    margin,
    footerY,
    { maxWidth: pageWidth - margin * 2 }
  );
  doc.text(`Émis le ${new Date().toLocaleString("fr-FR")}`, margin, footerY + 12);

  return doc;
}

function drawSection(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ORANGE);
  doc.text(label.toUpperCase(), x, y, { charSpace: 1 });
  doc.setDrawColor(229, 232, 238);
  doc.line(x, y + 4, x + 460, y + 4);
}

function drawKeyValue(
  doc: jsPDF,
  key: string,
  value: string,
  x: number,
  y: number,
  monoValue = false,
  maxWidth?: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK_500);
  doc.text(key, x, y);

  doc.setFont(monoValue ? "courier" : "helvetica", monoValue ? "normal" : "bold");
  doc.setFontSize(monoValue ? 9.5 : 11);
  doc.setTextColor(...NAVY);
  doc.text(value, x + 110, y, maxWidth ? { maxWidth: maxWidth - 110 } : undefined);
}

export function downloadVoteReceiptPdf(args: BuildPdfArgs) {
  const doc = buildVoteReceiptPdf(args);
  const safeTitle = args.electionTitle.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  doc.save(`recu-${safeTitle}-${args.voterMatricule}.pdf`);
}
