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
  // Photo d'identité plutôt que pastille : cadre presque carré, initiales en
  // serif sur un fond hachuré, comme une case de registre.
  const tintBg = color ? `${color}1A` : "var(--navy-50)";
  const hatch = color ? `${color}1F` : "rgba(10, 37, 64, 0.08)";
  const bg = `repeating-linear-gradient(135deg, ${hatch} 0 1px, transparent 1px 5px), ${tintBg}`;
  // Fond = la couleur à 10 % sur blanc ; le texte est assombri jusqu'à 4,5:1
  // (le jaune d'un candidat tombait à 1,8:1).
  const fg = color ? (onDark ? color : readableOn(color, tint(color, 0.1))) : "var(--navy-700)";
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
        color: fg,
        borderRadius: size >= 48 ? 5 : 3,
        boxShadow: ringColor
          ? `0 0 0 3px ${ringColor}`
          : `inset 0 0 0 1px ${onDark ? "rgba(255,255,255,0.18)" : "rgba(10, 37, 64, 0.12)"}`,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        fontSize: size * 0.4,
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
