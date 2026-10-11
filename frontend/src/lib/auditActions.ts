/**
 * Libellés du journal d'audit, partagés par le journal et le tableau de bord.
 * Les clés suivent l'énumération AuditAction du serveur (app/models/audit.py).
 */

export type AuditCategory = "access" | "elections" | "people" | "votes";

export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "access", label: "Connexions" },
  { value: "elections", label: "Élections" },
  { value: "people", label: "Étudiants et classes" },
  { value: "votes", label: "Votes" },
];

interface ActionMeta {
  label: string;
  color: string;
  category: AuditCategory;
}

const INFO = "var(--info-600)";
const SUCCESS = "var(--success-600)";
const WARN = "var(--warn-500)";
const DANGER = "var(--danger-600)";
const NEUTRAL = "var(--ink-400)";

const ACTIONS: Record<string, ActionMeta> = {
  login: { label: "Connexion", color: NEUTRAL, category: "access" },
  login_failed: { label: "Connexion refusée", color: DANGER, category: "access" },
  logout: { label: "Déconnexion", color: NEUTRAL, category: "access" },
  password_changed: { label: "Mot de passe modifié", color: INFO, category: "access" },
  password_reset_requested: { label: "Réinitialisation demandée", color: INFO, category: "access" },
  password_reset_confirmed: { label: "Mot de passe réinitialisé", color: SUCCESS, category: "access" },
  election_created: { label: "Élection créée", color: INFO, category: "elections" },
  election_updated: { label: "Élection modifiée", color: WARN, category: "elections" },
  election_deleted: { label: "Élection supprimée", color: DANGER, category: "elections" },
  election_opened: { label: "Scrutin ouvert", color: SUCCESS, category: "elections" },
  election_closed: { label: "Scrutin clôturé", color: WARN, category: "elections" },
  candidate_created: { label: "Candidat ajouté", color: INFO, category: "elections" },
  candidate_deleted: { label: "Candidat retiré", color: DANGER, category: "elections" },
  student_created: { label: "Étudiant inscrit", color: INFO, category: "people" },
  student_updated: { label: "Étudiant modifié", color: WARN, category: "people" },
  student_deleted: { label: "Étudiant supprimé", color: DANGER, category: "people" },
  student_role_changed: { label: "Rôle modifié", color: "var(--orange-500)", category: "people" },
  class_created: { label: "Classe créée", color: INFO, category: "people" },
  class_updated: { label: "Classe modifiée", color: WARN, category: "people" },
  class_deleted: { label: "Classe supprimée", color: DANGER, category: "people" },
  vote_cast: { label: "Vote enregistré", color: SUCCESS, category: "votes" },
};

export function auditMeta(action: string): ActionMeta {
  return ACTIONS[action] ?? { label: action.replace(/_/g, " "), color: NEUTRAL, category: "access" };
}

/**
 * Auteur affiché. Sans compte rattaché, une connexion refusée vient d'une
 * personne non identifiée, pas du « Système » qu'affichait l'ancien journal.
 */
export function auditActor(e: { action: string; actor_id: string | null; actor_name?: string | null }): string {
  if (e.actor_name) return e.actor_name;
  if (e.actor_id) return "Compte supprimé";
  return auditMeta(e.action).category === "access" ? "Non identifié" : "Système";
}
