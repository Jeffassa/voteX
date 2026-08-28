/**
 * URLs des icônes Lordicon utilisées dans l'app.
 *
 * Pour swap : va sur https://lordicon.com → choisis l'icône → clique "Copy URL"
 * (n'importe quel pack gratuit ou Lite est exploitable). Colle ici.
 *
 * Tant qu'une URL est vide, le composant Lordicon ne s'affiche pas et on
 * retombe sur l'icône Lucide statique du composant parent.
 */
export const LORDICONS = {
  shield: "https://cdn.lordicon.com/yqzmiobz.json",
  activity: "https://cdn.lordicon.com/wloilxuq.json",
  blockchain: "https://cdn.lordicon.com/rpviwvwn.json",
  check: "https://cdn.lordicon.com/lupuorrc.json",
  clock: "https://cdn.lordicon.com/abvsilqn.json",
  hash: "https://cdn.lordicon.com/yxczfiyc.json",
  vote: "https://cdn.lordicon.com/iukaodst.json",
} as const;

/** Format de couleurs Lordicon : "primary:#xxxxxx,secondary:#yyyyyy". */
export const LORDICON_COLORS = {
  navyOrange: "primary:#0A2540,secondary:#FF7A00",
  orangeNavy: "primary:#FF7A00,secondary:#0A2540",
  whiteOrange: "primary:#FFFFFF,secondary:#FF7A00",
  successGreen: "primary:#15803D,secondary:#22C55E",
} as const;
