/**
 * Chargement de l'urne 3D de l'accueil, partagé par l'amorce (main.tsx) et la
 * page : les deux appels désignent le même morceau de code, téléchargé une fois.
 *
 * Ce fichier reste dans le bundle principal : il ne doit rien importer de lourd
 * (ni Three.js, ni GSAP).
 */

import heroPoster1x from "@/assets/hero-urne-460.webp";
import heroPoster2x from "@/assets/hero-urne-805.webp";

/** Image fixe de la première image de la scène, affichée en attendant la 3D. */
export const HERO_POSTER = {
  src: heroPoster1x,
  srcSet: `${heroPoster1x} 460w, ${heroPoster2x} 805w`,
  // Image carrée, à la hauteur du cadre : 300 px, 380 px, puis 460 px.
  sizes: "(min-width: 1024px) 460px, (min-width: 640px) 380px, 300px",
  width: 460,
  height: 460,
};

export const loadBallotBoxScene = () => import("./BallotBoxScene");

/**
 * La 3D vaut-elle son téléchargement (Three.js, ~135 Ko compressés) ?
 * Pas pour qui a demandé moins de mouvement (l'image fixe dit la même chose),
 * ni en mode économie de données.
 */
export function wantsHero3d(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}
