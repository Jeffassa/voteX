import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, SearchX, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/Brand";

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="sv-legal-page">
      <div className="sv-notfound">
        <Link to="/" aria-label="ESATIC SmartVote, retour à l'accueil">
          <Brand />
        </Link>
        <div className="sv-notfound-icon" aria-hidden="true">
          <SearchX size={36} />
        </div>
        <p className="h-eyebrow">Erreur 404</p>
        <h1>Cette page n'existe pas</h1>
        <p className="muted">
          L'adresse <code>{pathname}</code> ne correspond à aucune page. Le lien est peut-être
          ancien, ou l'adresse a été mal saisie.
        </p>
        <div className="sv-notfound-actions">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={16} aria-hidden="true" /> Retour à l'accueil
          </Link>
          <Link to="/verify" className="btn btn-outline">
            <ShieldCheck size={16} aria-hidden="true" /> Vérifier un vote
          </Link>
        </div>
      </div>
    </div>
  );
}
