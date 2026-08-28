/**
 * Utilitaire d'analyse et de suivi des événements (Analytics & Conversion Tracking).
 * 
 * Permet de suivre anonymement le tunnel de conversion (Demande code -> Inscription -> Connexion -> Vote)
 * sans stocker de données personnelles identifiables (PII).
 */

export type EventName =
  | "activation_code_requested"
  | "activation_code_failed"
  | "account_activated"
  | "account_activation_failed"
  | "login_success"
  | "login_failed"
  | "vote_submitted"
  | "vote_receipt_downloaded"
  | "vote_verified";

interface EventPayload {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(eventName: EventName, payload?: EventPayload): void {
  const timestamp = new Date().toISOString();
  
  // Log structuré en console pour le développement
  if (import.meta.env.DEV) {
    console.log(`[Analytics 📊] ${timestamp} - ${eventName}`, payload || {});
  }

  // Intégration extensible (ex: Plausible, Umami, PostHog ou webhook personnalisé)
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).plausible) {
    type PlausibleFn = (name: string, options?: { props?: EventPayload }) => void;
    ((window as unknown as Record<string, unknown>).plausible as PlausibleFn)(eventName, { props: payload });
  }
}
