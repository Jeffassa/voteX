/**
 * Mesure d'audience maison, sans cookie ni identifiant, soumise au consentement.
 *
 * Rien ne part tant que le visiteur n'a pas accepté (voir lib/consent.ts). Les
 * appels envoient seulement un nom — gabarit de page ou événement du parcours
 * — que le serveur transforme en compteur Prometheus, lu dans Grafana. Aucun
 * attribut n'est transmis : ni rôle, ni statut HTTP, ni identifiant d'élection.
 */

import { api } from "@/lib/api";
import { analyticsAllowed } from "@/lib/consent";

export type EventName =
  | "activation_code_requested"
  | "activation_code_failed"
  | "account_activated"
  | "account_activation_failed"
  // Revendication mise en attente d'une vérification d'identité.
  | "account_pending_review"
  | "login_success"
  | "login_failed"
  | "vote_submitted"
  | "vote_receipt_downloaded"
  | "vote_verified";

function send(kind: "page" | "event", name: string): void {
  if (!analyticsAllowed()) return;
  api.post("/api/analytics", { kind, name }).catch(() => {
    /* la mesure ne doit jamais gêner le parcours */
  });
}

// Le second argument est conservé pour la compatibilité des appels existants,
// mais n'est jamais transmis : la mesure reste strictement anonyme.
export function trackEvent(eventName: EventName, _payload?: unknown): void {
  send("event", eventName);
}

export function trackPage(page: string): void {
  send("page", page);
}
