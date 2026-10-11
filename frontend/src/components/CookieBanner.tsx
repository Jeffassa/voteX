import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

import { useConsentStore } from "@/lib/consent";

/**
 * Bannière de consentement.
 *
 * Seule la mesure d'audience y est soumise : les cookies de session sont
 * strictement nécessaires au service et n'ont pas besoin d'accord. « Refuser »
 * est aussi visible et aussi simple que « Accepter » — un refus ne doit pas
 * coûter plus d'effort qu'un accord.
 */
export function CookieBanner() {
  const { analytics, loaded, reopened, load, choose } = useConsentStore();

  useEffect(() => {
    void load();
  }, [load]);

  const visible = (loaded && analytics === null) || reopened;
  if (!visible) return null;

  return (
    <section className="sv-cookie-banner" role="region" aria-label="Préférences de cookies">
      <div className="sv-cookie-banner-inner">
        <Cookie size={22} aria-hidden="true" className="sv-cookie-icon" />
        <div className="sv-cookie-text">
          <strong>Votre vie privée</strong>
          <p>
            SmartVote n'utilise que les cookies nécessaires à votre connexion. Avec votre accord,
            nous mesurons aussi, de façon anonyme, les pages consultées afin d'améliorer le
            service, sans identifiant, sans outil tiers ni publicité.{" "}
            <Link to="/confidentialite#cookies">En savoir plus</Link>
          </p>
        </div>
        <div className="sv-cookie-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void choose(false)}>
            Refuser
          </button>
          <button type="button" className="btn btn-navy btn-sm" onClick={() => void choose(true)}>
            Accepter
          </button>
        </div>
      </div>
    </section>
  );
}
