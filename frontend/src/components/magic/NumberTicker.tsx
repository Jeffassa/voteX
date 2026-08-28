import { useEffect, useRef, type CSSProperties } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface NumberTickerProps {
  value: number;
  decimals?: number;
  delay?: number;
  className?: string;
  suffix?: string;
  style?: CSSProperties;
}

export function NumberTicker({
  value,
  decimals = 0,
  delay = 0,
  className,
  suffix = "",
  style,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => motionValue.set(value), delay * 1000);
      return () => clearTimeout(t);
    }
  }, [motionValue, isInView, delay, value]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent =
          new Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(Number(latest.toFixed(decimals))) + suffix;
      }
    });
  }, [springValue, decimals, suffix]);

  return (
    <span className={className} style={style} ref={ref}>
      0{suffix}
    </span>
  );
}
