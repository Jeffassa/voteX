import type React from "react";
import { readableOn, tint } from "@/lib/contrast";

interface AvatarProps {
  initials?: string;
  size?: number;
  color?: string;
  ringColor?: string;
  src?: string | null;
  /** Nom de la personne : sert de texte alternatif à la photo. */
  name?: string;
  /** Posé sur un fond sombre : la couleur est gardée telle quelle. */
  onDark?: boolean;
}

export function Avatar({ initials, size = 36, color, ringColor, src, name, onDark }: AvatarProps) {
  // Initiales sur la couleur à 12 %, texte assombri jusqu'à 4,5:1 (le jaune
  // d'un candidat tombait à 1,8:1). Sans couleur : la teinte neutre.
  const bg = color ? `${color}1F` : "var(--surface-3)";
  const fg = color ? (onDark ? color : readableOn(color, tint(color, 0.12))) : "var(--ink-700)";
  // Thème sombre : la couleur éclaircie (mêlée de blanc) reste lisible sur sa teinte.
  const fgDark = color ? `color-mix(in srgb, ${color} 55%, white)` : undefined;
  // Rond pour les petites tailles, carré adouci pour les portraits.
  const radius = size >= 48 ? Math.round(size * 0.28) : "50%";
  const label = name?.trim() || undefined;
  return (
    <span
      className="avatar"
      // Sans photo, les initiales seules ne disent rien à un lecteur d'écran.
      role={!src && label ? "img" : undefined}
      aria-label={!src && label ? label : undefined}
      style={{
        width: size,
        height: size,
        background: src ? "var(--surface-2)" : bg,
        ...({ "--av-fg": fg, ...(fgDark ? { "--av-fg-dark": fgDark } : {}) } as React.CSSProperties),
        borderRadius: radius,
        boxShadow: ringColor
          ? `0 0 0 3px ${ringColor}`
          : `inset 0 0 0 1px ${onDark ? "rgba(255,255,255,0.16)" : "rgba(19, 21, 23, 0.08)"}`,
        fontWeight: 640,
        fontStretch: "110%",
        letterSpacing: "-0.02em",
        fontSize: size * 0.38,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={label ? `Photo de ${label}` : ""}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden={label ? true : undefined}>{initials}</span>
      )}
    </span>
  );
}

export function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
}
