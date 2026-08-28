interface AvatarProps {
  initials?: string;
  size?: number;
  color?: string;
  ringColor?: string;
  src?: string | null;
}

export function Avatar({ initials, size = 36, color, ringColor, src }: AvatarProps) {
  const bg = color ? `${color}1A` : "var(--navy-100)";
  const fg = color || "var(--navy-700)";
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        boxShadow: ringColor ? `0 0 0 3px ${ringColor}` : "none",
        fontSize: size * 0.36,
      }}
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

export function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
}
