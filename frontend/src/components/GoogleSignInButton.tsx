import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/**
 * Bouton « Continuer avec Google ».
 *
 * Simple lien vers l'API : tout le protocole OpenID Connect se déroule côté
 * serveur (voir backend/app/services/google_oauth.py). Aucun script Google
 * n'est chargé dans la page, la CSP reste `script-src 'self'`.
 *
 * Le bouton ne s'affiche que si l'API annonce le fournisseur configuré.
 * Logo et libellé suivent les consignes de marque de Google.
 */
export function GoogleSignInButton() {
  const { data } = useQuery({
    queryKey: ["auth", "providers"],
    queryFn: async () => (await api.get<{ google: boolean }>("/api/auth/providers")).data,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data?.google) return null;

  const href = `${api.defaults.baseURL?.replace(/\/$/, "") ?? ""}/api/auth/google/start`;

  return (
    <>
    <div className="row items-center gap-3" style={{ margin: "4px 0", color: "var(--ink-500)", fontSize: 13 }}>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: "var(--border)" }} />
      ou
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
    <a href={href} className="btn btn-outline btn-lg" style={{ width: "100%" }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      Continuer avec Google
    </a>
    </>
  );
}

/** Messages affichés au retour d'une connexion Google refusée. */
export const GOOGLE_ERRORS: Record<string, string> = {
  google_aucun_compte:
    "Aucun compte électeur n'utilise cette adresse Google. Connectez-vous avec votre matricule, ou utilisez l'adresse enregistrée par l'école.",
  google_non_active:
    "Ce compte n'est pas encore activé. Activez-le d'abord avec votre matricule et votre code d'activation.",
  google_compte_inactif:
    "Ce compte est en attente de validation ou désactivé. Contactez l'administration.",
  google_email_non_verifie: "Google n'a pas confirmé cette adresse e-mail. Utilisez une adresse vérifiée.",
  google_annule: "Connexion Google annulée.",
  google_session: "La connexion Google a expiré ou a été interrompue. Réessayez.",
  google_google: "Google n'a pas pu confirmer la connexion. Réessayez dans un instant.",
};
