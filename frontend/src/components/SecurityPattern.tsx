/**
 * Motifs de la marque, tirés du logo : chevrons emboîtés à l'angle des bras du
 * « V », sceau « A voté », coche du bulletin. Purement décoratifs (aria-hidden).
 *
 * Les tracés sont calculés une fois, au chargement du module.
 */

import type { CSSProperties, ReactNode } from "react";

// Pente des bras du V (logoGeometry : ~0,52 de déport horizontal par unité de
// hauteur) : les chevrons gardent l'angle exact du logo.
const ARM = 0.53;
const ECHO_COUNT = 9;
const ECHO_STEP = 26;
const ECHO_DEPTH = 230;

/** Chevrons emboîtés, pointe en bas, décalés vers le haut d'un pas chacun. */
const ECHOES = Array.from({ length: ECHO_COUNT }, (_, i) => {
  const apex = -i * ECHO_STEP;
  const half = (ECHO_DEPTH * ARM).toFixed(1);
  const top = (apex - ECHO_DEPTH).toFixed(1);
  return `M-${half} ${top}L0 ${apex}L${half} ${top}`;
});

/**
 * Écho du logo : neuf chevrons fins emboîtés, les trois premiers cuivrés. À poser dans
 * un panneau sombre (classe sv-navy-panel), positionné en absolu.
 */
export function BrandEcho({ size = 420, opacity = 1, style }: { size?: number; opacity?: number; style?: CSSProperties }) {
  const width = ECHO_DEPTH * ARM * 2;
  const height = ECHO_DEPTH + (ECHO_COUNT - 1) * ECHO_STEP;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="sv-pattern sv-echo"
      width={size}
      height={size}
      viewBox={`${-width / 2 - 4} ${-height - 4} ${width + 8} ${height + 8}`}
      style={{ opacity, ...style }}
    >
      {ECHOES.map((d, i) => {
        const copper = i < 3;
        return (
          <path
            key={i}
            d={d}
            pathLength={1}
            fill="none"
            stroke={copper ? "var(--copper-500)" : "currentColor"}
            strokeOpacity={copper ? 0.9 - i * 0.15 : 0.3 - i * 0.025}
            strokeWidth={copper ? 1.4 : 1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
            // Tracé du chevron le plus bas au plus haut.
            style={{ animationDelay: `${i * 70}ms` }}
          />
        );
      })}
    </svg>
  );
}

/** Sceau « A voté ». Décoratif : le texte qui compte est ailleurs sur la page. */
export function Stamp({ children, sub, small, style }: { children: ReactNode; sub?: ReactNode; small?: boolean; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`sv-stamp${small ? " sm" : ""}`} style={style}>
      <span className="sv-stamp-mark">
        <CheckMark size={small ? 12 : 15} />
      </span>
      <span className="sv-stamp-text">
        {children}
        {sub && <small>{sub}</small>}
      </span>
    </span>
  );
}

/** Coche du bulletin choisi. */
export function CheckMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.6 4.6L19.5 7" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
