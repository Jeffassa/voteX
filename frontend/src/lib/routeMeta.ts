import { matchPath } from "react-router-dom";

export const SITE_NAME = "ESATIC SmartVote";

export const SITE_URL: string = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

export const DEFAULT_DESCRIPTION =
  "Plateforme officielle de vote en ligne pour l'élection des chefs de classe de l'ESATIC : authentification sécurisée, vote secret et vérifiable.";

export interface RouteMeta {
  /** Nom anonyme de la page pour la mesure d'audience (liste fermée côté API). */
  page: string;
  title: string;
  description?: string;
  /** Pages privées : pas d'indexation par les moteurs. */
  noindex?: boolean;
}

// L'ordre compte : le premier motif qui correspond l'emporte.
const ROUTES: Array<[string, RouteMeta]> = [
  ["/login", { page: "login", title: "Connexion", description: "Connectez-vous à ESATIC SmartVote avec votre matricule ou votre compte Google pour voter dans votre classe." }],
  ["/register", { page: "register", title: "Activer mon compte", description: "Activez votre compte étudiant ESATIC SmartVote à partir de votre matricule." }],
  ["/forgot-password", { page: "forgot_password", title: "Mot de passe oublié", noindex: true }],
  ["/reset-password", { page: "reset_password", title: "Nouveau mot de passe", noindex: true }],
  ["/connexion/google", { page: "login", title: "Connexion", noindex: true }],
  ["/confirmer-email", { page: "profile", title: "Confirmation de l'adresse e-mail", noindex: true }],
  ["/verify", { page: "verify", title: "Vérifier un vote", description: "Vérifiez qu'un bulletin a bien été enregistré, à partir du hash de votre reçu de vote." }],
  ["/confidentialite", { page: "privacy", title: "Politique de confidentialité", description: "Comment ESATIC SmartVote traite vos données personnelles et garantit le secret du vote." }],
  ["/cgu", { page: "terms", title: "Conditions générales d'utilisation", description: "Conditions générales d'utilisation de la plateforme de vote ESATIC SmartVote." }],
  ["/elections/:id/vote", { page: "vote", title: "Isoloir", noindex: true }],
  ["/elections/:id/receipt", { page: "receipt", title: "Reçu de vote", noindex: true }],
  ["/elections/:id/results", { page: "results", title: "Résultats", noindex: true }],
  ["/profile", { page: "profile", title: "Mon profil", noindex: true }],
  ["/admin", { page: "admin_dashboard", title: "Administration", noindex: true }],
  ["/admin/elections", { page: "admin_elections", title: "Élections · Administration", noindex: true }],
  ["/admin/elections/new", { page: "admin_election_form", title: "Nouvelle élection · Administration", noindex: true }],
  ["/admin/elections/:id/edit", { page: "admin_election_form", title: "Modifier l'élection · Administration", noindex: true }],
  ["/admin/elections/:id", { page: "admin_election_detail", title: "Détail de l'élection · Administration", noindex: true }],
  ["/admin/students", { page: "admin_students", title: "Étudiants · Administration", noindex: true }],
  ["/admin/classes", { page: "admin_classes", title: "Classes · Administration", noindex: true }],
  ["/admin/audit", { page: "admin_audit", title: "Journal d'audit · Administration", noindex: true }],
  ["/admin/profile", { page: "profile", title: "Mon profil · Administration", noindex: true }],
];

const NOT_FOUND: RouteMeta = { page: "not_found", title: "Page introuvable", noindex: true };

export function metaForPath(pathname: string, isAuthenticated: boolean): RouteMeta {
  if (pathname === "/") {
    return isAuthenticated
      ? { page: "dashboard", title: "Tableau de bord", noindex: true }
      : { page: "landing", title: "Vote étudiant sécurisé et vérifiable", description: DEFAULT_DESCRIPTION };
  }
  for (const [pattern, meta] of ROUTES) {
    if (matchPath({ path: pattern, end: true }, pathname)) return meta;
  }
  return NOT_FOUND;
}

export function documentTitle(meta: RouteMeta): string {
  return `${meta.title} · ${SITE_NAME}`;
}
