/**
 * Motifs d'impression sécurisée : rosace guillochée, bande ondulée, microtexte,
 * tampon « A voté » et croix du bulletin. Purement décoratifs (aria-hidden),
 * ils donnent aux écrans l'allure des documents d'une élection : bulletin,
 * reçu, procès-verbal.
 *
 * Les tracés sont calculés une fois, au chargement du module.
 */

import type { CSSProperties, ReactNode } from "react";

/** Hypotrochoïde : x = (R−r)cos t + d·cos((R−r)t/r), y = (R−r)sin t − d·sin((R−r)t/r). */
function trochoid(R: number, r: number, d: number, turns: number, steps: number): string {
  const k = (R - r) / r;
  let path = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    path += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return path;
}

// R/r = 30/7 : la courbe se referme après 7 tours et dessine 23 boucles.
const ROSETTE = [30, 38, 46].map((d) => trochoid(100, 70 / 3, d, 7, 1610));

/** Rosace guillochée, à poser dans un panneau (classe sv-navy-panel). */
export function Rosette({ size = 420, opacity = 0.14, style }: { size?: number; opacity?: number; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="sv-pattern"
      width={size}
      height={size}
      viewBox="-125 -125 250 250"
      style={{ opacity, ...style }}
    >
      {ROSETTE.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.45} />
      ))}
      <circle r={118} fill="none" stroke="currentColor" strokeWidth={0.45} />
      <circle r={122} fill="none" stroke="currentColor" strokeWidth={0.3} strokeDasharray="1.2 1.6" />
    </svg>
  );
}

const WAVES = Array.from({ length: 9 }, (_, i) => {
  let path = "";
  for (let x = 0; x <= 400; x += 4) {
    const y = 2 + i * 2.4 + Math.sin(x / 9 + i * 0.7) * 0.9 + Math.sin(x / 31) * 0.6;
    path += `${x ? "L" : "M"}${x} ${y.toFixed(2)}`;
  }
  return path;
});

/** Bande de lignes ondulées : l'en-tête d'un bulletin ou d'un reçu. */
export function WaveBand({ height = 26, color = "var(--navy-900)", opacity = 0.16 }: { height?: number; color?: string; opacity?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="100%"
      height={height}
      viewBox="0 0 400 24"
      preserveAspectRatio="none"
      style={{ display: "block", color, opacity }}
    >
      {WAVES.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** Ligne de microtexte répété, comme en bordure des billets et des diplômes. */
export function Microtext({ text = "ESATIC SMARTVOTE · SCRUTIN SÉCURISÉ · BULLETIN SECRET · ", style }: { text?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden="true" className="sv-microtext" style={style}>
      {text.repeat(14)}
    </div>
  );
}

/** Tampon de l'assesseur. Décoratif : le texte qui compte est ailleurs sur la page. */
export function Stamp({ children, sub, small, style }: { children: ReactNode; sub?: ReactNode; small?: boolean; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`sv-stamp${small ? " sm" : ""}`} style={style}>
      {children}
      {sub && <small>{sub}</small>}
    </span>
  );
}

/** Croix tracée à la main dans la case du bulletin. */
export function BallotCross({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 5.2c4.6 4.3 9.4 9.1 15 14.1" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M19.2 4.6c-5 4.5-9.6 9.6-14.4 15" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
    </svg>
  );
}
