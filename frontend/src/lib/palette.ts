// Palette déterministe des candidats, par index dans l'élection. Des teintes
// sourdes accordées à l'ardoise et au cuivre du logo : les 500 de Tailwind
// (jaune, ciel, violet…) donnaient aux résultats l'air d'un tableau de bord type.
const PALETTE = ["#b9764f", "#4f6d8f", "#5e7d4e", "#7e5a7a", "#a8832a", "#3e7c7a", "#a5533f", "#5b6168"];

export function colorFor(index: number) {
  return PALETTE[index % PALETTE.length];
}

export function initialsOf(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
}

export function fullNameOf(s: { first_name: string; last_name: string }): string {
  return `${s.first_name} ${s.last_name}`;
}
