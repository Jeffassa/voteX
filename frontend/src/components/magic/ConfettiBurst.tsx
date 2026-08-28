import { useEffect } from "react";
import confetti from "canvas-confetti";

interface Props {
  fire?: boolean;
}

export function ConfettiBurst({ fire = true }: Props) {
  useEffect(() => {
    if (!fire) return;
    const palette = ["#FF7A00", "#FF9333", "#22C55E", "#0A2540", "#E86A00"];

    const shoot = (origin: { x: number; y: number }) => {
      confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 38,
        origin,
        colors: palette,
        scalar: 0.95,
        ticks: 200,
      });
    };

    shoot({ x: 0.25, y: 0.55 });
    setTimeout(() => shoot({ x: 0.75, y: 0.55 }), 220);
    setTimeout(
      () =>
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { x: 0.5, y: 0.45 },
          colors: palette,
          ticks: 300,
        }),
      450
    );
  }, [fire]);

  return null;
}
