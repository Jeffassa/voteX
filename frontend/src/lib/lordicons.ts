/**
 * URLs des icônes Lordicon utilisées dans l'app.
 *
 * Les animations sont SERVIES PAR L'APPLICATION (frontend/public/vendor/lordicon),
 * pas par le CDN : un tiers capable d'exécuter du script sur cette page verrait
 * le bulletin choisi. Pour en ajouter une, télécharge son JSON depuis
 * https://lordicon.com dans ce dossier, puis référence-la ici.
 *
 * Tant qu'une URL est vide, le composant Lordicon ne s'affiche pas et on
 * retombe sur l'icône Lucide statique du composant parent.
 */
export const LORDICONS = {
  shield: "/vendor/lordicon/yqzmiobz.json",
  activity: "/vendor/lordicon/wloilxuq.json",
  blockchain: "/vendor/lordicon/rpviwvwn.json",
  check: "/vendor/lordicon/lupuorrc.json",
  // Ces deux identifiants ne sont plus servis par le CDN (404 renvoyant du
  // HTML, que le lecteur tente de parser en JSON → promesse rejetée dans la
  // console). Vides, ils déclenchent le repli documenté sur l'icône Lucide.
  clock: "",
  hash: "/vendor/lordicon/yxczfiyc.json",
  vote: "",
} as const;

/** Format de couleurs Lordicon : "primary:#xxxxxx,secondary:#yyyyyy". */
export const LORDICON_COLORS = {
  navyOrange: "primary:#0A2540,secondary:#FF7A00",
  orangeNavy: "primary:#FF7A00,secondary:#0A2540",
  whiteOrange: "primary:#FFFFFF,secondary:#FF7A00",
  successGreen: "primary:#15803D,secondary:#22C55E",
} as const;
