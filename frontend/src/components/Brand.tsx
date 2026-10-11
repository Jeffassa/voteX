import { useId } from "react";

import { LOGO_FACES, LOGO_GRADIENTS, LOGO_HEIGHT, LOGO_SILHOUETTE, LOGO_WIDTH } from "./logoGeometry";

interface BrandProps {
  size?: number;
  tag?: string;
}

const FACES = Object.keys(LOGO_FACES) as Array<keyof typeof LOGO_FACES>;

/**
 * Le « V » de SmartVote. Ses couleurs viennent de --logo-slate et --logo-copper :
 * la variante claire (fonds marine) se règle en CSS, sans second dessin.
 * `size` fixe la hauteur ; sans `title`, le logo est décoratif.
 */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  // Identifiants propres à chaque logo : l'en-tête et le pied de page en
  // affichent un chacun, et un dégradé partagé disparaît si son logo est masqué.
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className="sv-logo"
      width={Math.round((size * LOGO_WIDTH) / LOGO_HEIGHT)}
      height={size}
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <defs>
        {FACES.map((face) => {
          const g = LOGO_GRADIENTS[face];
          return (
            <linearGradient key={face} id={`${uid}-${face}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              {g.stops.map(([offset, opacity]) => (
                <stop key={offset} offset={offset} style={{ stopColor: "var(--logo-copper)", stopOpacity: opacity }} />
              ))}
            </linearGradient>
          );
        })}
        <clipPath id={`${uid}-clip`}>
          <path fillRule="evenodd" d={LOGO_SILHOUETTE} />
        </clipPath>
      </defs>
      <path fillRule="evenodd" d={LOGO_SILHOUETTE} style={{ fill: "var(--logo-slate)" }} />
      <g clipPath={`url(#${uid}-clip)`}>
        {FACES.map((face) => (
          <path key={face} d={LOGO_FACES[face]} fill={`url(#${uid}-${face})`} />
        ))}
      </g>
    </svg>
  );
}

export function Brand({ size = 32, tag = "SmartVote" }: BrandProps) {
  return (
    <div className="brand">
      <LogoMark size={size} />
      <div className="name">
        ESATIC <span className="tag">{tag}</span>
      </div>
    </div>
  );
}
