/**
 * Bouton « maintenir pour confirmer », d'après le Hold Button de Kokonut UI
 * (MIT, @dorianbaffier, https://kokonutui.com).
 *
 * Pour un vote, définitif, un simple clic est trop facile à donner par
 * mégarde. Maintenir le bouton une seconde rend l'intention explicite.
 *
 * Ajouts par rapport à l'original, qui n'était qu'une démonstration :
 * - `onConfirm` appelé quand la jauge est pleine (l'original ne faisait rien) ;
 * - clavier : Espace ou Entrée maintenus, comme la souris ou le doigt ;
 * - libellés et annonce pour lecteur d'écran en français ;
 * - `prefers-reduced-motion` : la jauge se remplit d'un coup, le temps
 *   d'appui reste le même.
 *
 * La jauge est une transition CSS : la bibliothèque d'animation de l'original
 * (Motion) n'était chargée que pour ce bouton.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "@/lib/motion";

interface HoldToConfirmProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  holdingLabel?: string;
  /** Durée d'appui en millisecondes. */
  duration?: number;
  disabled?: boolean;
  className?: string;
}

export function HoldToConfirm({
  onConfirm,
  children,
  holdingLabel = "Continuez d'appuyer…",
  duration = 1200,
  disabled,
  className,
}: HoldToConfirmProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function start() {
    if (disabled || holding || done.current) return;
    setHolding(true);
    timer.current = window.setTimeout(async () => {
      done.current = true;
      setHolding(false);
      try {
        await onConfirm();
      } finally {
        done.current = false;
      }
    }, duration);
  }

  function cancel() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (holding) setHolding(false);
  }

  // Remplissage linéaire sur toute la durée d'appui ; retour rapide au relâché.
  const fill = prefersReducedMotion() ? "none" : holding ? `transform ${duration}ms linear` : "transform 150ms ease-out";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby="hold-to-confirm-hint"
      className={`btn btn-primary btn-lg relative touch-none select-none overflow-hidden${className ? ` ${className}` : ""}`}
      onPointerDown={(e) => {
        if (e.button === 0) start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-white/20"
        style={{ transform: `scaleX(${holding ? 1 : 0})`, transition: fill }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {holding ? holdingLabel : children}
      </span>
      <span id="hold-to-confirm-hint" className="sr-only">
        Maintenez le bouton, ou la touche Espace, pendant une seconde pour confirmer.
      </span>
    </button>
  );
}
