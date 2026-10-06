import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Brand } from "@/components/Brand";

interface Props {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

/** Mise en page commune des pages légales : lisible, imprimable, sans animation. */
export function LegalLayout({ title, updatedAt, children }: Props) {
  return (
    <div className="sv-legal-page">
      <header className="sv-legal-header">
        <div className="sv-legal-container sv-legal-header-inner">
          <Link to="/" aria-label="ESATIC SmartVote, retour à l'accueil">
            <Brand />
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} aria-hidden="true" /> Accueil
          </Link>
        </div>
      </header>
      <div className="sv-legal-container sv-legal-main">
        <h1>{title}</h1>
        <p className="sv-legal-updated">Dernière mise à jour : {updatedAt}</p>
        <div className="sv-legal-body">{children}</div>
      </div>
    </div>
  );
}

/** Coordonnées publiées sur esatic.ci, relevées le 30 septembre 2026. */
export const ESATIC = {
  address:
    "Zone 3, boulevard Philippe Grégoire Yacé (ex-boulevard de Marseille), Treichville, Abidjan, Côte d'Ivoire",
  phone: "+225 27 21 21 81 00",
  email: "direction.esatic@esatic.edu.ci",
};

export function EsaticMail() {
  return <a href={`mailto:${ESATIC.email}`}>{ESATIC.email}</a>;
}

export function EsaticPhone() {
  return <a href={`tel:${ESATIC.phone.replace(/\s/g, "")}`}>{ESATIC.phone}</a>;
}

/** Repère visible d'une information que l'établissement doit renseigner. */
export function ToFill({ children }: { children: ReactNode }) {
  return <mark className="sv-to-fill">[À COMPLÉTER : {children}]</mark>;
}
