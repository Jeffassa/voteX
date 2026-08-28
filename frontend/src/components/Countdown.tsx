import { useEffect, useState } from "react";

export function useCountdown(targetMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, targetMs - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    total: diff,
  };
}

interface CountdownProps {
  targetMs: number;
  compact?: boolean;
}

export function Countdown({ targetMs, compact }: CountdownProps) {
  const { d, h, m, s } = useCountdown(targetMs);
  if (compact) {
    return (
      <span className="mono" style={{ color: "var(--navy-900)", fontWeight: 600 }}>
        {d}j {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      </span>
    );
  }
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
      <Block v={d} l="jours" />
      <Sep />
      <Block v={h} l="heures" />
      <Sep />
      <Block v={m} l="min" />
      <Sep />
      <Block v={s} l="sec" />
    </div>
  );
}

function Block({ v, l }: { v: number; l: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 64 }}>
      <div
        className="mono"
        style={{
          fontSize: 36, fontWeight: 600, color: "var(--navy-900)",
          letterSpacing: "-0.03em", lineHeight: 1,
        }}
      >
        {String(v).padStart(2, "0")}
      </div>
      <div
        style={{
          fontSize: 11, color: "var(--ink-500)", textTransform: "uppercase",
          letterSpacing: "0.08em", marginTop: 6,
        }}
      >
        {l}
      </div>
    </div>
  );
}

function Sep() {
  return <span style={{ color: "var(--ink-300)", fontSize: 24 }}>:</span>;
}
