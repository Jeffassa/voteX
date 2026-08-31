import type { CSSProperties } from "react";

interface BorderBeamProps {
  /** Conservé pour compatibilité d'appel ; sans effet sur le rendu actuel. */
  size?: number;
  /** Durée d'un cycle, en secondes. */
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
  /** Rayon des coins du conteneur, que la bordure doit épouser. */
  radius?: number;
  className?: string;
}

/**
 * Liseré lumineux qui parcourt la bordure d'une carte.
 *
 * L'implémentation précédente faisait tourner un carré dégradé le long d'un
 * `offset-path`, en le confinant à la bordure par un double masque et
 * `mask-composite: exclude`. Élégant sur le papier, fragile en pratique : la
 * combinaison n'était pas honorée par tous les moteurs, et l'effet dégénérait
 * alors en un gros carré orange posé sur le contenu de la carte — bien visible
 * sur la page d'accueil.
 *
 * On lui préfère un dégradé animé peint DANS la bordure via `border-image`,
 * appuyé sur `background-clip`. Deux propriétés universellement supportées,
 * composées par le GPU, et dont l'échec éventuel se limite à une bordure unie
 * plutôt qu'à un artefact.
 */
export function BorderBeam({
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "#FF7A00",
  colorTo = "#FFC988",
  delay = 0,
  radius = 20,
  className,
}: BorderBeamProps) {
  const cssVars: CSSProperties & Record<string, string | number> = {
    "--beam-duration": `${duration}s`,
    "--beam-delay": `-${delay}s`,
    "--beam-width": `${borderWidth}px`,
    "--beam-radius": `${radius}px`,
    "--beam-from": colorFrom,
    "--beam-to": colorTo,
  };

  return <div className={`sv-beam ${className ?? ""}`} style={cssVars} aria-hidden="true" />;
}
