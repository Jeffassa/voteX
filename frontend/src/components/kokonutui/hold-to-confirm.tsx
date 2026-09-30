/**
 * Bouton « maintenir pour confirmer », adapté du Hold Button de Kokonut UI
 * (MIT, @dorianbaffier, https://kokonutui.com).
 *
 * Pour un vote, définitif, un simple clic est trop facile à donner par
 * mégarde. Maintenir le bouton une seconde rend l'intention explicite.
 *
 * Ajouts par rapport à l'original, qui n'était qu'une démonstration :
 * - `onConfirm` appelé quand la jauge est pleine (l'original ne faisait rien) ;
 * - clavier : Espace ou Entrée maintenus, comme la souris ou le doigt ;
 * - libellés et annonce pour lecteur d'écran en français ;
 * - `prefers-reduced-motion` : la jauge se remplit sans animation de largeur,
 *   le temps d'appui reste le même.
 */

import { motion, useAnimation, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

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
  const controls = useAnimation();
  const reduceMotion = useReducedMotion();
  const timer = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function start() {
    if (disabled || holding || done.current) return;
    setHolding(true);
    controls.set({ scaleX: 0 });
    controls.start({
      scaleX: 1,
      transition: { duration: reduceMotion ? 0 : duration / 1000, ease: "linear" },
    });
    timer.current = window.setTimeout(async () => {
      done.current = true;
      setHolding(false);
      try {
        await onConfirm();
      } finally {
        done.current = false;
        controls.set({ scaleX: 0 });
      }
    }, duration);
  }

  function cancel() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (!holding) return;
    setHolding(false);
    controls.stop();
    controls.start({ scaleX: 0, transition: { duration: 0.15 } });
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby="hold-to-confirm-hint"
      className={cn(
        "btn btn-primary btn-lg relative touch-none select-none overflow-hidden",
        className
      )}
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
      <motion.span
        aria-hidden="true"
        animate={controls}
        initial={{ scaleX: 0 }}
        className="absolute inset-0 origin-left bg-white/20"
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
