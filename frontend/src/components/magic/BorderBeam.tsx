import type { CSSProperties } from "react";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
  className?: string;
}

export function BorderBeam({
  size = 220,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "#FF7A00",
  colorTo = "#FFC988",
  delay = 0,
  className,
}: BorderBeamProps) {
  const cssVars: CSSProperties & Record<string, string | number> = {
    "--beam-size": `${size}px`,
    "--beam-duration": `${duration}s`,
    "--beam-delay": `-${delay}s`,
  };
  return (
    <div
      className={className}
      style={{
        ...cssVars,
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        pointerEvents: "none",
        border: `${borderWidth}px solid transparent`,
        WebkitMaskImage:
          "linear-gradient(transparent, transparent), linear-gradient(white, white)",
        maskImage:
          "linear-gradient(transparent, transparent), linear-gradient(white, white)",
        WebkitMaskClip: "padding-box, border-box",
        maskClip: "padding-box, border-box",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      <div
        className="sv-animate-border-beam"
        style={{
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
          offsetAnchor: "90% 50%",
        }}
      />
    </div>
  );
}
