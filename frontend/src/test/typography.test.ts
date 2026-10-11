// @vitest-environment node
/**
 * Pas de tiret long (cadratin « — », demi-cadratin « – ») dans les textes du
 * site. Choix éditorial : on écrit avec une virgule, deux-points ou des
 * parenthèses. Les commentaires de code ne sont pas concernés, seuls les
 * textes qui peuvent s'afficher le sont.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
// Code tiers copié tel quel (registres shadcn) : on ne le réécrit pas.
const VENDORED = [join(SRC, "components", "charts"), join(SRC, "components", "kokonutui")];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (VENDORED.some((v) => full.startsWith(v))) return [];
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("typographie", () => {
  it.each(files(SRC).map((f) => [f.slice(ROOT.length + 1), f]))("%s n'affiche aucun tiret long", (_, file) => {
    const code = withoutComments(readFileSync(file, "utf8"));
    const lines = code.split("\n").filter((l) => /[—–]/.test(l));
    expect(lines, lines.join("\n")).toEqual([]);
  });

  it("index.html n'en affiche pas non plus", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
    expect(html).not.toMatch(/[—–]/);
  });
});
