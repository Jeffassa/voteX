import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { MOTION, gsap, prefersReducedMotion, reveal } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Retard avant l'entrée, en secondes. */
  delay?: number;
  /** Attendre l'entrée dans le champ de vision. Par défaut : anime au montage. */
  onScroll?: boolean;
  /** Translation verticale de départ. */
  rise?: number;
  /** Translation horizontale de départ, pour les listes qui arrivent de côté. */
  slide?: number;
  as?: "div" | "section" | "li" | "article";
}

/**
 * Enveloppe un bloc et le révèle — au montage ou à l'entrée dans l'écran.
 *
 * Remplace les `motion.div` de framer-motion. Le contenu est présent dans le
 * DOM dès le premier rendu : l'animation ne conditionne ni la lecture, ni
 * l'indexation, ni l'accès au clavier.
 */
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  onScroll = false,
  rise = MOTION.rise,
  slide,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Entrée latérale : cas particulier, on pilote le tween directement.
    if (slide !== undefined) {
      if (prefersReducedMotion()) return;
      // Même règle que dans `reveal` : une seule entrée par élément.
      if (el.dataset.revealed === "true") return;
      el.dataset.revealed = "true";
      // Même filet que dans `reveal` : l'élément devient visible quoi qu'il
      // arrive au tween.
      const safety = window.setTimeout(() => gsap.set(el, { opacity: 1, x: 0 }), 1500);
      const tween = gsap.fromTo(
        el,
        { opacity: 0, x: slide },
        {
          opacity: 1,
          x: 0,
          duration: MOTION.base,
          delay,
          ease: MOTION.ease,
          clearProps: "willChange",
          onComplete: () => window.clearTimeout(safety),
        },
      );
      return () => {
        window.clearTimeout(safety);
        tween.kill();
        gsap.set(el, { opacity: 1, x: 0 });
      };
    }

    return reveal(el, { delay, onScroll, rise });
  }, [delay, onScroll, rise, slide]);

  const Tag = as;
  return (
    <Tag ref={ref as never} className={className} style={style}>
      {children}
    </Tag>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Sélecteur des enfants à révéler en cascade. */
  selector: string;
  delay?: number;
  onScroll?: boolean;
}

/**
 * Révèle une série d'enfants l'un après l'autre.
 *
 * Une cascade vaut mieux qu'une apparition simultanée : elle donne un ordre de
 * lecture. Au-delà d'une dizaine d'éléments, elle devient une attente — d'où le
 * décalage court retenu dans MOTION.stagger.
 */
export function RevealGroup({
  children,
  className,
  style,
  selector,
  delay = 0,
  onScroll = true,
}: RevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return reveal(ref.current, { selector, delay, onScroll });
  }, [selector, delay, onScroll]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
