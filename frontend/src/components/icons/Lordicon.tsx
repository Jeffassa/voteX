import { useEffect, useRef, type CSSProperties } from "react";

type Trigger =
  | "hover"
  | "click"
  | "loop"
  | "loop-on-hover"
  | "morph"
  | "morph-two-way"
  | "in"
  | "in-reveal";

interface LordiconProps {
  /** URL JSON Lordicon (ex: https://cdn.lordicon.com/xxxxxxxx.json) */
  src: string;
  trigger?: Trigger;
  size?: number;
  /** Format Lordicon : "primary:#0A2540,secondary:#FF7A00" */
  colors?: string;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wrapper React du web component <lord-icon>.
 *
 * Le script CDN (chargé dans index.html) installe l'élément custom une fois
 * la page prête — on attend cet enregistrement avant de se monter pour éviter
 * un flash d'élément non défini.
 */
export function Lordicon({
  src,
  trigger = "loop",
  size = 32,
  colors,
  delay,
  className,
  style,
}: LordiconProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ce = (window as unknown as { customElements?: CustomElementRegistry }).customElements;
    if (!ce) return;
    ce.whenDefined("lord-icon").catch(() => {});
  }, []);

  return (
    <lord-icon
      ref={ref as React.Ref<HTMLElement>}
      src={src}
      trigger={trigger}
      colors={colors}
      delay={delay}
      className={className}
      style={{ width: size, height: size, display: "inline-block", ...style }}
    />
  );
}
