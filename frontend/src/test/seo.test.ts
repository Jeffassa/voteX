// @vitest-environment node
import { describe, expect, it } from "vitest";

import { documentTitle, metaForPath } from "@/lib/routeMeta";
import { PUBLIC_PAGES, robotsTxt, sitemapXml } from "../../seo.config";

describe("titres et indexation", () => {
  it("donne à chaque page un titre suffixé par le nom du site", () => {
    expect(documentTitle(metaForPath("/login", false))).toBe("Connexion · ESATIC SmartVote");
    expect(documentTitle(metaForPath("/cgu", false))).toBe("Conditions générales d'utilisation · ESATIC SmartVote");
  });

  it("distingue l'accueil public du tableau de bord", () => {
    expect(metaForPath("/", false).page).toBe("landing");
    expect(metaForPath("/", false).noindex).toBeFalsy();
    expect(metaForPath("/", true).page).toBe("dashboard");
    expect(metaForPath("/", true).noindex).toBe(true);
  });

  it("résout les routes paramétrées sans exposer l'identifiant", () => {
    const meta = metaForPath("/elections/3f1c9a1e-0000-4000-8000-000000000000/results", true);
    expect(meta.page).toBe("results");
    expect(meta.noindex).toBe(true);
  });

  it("traite toute adresse inconnue comme une 404 non indexable", () => {
    const meta = metaForPath("/nimporte/quoi", false);
    expect(meta.page).toBe("not_found");
    expect(meta.noindex).toBe(true);
  });

  it("n'autorise l'indexation que des pages publiques du sitemap", () => {
    for (const { path } of PUBLIC_PAGES) {
      expect(metaForPath(path, false).noindex, path).toBeFalsy();
    }
  });
});

describe("robots.txt et sitemap.xml", () => {
  const site = "https://smartvote.example";

  it("ferme les espaces privés aux robots et désigne le sitemap", () => {
    const robots = robotsTxt(site);
    for (const p of ["/admin", "/elections/", "/profile", "/api/"]) {
      expect(robots).toContain(`Disallow: ${p}`);
    }
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
  });

  it("liste les pages publiques en URL absolues", () => {
    const xml = sitemapXml(site, "2026-09-29");
    expect(xml).toContain(`<loc>${site}/</loc>`);
    expect(xml).toContain(`<loc>${site}/confidentialite</loc>`);
    expect(xml).not.toContain("/admin");
  });
});
