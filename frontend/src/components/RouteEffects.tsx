import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackPage } from "@/lib/analytics";
import { useConsentStore } from "@/lib/consent";
import { useMe } from "@/lib/queries";
import { DEFAULT_DESCRIPTION, SITE_URL, documentTitle, metaForPath } from "@/lib/routeMeta";

function upsertHead(selector: string, attrs: Record<string, string>, tag: "meta" | "link") {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

/**
 * Titre, description, URL canonique et directive d'indexation de chaque page,
 * plus la page vue (si le visiteur a consenti à la mesure d'audience).
 * Centralisé ici pour qu'aucune page ne puisse l'oublier.
 */
export function RouteEffects() {
  const { pathname } = useLocation();
  const { data: me } = useMe(false);
  const consent = useConsentStore((s) => s.analytics);
  const meta = metaForPath(pathname, !!me);

  useEffect(() => {
    const title = documentTitle(meta);
    document.title = title;
    upsertHead('meta[name="description"]', { name: "description", content: meta.description || DEFAULT_DESCRIPTION }, "meta");
    upsertHead('meta[name="robots"]', { name: "robots", content: meta.noindex ? "noindex, nofollow" : "index, follow" }, "meta");
    upsertHead('link[rel="canonical"]', { rel: "canonical", href: `${SITE_URL}${pathname}` }, "link");
    upsertHead('meta[property="og:title"]', { property: "og:title", content: title }, "meta");
    upsertHead('meta[property="og:url"]', { property: "og:url", content: `${SITE_URL}${pathname}` }, "meta");
    // `meta` est recalculé à chaque rendu : on dépend de ses champs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, meta.description, meta.noindex, pathname]);

  // Une page vue par changement de page, et seulement une fois le consentement
  // donné : la page en cours est comptée dès que le visiteur accepte.
  useEffect(() => {
    if (consent === true) trackPage(meta.page);
  }, [meta.page, consent]);

  return null;
}
