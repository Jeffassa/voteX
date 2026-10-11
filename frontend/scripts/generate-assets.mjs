/**
 * Génère les icônes (favicon PNG, PWA, Apple) et l'image de partage réseaux
 * sociaux à partir de public/favicon.svg, via le Chromium de Playwright.
 *
 *   node scripts/generate-assets.mjs && python scripts/compress-images.py
 *
 * Les fichiers produits sont versionnés : ce script ne tourne qu'au changement
 * du logo (docs/brand/), jamais pendant le build.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const pub = join(root, "public");
// Version claire uniquement : les icônes ne suivent pas le thème du système.
const svg = readFileSync(join(pub, "favicon.svg"), "utf8").replace(/@media[^}]*\}[^}]*\}\}/, "");
mkdirSync(join(pub, "icons"), { recursive: true });

const PAPER = "#F1EDE2";
const font = (pkg, file) =>
  readFileSync(join(root, "node_modules", "@fontsource-variable", pkg, "files", file)).toString("base64");

// pad : marge autour du logo, en part de la taille. radius : coins de la tuile.
const icons = [
  { file: "icons/icon-192.png", size: 192, pad: 0.17, bg: PAPER, radius: 0.22 },
  { file: "icons/icon-512.png", size: 512, pad: 0.17, bg: PAPER, radius: 0.22 },
  // « maskable » : le système peut rogner jusqu'à 20 % du bord, le logo reste au centre.
  { file: "icons/icon-maskable-512.png", size: 512, pad: 0.24, bg: PAPER, radius: 0 },
  // iOS remplit la transparence en noir : tuile opaque, il arrondit lui-même.
  { file: "icons/apple-touch-icon.png", size: 180, pad: 0.17, bg: PAPER, radius: 0 },
  { file: "icons/favicon-32.png", size: 32, pad: 0.02 },
  // Source du favicon.ico, supprimée par compress-images.py après usage.
  { file: "favicon-source.png", size: 256, pad: 0.02 },
];

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Newsreader; font-weight: 200 800;
    src: url(data:font/woff2;base64,${font("newsreader", "newsreader-latin-wght-normal.woff2")}) format("woff2"); }
  @font-face { font-family: Geist; font-weight: 100 900;
    src: url(data:font/woff2;base64,${font("geist", "geist-latin-wght-normal.woff2")}) format("woff2"); }
  body { margin:0; width:1200px; height:630px; background:${PAPER}; color:#0A2540; overflow:hidden;
         font-family: Geist, Arial, sans-serif; display:grid; grid-template-columns: 1fr 430px; }
  .text { padding: 64px 0 60px 80px; display:flex; flex-direction:column; }
  .ref { font: 500 18px/1 Geist; letter-spacing:.14em; text-transform:uppercase; color:#5B5F6B;
         border-bottom: 2px solid #0A2540; padding-bottom: 18px; }
  h1 { font: 520 78px/1.02 Newsreader, Georgia, serif; letter-spacing:-.015em; margin: auto 0 22px; max-width: 640px; }
  p { font-size: 26px; line-height:1.35; color:#3A3E49; margin:0; max-width:620px; }
  .stamps { display:flex; gap:14px; margin-top:34px; }
  .stamp { font: 600 17px/1 Geist; letter-spacing:.1em; text-transform:uppercase; color:#0A2540;
           border:2px solid #0A2540; border-radius:4px; padding:11px 16px; }
  .mark { display:grid; place-items:center; border-left: 1px solid #CBC4B5; }
  .mark svg { width: 300px; height: 300px; }
</style></head><body>
  <div class="text">
    <div class="ref">ESATIC SmartVote · Abidjan</div>
    <h1>Le vote des chefs de classe, secret et vérifiable.</h1>
    <p>Plateforme officielle de vote en ligne de l'ESATIC.</p>
    <div class="stamps"><div class="stamp">Vote secret</div><div class="stamp">Reçu vérifiable</div><div class="stamp">Ancrage blockchain</div></div>
  </div>
  <div class="mark">${svg}</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, pad, bg, radius = 0 } of icons) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent">
         <div style="position:absolute;inset:0;background:${bg || "transparent"};border-radius:${radius * size}px"></div>
         <div style="position:relative;width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
       </body></html>`
    );
    await page.screenshot({ path: join(pub, file), omitBackground: true });
    console.log("écrit", file);
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(pub, "og-image.png") });
  console.log("écrit og-image.png");
} finally {
  await browser.close();
}
