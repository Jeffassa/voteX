import { useEffect, useRef, type CSSProperties } from "react";

import { countTo, prefersReducedMotion } from "@/lib/motion";

interface NumberTickerProps {
  value: number;
  decimals?: number;
  delay?: number;
  className?: string;
  suffix?: string;
  style?: CSSProperties;
}

/**
 * Chiffre qui grimpe jusqu'à sa valeur, une fois entré dans le champ de vision.
 *
 * Le comptage démarre à la visibilité, pas au montage : lancer l'animation d'un
 * chiffre situé trois écrans plus bas la ferait passer inaperçue, et le lecteur
 * n'en verrait que le résultat.
 */
export function NumberTicker({
  value,
  decimals = 0,
  delay = 0,
  className,
  suffix = "",
  style,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      return countTo(el, value, { decimals, suffix });
    }

    let stop: (() => void) | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        stop = countTo(el, value, { decimals, suffix, delay });
      },
      { threshold: 0.2 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [value, decimals, suffix, delay]);

  return (
    <span className={className} style={style} ref={ref}>
      {/* Valeur de départ visible avant l'animation : jamais de case vide. */}
      0{suffix}
    </span>
  );
}
