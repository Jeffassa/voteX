/**
 * Génère les icônes (favicon PNG, PWA, Apple) et l'image de partage réseaux
 * sociaux à partir de public/favicon.svg, via le Chromium de Playwright.
 *
 *   node scripts/generate-assets.mjs && python scripts/compress-images.py
 *
 * Les fichiers produits sont versionnés : ce script ne tourne qu'au changement
 * du logo, jamais pendant le build.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const pub = join(root, "public");
const svg = readFileSync(join(pub, "favicon.svg"), "utf8");
mkdirSync(join(pub, "icons"), { recursive: true });

const icons = [
  { file: "icons/icon-192.png", size: 192, pad: 0 },
  { file: "icons/icon-512.png", size: 512, pad: 0 },
  // « maskable » : le système peut rogner jusqu'à 20 % du bord.
  { file: "icons/icon-maskable-512.png", size: 512, pad: 0.12, bg: "#0A2540" },
  { file: "icons/apple-touch-icon.png", size: 180, pad: 0 },
  { file: "icons/favicon-32.png", size: 32, pad: 0 },
];

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; width:1200px; height:630px; font-family: "Segoe UI", Inter, Arial, sans-serif;
         background:#0A2540; color:white; display:flex; overflow:hidden; position:relative; }
  .dots { position:absolute; inset:0; opacity:.07;
          background-image: radial-gradient(circle at 20% 20%, white 1.4px, transparent 2px); background-size:28px 28px; }
  .glow { position:absolute; right:-120px; top:-120px; width:560px; height:560px; border-radius:50%;
          background:#FF7A00; opacity:.18; filter:blur(90px); }
  .wrap { position:relative; padding:72px 80px; display:flex; flex-direction:column; width:100%; }
  .brand { display:flex; align-items:center; gap:18px; font-size:30px; font-weight:600; }
  .brand svg { width:64px; height:64px; }
  .brand span { color:#CBD5E1; font-weight:400; }
  h1 { font-size:68px; line-height:1.05; letter-spacing:-2px; margin:auto 0 18px; max-width:900px; }
  h1 em { font-style:normal; color:#FF9333; }
  p { font-size:28px; color:#CBD5E1; margin:0; max-width:880px; line-height:1.35; }
  .chips { display:flex; gap:14px; margin-top:34px; }
  .chip { border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:10px 20px; font-size:22px; color:#E2E8F0; }
</style></head><body>
  <div class="dots"></div><div class="glow"></div>
  <div class="wrap">
    <div class="brand">${svg}<div>ESATIC <span>SmartVote</span></div></div>
    <h1>Le vote des chefs de classe, <em>secret et vérifiable</em>.</h1>
    <p>Plateforme officielle de vote en ligne de l'ESATIC.</p>
    <div class="chips"><div class="chip">Vote secret</div><div class="chip">Reçu vérifiable</div><div class="chip">Ancrage blockchain</div></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, pad, bg } of icons) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg || "transparent"}">
         <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
       </body></html>`
    );
    await page.screenshot({ path: join(pub, file), omitBackground: !bg });
    console.log("écrit", file);
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og);
  await page.screenshot({ path: join(pub, "og-image.png") });
  console.log("écrit og-image.png");
} finally {
  await browser.close();
}
