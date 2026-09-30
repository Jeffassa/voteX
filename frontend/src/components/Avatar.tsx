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
  const bg = color ? `${color}1A` : "var(--navy-100)";
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
        background: bg,
        color: fg,
        boxShadow: ringColor ? `0 0 0 3px ${ringColor}` : "none",
        fontSize: size * 0.36,
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
