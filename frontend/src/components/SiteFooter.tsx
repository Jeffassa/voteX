import { Link } from "react-router-dom";

import { useConsentStore } from "@/lib/consent";

/** Pied de page commun : mentions légales, préférences de cookies, vérification. */
export function SiteFooter() {
  const reopen = useConsentStore((s) => s.reopen);
  const year = new Date().getFullYear();

  return (
    <footer className="sv-site-footer">
      <div className="sv-site-footer-inner">
        <span>© {year} ESATIC SmartVote</span>
        <nav aria-label="Liens légaux">
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/cgu">CGU</Link>
          <button type="button" className="sv-link-button" onClick={reopen}>
            Gérer les cookies
          </button>
          <Link to="/verify">Vérifier un vote</Link>
        </nav>
      </div>
    </footer>
  );
}
