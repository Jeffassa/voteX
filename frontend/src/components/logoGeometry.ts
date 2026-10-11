/**
 * Géométrie du logo SmartVote, le « V » ardoise aux faces cuivrées.
 *
 * Fichier généré : redessiné en droites et courbes de Bézier d'après la maquette
 * du logo (masters dans docs/brand/). Modifier le dessin là-bas, pas ici.
 */

export const LOGO_WIDTH = 415.0;
export const LOGO_HEIGHT = 422.25;

/** Contour plein : le V, sa fente intérieure (pair-impair) et l'aile basse. */
export const LOGO_SILHOUETTE =
  "M3.92 30.00 L89.75 30.00 C132.93 30.00 151.36 62.04 159.10 77.00 L208.57 172.66 C246.33 97.14 264.08 84.81 315.75 59.50 C328.31 53.35 364.90 40.84 409.75 8.00 C394.92 49.91 343.95 84.13 326.25 97.00 C282.45 128.85 274.62 141.06 253.12 182.00 L232.84 220.61 L251.73 256.50 C252.40 257.77 272.73 280.79 294.09 259.00 L206.59 420.21 Z M73.35 72.75 L97.25 74.75 C97.30 74.75 111.44 82.12 115.20 89.50 L208.25 272.00 C237.47 329.31 213.36 389.56 211.50 405.00 C210.90 394.78 218.92 352.70 200.36 317.00 Z M398.03 67.50 L298.97 250.00 C295.79 255.87 285.85 262.00 272.25 262.00 C265.20 262.00 250.82 253.24 254.00 247.00 C309.55 138.01 304.32 147.16 398.03 67.50 Z";

/** Faces cuivrées des trois rubans, découpées par la silhouette. */
export const LOGO_FACES = {
  band: "M82.25 30.00 L89.75 30.00 C132.93 30.00 151.36 62.04 159.10 77.00 L237.98 229.50 L209.53 229.50 L134.60 84.50 C117.10 59.50 89.75 37.00 82.25 30.00 Z",
  up: "M208.57 172.66 C246.33 97.14 264.08 84.81 315.75 59.50 C328.31 53.35 364.90 40.84 409.75 8.00 C358.93 64.18 274.84 77.11 232.52 169.50 Z",
  low: "M254.00 247.00 C309.55 138.01 304.32 147.16 398.03 67.50 C332.26 137.83 323.27 154.14 277.51 242.00 Z",
} as const;

/** Dégradé de chaque face, le long du ruban : [position, opacité du cuivre]. */
export const LOGO_GRADIENTS: Record<keyof typeof LOGO_FACES, {
  x1: number; y1: number; x2: number; y2: number; stops: ReadonlyArray<readonly [number, number]>;
}> = {
  band: { x1: 84.8, y1: 30.0, x2: 238.0, y2: 229.5, stops: [[0, 0.2], [0.25, 0.95], [0.62, 0.85], [0.86, 0]] },
  up: { x1: 208.6, y1: 172.7, x2: 409.8, y2: 8.0, stops: [[0, 0.55], [0.35, 1], [0.75, 0.9], [1, 0.55]] },
  low: { x1: 254.0, y1: 247.0, x2: 398.0, y2: 67.5, stops: [[0, 0], [0.28, 0.7], [0.7, 0.95], [1, 0.7]] },
};
