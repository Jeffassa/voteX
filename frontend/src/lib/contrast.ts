/**
 * Contraste WCAG entre deux couleurs hexadécimales, et assombrissement d'une
 * teinte jusqu'à un contraste lisible. Sert aux couleurs attribuées aux
 * candidats : certaines (jaune, cyan) sont illisibles en texte sur fond clair.
 */

type RGB = [number, number, number];

function parse(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const la = luminance(typeof a === "string" ? parse(a) : a);
  const lb = luminance(typeof b === "string" ? parse(b) : b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mélange `color` avec du blanc (alpha = part de la couleur). */
export function tint(color: string, alpha: number): RGB {
  return parse(color).map((c) => Math.round(c * alpha + 255 * (1 - alpha))) as RGB;
}

/**
 * Assombrit `color` jusqu'à atteindre `min` de contraste sur `background`.
 * Retourne la couleur inchangée si elle est déjà lisible.
 */
export function readableOn(color: string, background: RGB | string, min = 4.5): string {
  let rgb = parse(color);
  for (let i = 0; i < 40 && contrastRatio(rgb, background) < min; i++) {
    rgb = rgb.map((c) => Math.round(c * 0.92)) as RGB;
  }
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
