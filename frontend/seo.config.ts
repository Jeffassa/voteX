/**
 * robots.txt, sitemap.xml et URL absolues d'index.html, dérivés d'une seule
 * variable : VITE_SITE_URL (URL publique du frontend).
 *
 * Générés au build plutôt qu'écrits à la main dans public/ : le domaine de
 * production n'a pas à être codé en dur, et une page publique ajoutée ici
 * rejoint à la fois le sitemap et l'autorisation d'indexation.
 */
import type { Plugin } from "vite";

export const DEFAULT_SITE_URL = "https://smartvote.esatic.ci";

/** Pages publiques indexables. Tout le reste exige une session. */
export const PUBLIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/verify", priority: "0.8", changefreq: "monthly" },
  { path: "/login", priority: "0.6", changefreq: "yearly" },
  { path: "/register", priority: "0.6", changefreq: "yearly" },
  { path: "/confidentialite", priority: "0.3", changefreq: "yearly" },
  { path: "/cgu", priority: "0.3", changefreq: "yearly" },
];

const PRIVATE_PREFIXES = ["/admin", "/elections/", "/profile", "/reset-password", "/forgot-password", "/api/"];

export function robotsTxt(siteUrl: string): string {
  return [
    "User-agent: *",
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(siteUrl: string, lastmod: string): string {
  const urls = PUBLIC_PAGES.map(
    (p) =>
      `  <url>\n    <loc>${siteUrl}${p.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function seoFiles(rawSiteUrl: string | undefined): Plugin {
  const siteUrl = (rawSiteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
  const lastmod = new Date().toISOString().slice(0, 10);
  const files: Record<string, { type: string; body: () => string }> = {
    "/robots.txt": { type: "text/plain; charset=utf-8", body: () => robotsTxt(siteUrl) },
    "/sitemap.xml": { type: "application/xml; charset=utf-8", body: () => sitemapXml(siteUrl, lastmod) },
  };

  return {
    name: "smartvote-seo-files",
    transformIndexHtml(html) {
      return html.split("%SITE_URL%").join(siteUrl);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? files[req.url.split("?")[0]] : undefined;
        if (!file) return next();
        res.setHeader("Content-Type", file.type);
        res.end(file.body());
      });
    },
    generateBundle() {
      for (const [path, file] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: file.body() });
      }
    },
  };
}
