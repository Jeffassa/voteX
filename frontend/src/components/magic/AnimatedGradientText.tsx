import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  from?: string;
  via?: string;
  to?: string;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedGradientText({
  children,
  from = "#FF7A00",
  via = "#FF9333",
  to = "#E86A00",
  className,
  style,
}: Props) {
  return (
    <span
      className={`sv-animate-gradient ${className || ""}`}
      style={{
        backgroundImage: `linear-gradient(90deg, ${from}, ${via}, ${to}, ${via}, ${from})`,
        backgroundSize: "200% 200%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
