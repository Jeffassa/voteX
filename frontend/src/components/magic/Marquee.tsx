import type { CSSProperties, ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  repeat?: number;
  duration?: string;
  gap?: string;
  className?: string;
  style?: CSSProperties;
}

export function Marquee({
  children,
  reverse,
  pauseOnHover = true,
  vertical = false,
  repeat = 3,
  duration = "30s",
  gap = "12px",
  className,
  style,
}: MarqueeProps) {
  const containerStyle: CSSProperties = {
    display: "flex",
    overflow: "hidden",
    flexDirection: vertical ? "column" : "row",
    gap,
    ...style,
  };

  const trackStyle: CSSProperties = {
    display: "flex",
    flexShrink: 0,
    flexDirection: vertical ? "column" : "row",
    gap,
    animation: `${
      vertical ? "sv-marquee-vertical" : "sv-marquee"
    } ${duration} linear infinite`,
    animationDirection: reverse ? "reverse" : "normal",
    ["--gap" as string]: gap,
  } as CSSProperties;

  return (
    <div
      className={className}
      style={containerStyle}
      onMouseEnter={(e) => {
        if (pauseOnHover) {
          [...e.currentTarget.querySelectorAll<HTMLElement>("[data-marquee-track]")].forEach(
            (el) => (el.style.animationPlayState = "paused")
          );
        }
      }}
      onMouseLeave={(e) => {
        if (pauseOnHover) {
          [...e.currentTarget.querySelectorAll<HTMLElement>("[data-marquee-track]")].forEach(
            (el) => (el.style.animationPlayState = "running")
          );
        }
      }}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div key={i} style={trackStyle} data-marquee-track>
          {children}
        </div>
      ))}
    </div>
  );
}
