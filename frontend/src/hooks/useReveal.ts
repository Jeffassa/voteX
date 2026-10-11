/**
 * Hooks d'animation à l'usage des pages.
 *
 * Chaque page se contente d'attacher une `ref` et de décrire ce qu'elle veut
 * révéler ; la mécanique GSAP, le nettoyage au démontage et le respect de
 * `prefers-reduced-motion` sont traités une fois pour toutes dans lib/motion.
 */

import { useEffect, useRef } from "react";

import { countTo, reveal } from "@/lib/motion";

interface UseRevealOptions {
  /** Sélecteur des enfants à révéler en cascade. Sinon, l'élément lui-même. */
  selector?: string;
  delay?: number;
  /** Révéler à l'entrée dans le champ de vision plutôt qu'au montage. */
  onScroll?: boolean;
  rise?: number;
  /**
   * Rejoue l'animation quand ces valeurs changent — utile quand le contenu
   * arrive après coup (résultats chargés, liste filtrée).
   */
  deps?: unknown[];
}

/** Révèle un bloc, et ses enfants si un sélecteur est fourni. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: UseRevealOptions = {}) {
  const ref = useRef<T>(null);
  const { selector, delay, onScroll, rise, deps = [] } = options;

  useEffect(() => {
    return reveal(ref.current, { selector, delay, onScroll, rise });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/** Fait grimper un nombre jusqu'à sa valeur. */
export function useCountTo(
  value: number,
  { decimals = 0, suffix = "" }: { decimals?: number; suffix?: string } = {},
) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return countTo(ref.current, value, { decimals, suffix });
  }, [value, decimals, suffix]);

  return ref;
}
