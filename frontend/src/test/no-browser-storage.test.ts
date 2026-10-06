// @vitest-environment node
/**
 * Aucune donnée ne doit être écrite dans le stockage du navigateur.
 *
 * Une plateforme de vote s'utilise souvent depuis une machine partagée — salle
 * informatique, poste d'un camarade. Tout ce qu'une page y laisse survit à la
 * déconnexion et reste lisible par l'utilisateur suivant, par une extension, ou
 * par un XSS. Le reçu de vote y a déjà été écrit une fois, `candidate_id`
 * compris : le choix de l'électeur était persisté sur le disque de la machine.
 *
 * La session vit exclusivement dans des cookies httpOnly, que le JavaScript ne
 * peut pas lire — il n'existe plus aucun cookie accessible au script. Le jeton
 * CSRF arrive par l'en-tête `X-CSRF-Token` et ne vit qu'en mémoire, le temps de
 * l'onglet.
 *
 * Ce test lit le code source plutôt que d'observer l'exécution : il attrape la
 * réintroduction dès l'écriture, y compris sur un chemin qu'aucun test ne
 * parcourt.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Résolu depuis la racine du projet : `import.meta.dirname` n'est pas fiable
// une fois le fichier transformé par Vite, et un mauvais chemin ferait passer
// ce test sans rien analyser du vrai code.
const SRC = join(process.cwd(), "src");

/** API de stockage persistant interdites dans le code applicatif. */
const FORBIDDEN = ["localStorage", "sessionStorage", "indexedDB", "openDatabase"];

/** Ce fichier parle des API interdites : il ne peut pas s'auto-interdire. */
const EXEMPT = new Set(["no-browser-storage.test.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !EXEMPT.has(entry) ? [full] : [];
  });
}

/** Retire les commentaires : seul le code exécutable compte. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*/g, " ");
}

describe("stockage du navigateur", () => {
  const files = sourceFiles(SRC);

  it("trouve bien des fichiers à analyser", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)("n'utilise jamais %s", (api) => {
    const offenders = files.filter((file) =>
      // String.raw : dans un gabarit ordinaire, la séquence backslash-b vaut le
      // caractère backspace, pas l'ancre de mot — la recherche ne trouvait rien.
      new RegExp(String.raw`\b${api}\b`).test(stripComments(readFileSync(file, "utf8"))),
    );

    expect(
      offenders,
      `${api} est interdit : une machine partagée garderait la trace de ce qui y est écrit. ` +
        `Si une donnée doit survivre au rechargement, elle appartient au serveur.`,
    ).toEqual([]);
  });

  it("ne touche jamais aux cookies", () => {
    const offenders = files.filter((file) =>
      /\bdocument\.cookie\b/.test(stripComments(readFileSync(file, "utf8"))),
    );

    expect(
      offenders,
      "Plus aucun cookie n'est lisible par le script : la session vit dans des " +
        "cookies httpOnly, et le jeton CSRF arrive par l'en-tête X-CSRF-Token, " +
        "gardé en mémoire. Lire document.cookie n'a donc plus de raison d'être.",
    ).toEqual([]);
  });
});
