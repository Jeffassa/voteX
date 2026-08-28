// Palette déterministe pour les avatars de candidats — par index dans l'élection.
const PALETTE = ["#EAB308", "#0EA5E9", "#A855F7", "#22C55E", "#F43F5E", "#14B8A6", "#F97316", "#3B82F6"];

export function colorFor(index: number) {
  return PALETTE[index % PALETTE.length];
}

export function initialsOf(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
}

export function fullNameOf(s: { first_name: string; last_name: string }): string {
  return `${s.first_name} ${s.last_name}`;
}
