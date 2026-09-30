/**
 * Couche d'animation partagée — GSAP.
 *
 * Trois principes tiennent tout ce fichier :
 *
 * 1. **Le mouvement est une décoration, jamais une condition.** Aucune
 *    information, aucun bouton, aucun bulletin ne dépend d'une animation pour
 *    être lisible ou cliquable. GSAP ne fait que différer une apparition.
 *
 * 2. **`prefers-reduced-motion` est respecté partout.** Un électeur sujet aux
 *    vertiges doit pouvoir voter. Quand la préférence est active, les tweens
 *    s'exécutent en durée nulle : l'état final est appliqué, rien ne bouge.
 *
 * 3. **Une seule grammaire.** Durées, décalages et courbe sont définis ici et
 *    nulle part ailleurs, pour que dix-huit pages ne finissent pas avec dix-huit
 *    rythmes différents.
 *
 * Sur le poids
 * ------------
 * On importe le cœur de GSAP, et rien d'autre. Les révélations au défilement
 * passent par `IntersectionObserver`, natif dans tous les navigateurs visés :
 * le plugin ScrollTrigger ferait le même travail pour une quarantaine de
 * kilo-octets supplémentaires, sur des téléphones qui n'en ont pas besoin.
 */

import { gsap } from "gsap";

/** Rythme commun à toute l'application. */
export const MOTION = {
  fast: 0.35,
  base: 0.55,
  slow: 0.9,
  /** Décalage entre deux éléments d'une même série. */
  stagger: 0.07,
  /** Courbe unique : départ franc, arrivée douce. */
  ease: "power3.out",
  /** Translation d'entrée. Assez pour se voir, pas assez pour distraire. */
  rise: 16,
} as const;

/** L'utilisateur a-t-il demandé à réduire les animations ? */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface RevealOptions {
  /** Sélecteur des enfants à révéler l'un après l'autre. */
  selector?: string;
  /** Retard avant le début, en secondes. */
  delay?: number;
  /** Déclencher à l'entrée dans le champ de vision plutôt qu'au montage. */
  onScroll?: boolean;
  /** Distance de translation. Négatif pour venir du haut. */
  rise?: number;
}

/**
 * Révèle un élément et, si `selector` est fourni, ses enfants en cascade.
 *
 * Renvoie la fonction de nettoyage attendue par `useEffect` : React démonte les
 * pages sans prévenir, et un tween oublié continue d'animer un nœud détaché.
 */
export function reveal(root: HTMLElement | null, options: RevealOptions = {}): () => void {
  if (!root) return () => {};

  const { selector, delay = 0, onScroll = false, rise = MOTION.rise } = options;
  const reduced = prefersReducedMotion();
  const all = selector ? Array.from(root.querySelectorAll<HTMLElement>(selector)) : [root];

  // Une entrée ne se joue QU'UNE FOIS par élément. Un remontage React — dû à
  // une requête qui se rafraîchit, à un changement de route, au mode strict —
  // relancerait sinon l'animation sous les yeux du lecteur, qui verrait le
  // texte repartir à zéro sans avoir rien demandé.
  const targets = all.filter((el) => el.dataset.revealed !== "true");
  if (targets.length === 0) return () => {};
  targets.forEach((el) => {
    el.dataset.revealed = "true";
  });

  let observer: IntersectionObserver | undefined;
  let ctx: gsap.Context | undefined;

  // Filet de sécurité : quoi qu'il arrive au tween — interrompu par un
  // rechargement à chaud, un remontage React, une erreur ailleurs — le contenu
  // est visible au bout de ce délai. Sur une plateforme de vote, un bulletin
  // ou un bouton invisible n'est pas un défaut esthétique mais un blocage.
  const SAFETY_MS = 1500;
  let safety: number | undefined;

  const forceVisible = () => {
    gsap.set(targets, { opacity: 1, y: 0, x: 0, clearProps: "willChange" });
  };

  const play = () => {
    safety = window.setTimeout(forceVisible, SAFETY_MS);
    ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: rise },
        {
          opacity: 1,
          y: 0,
          // Durée nulle plutôt qu'absence de tween : l'état final est appliqué
          // dans tous les cas, y compris si l'élément partait masqué.
          duration: reduced ? 0 : MOTION.base,
          stagger: reduced ? 0 : MOTION.stagger,
          delay: reduced ? 0 : delay,
          ease: MOTION.ease,
          overwrite: "auto",
          // Le compositeur travaille sur une couche dédiée pendant le tween,
          // puis la relâche : garder un `will-change` permanent consomme de la
          // mémoire vidéo pour rien.
          clearProps: "willChange",
          onComplete: () => {
            if (safety !== undefined) window.clearTimeout(safety);
          },
        },
      );
    }, root);
  };

  if (onScroll && !reduced) {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer?.disconnect();
        play();
      },
      { threshold: 0.15 },
    );
    observer.observe(root);
  } else {
    play();
  }

  return () => {
    observer?.disconnect();
    if (safety !== undefined) window.clearTimeout(safety);
    ctx?.revert();
    // Le démontage ne doit jamais laisser un élément à demi révélé : si le
    // nœud survit (navigation interne, rechargement à chaud), il reste lisible.
    forceVisible();
  };
}

/**
 * Compte de `from` vers `to` dans un élément de texte.
 *
 * Voir un pourcentage grimper aide à saisir un ordre de grandeur. La valeur
 * finale est écrite immédiatement quand les animations sont réduites — un
 * résultat de scrutin doit toujours être lisible.
 */
export function countTo(
  el: HTMLElement | null,
  to: number,
  {
    from = 0,
    decimals = 0,
    suffix = "",
    delay = 0,
  }: { from?: number; decimals?: number; suffix?: string; delay?: number } = {},
): () => void {
  if (!el) return () => {};

  const format = (v: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(v.toFixed(decimals))) + suffix;

  if (prefersReducedMotion()) {
    el.textContent = format(to);
    return () => {};
  }

  const state = { value: from };
  const tween = gsap.to(state, {
    value: to,
    duration: MOTION.slow,
    delay,
    ease: MOTION.ease,
    onUpdate: () => {
      el.textContent = format(state.value);
    },
    onComplete: () => {
      el.textContent = format(to);
    },
  });

  return () => {
    tween.kill();
    el.textContent = format(to);
  };
}

/** Étire une barre jusqu'à sa largeur — barres de résultats. */
export function grow(el: HTMLElement | null, toPercent: number, delay = 0): () => void {
  if (!el) return () => {};

  if (prefersReducedMotion()) {
    el.style.width = `${toPercent}%`;
    return () => {};
  }

  const tween = gsap.fromTo(
    el,
    { width: "0%" },
    { width: `${toPercent}%`, duration: MOTION.slow, delay, ease: MOTION.ease, overwrite: "auto" },
  );
  return () => {
    tween.kill();
    el.style.width = `${toPercent}%`;
  };
}

/** Attire l'œil sur un élément qui vient de changer d'état (erreur, succès). */
export function pulse(el: HTMLElement | null): void {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0.97 },
    { scale: 1, duration: MOTION.fast, ease: "back.out(2)", overwrite: "auto" },
  );
}

export { gsap };
