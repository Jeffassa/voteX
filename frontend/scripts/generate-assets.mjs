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
// Version claire du logo pour le panneau sombre de l'image de partage.
const svgInverse = readFileSync(join(root, "..", "docs", "brand", "logo-inverse.svg"), "utf8")
  .replace("<svg ", '<svg width="100%" height="100%" ');
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
  @font-face { font-family: Mona; font-weight: 200 900; font-stretch: 75% 125%;
    src: url(data:font/woff2;base64,${font("mona-sans", "mona-sans-latin-standard-normal.woff2")}) format("woff2"); }
  body { margin:0; width:1200px; height:630px; background:#F5F4F1; color:#131517; overflow:hidden;
         font-family: Mona, Arial, sans-serif; display:grid; grid-template-columns: 1fr 420px; }
  .text { padding: 70px 0 64px 80px; display:flex; flex-direction:column; }
  .kicker { display:flex; align-items:center; gap:14px; font-size: 22px; font-weight: 560; color:#62676E; }
  .kicker::before { content:""; width:26px; height:6px; border-radius:2px; background:#C9967A; transform:skewX(-28deg); }
  h1 { font-size: 86px; font-weight: 660; font-stretch: 118%; line-height: 0.96; letter-spacing: -0.05em; margin: auto 0 26px; max-width: 690px; }
  p { font-size: 26px; line-height:1.4; color:#41464C; margin:0; max-width:640px; }
  .chips { display:flex; gap:12px; margin-top:34px; }
  .chip { font-size: 19px; font-weight: 600; color:#131517; background:#fff; border:1px solid #E4E2DD; border-radius: 999px; padding: 10px 18px; }
  .mark { position:relative; display:grid; place-items:center; background:#17191C; }
  .mark .echo { position:absolute; left:50%; bottom:40px; width: 400px; transform: translateX(-50%); }
  .mark .echo path[stroke="#131517"] { stroke: #F3F1EC; }
  .mark .logo { position:relative; width: 180px; height: 180px; margin-top: -60px; }
</style></head><body>
  <div class="text">
    <div class="kicker">ESATIC SmartVote · Abidjan</div>
    <h1>Le vote des chefs de classe, en ligne.</h1>
    <p>Secret, vérifiable, depuis votre téléphone.</p>
    <div class="chips"><div class="chip">Vote secret</div><div class="chip">Reçu vérifiable</div><div class="chip">Ancrage blockchain</div></div>
  </div>
  <div class="mark"><svg class="echo" viewBox="0 0 400 320"><path d="M78.1 70L200 300L321.9 70" fill="none" stroke="#C9967A" stroke-opacity="0.90" stroke-width="2"/><path d="M78.1 44L200 274L321.9 44" fill="none" stroke="#C9967A" stroke-opacity="0.75" stroke-width="2"/><path d="M78.1 18L200 248L321.9 18" fill="none" stroke="#C9967A" stroke-opacity="0.60" stroke-width="2"/><path d="M78.1 -8L200 222L321.9 -8" fill="none" stroke="#131517" stroke-opacity="0.17" stroke-width="2"/><path d="M78.1 -34L200 196L321.9 -34" fill="none" stroke="#131517" stroke-opacity="0.16" stroke-width="2"/><path d="M78.1 -60L200 170L321.9 -60" fill="none" stroke="#131517" stroke-opacity="0.15" stroke-width="2"/><path d="M78.1 -86L200 144L321.9 -86" fill="none" stroke="#131517" stroke-opacity="0.13" stroke-width="2"/><path d="M78.1 -112L200 118L321.9 -112" fill="none" stroke="#131517" stroke-opacity="0.12" stroke-width="2"/><path d="M78.1 -138L200 92L321.9 -138" fill="none" stroke="#131517" stroke-opacity="0.10" stroke-width="2"/></svg><div class="logo">${svgInverse}</div></div>
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
