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

/** Temps restant. Prend la couleur du texte autour : marche sur fond clair comme sur panneau sombre. */
export function Countdown({ targetMs, compact }: CountdownProps) {
  const { d, h, m, s } = useCountdown(targetMs);
  if (compact) {
    return (
      <span className="mono" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {d}j {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      </span>
    );
  }
  return (
    // role="timer" sans aria-live : un lecteur d'écran lit le temps restant à la
    // demande, au lieu d'être interrompu chaque seconde.
    <div
      className="sv-countdown"
      role="timer"
      aria-label={`Temps restant : ${d} jours, ${h} heures, ${m} minutes`}
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
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
    <div className="sv-countdown-block" aria-hidden="true" style={{ minWidth: 58 }}>
      <div
        className="sv-countdown-value"
        style={{
          fontFamily: "var(--font-display)", fontStretch: "112%", fontVariantNumeric: "lining-nums tabular-nums",
          fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 0.95,
        }}
      >
        {String(v).padStart(2, "0")}
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8 }}>{l}</div>
    </div>
  );
}

function Sep() {
  return <span aria-hidden="true" style={{ opacity: 0.3, fontSize: 30, lineHeight: 1, fontWeight: 300 }}>:</span>;
}
