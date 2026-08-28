/**
 * Helpers pour transformer les erreurs API en messages utilisateur.
 *
 * FastAPI/Pydantic v2 renvoie 3 formats différents selon où l'erreur survient :
 * 1. Erreur métier (DomainError) → `{ "detail": "Texte clair" }`
 * 2. Erreur validation Pydantic → `{ "detail": [{type, loc, msg, input}, ...] }`
 * 3. Erreur HTTPException standard → `{ "detail": "Texte clair" }`
 *
 * Si on passe direct `detail` à `setErr(...)` et que c'est une liste,
 * React crashe en essayant de render un objet. D'où ce helper.
 */

interface PydanticErrorItem {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

function isPydanticErrorList(value: unknown): value is PydanticErrorItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "msg" in (value[0] as object) &&
    "loc" in (value[0] as object)
  );
}

const FIELD_LABELS: Record<string, string> = {
  matricule: "Matricule",
  password: "Mot de passe",
  confirm_password: "Confirmation du mot de passe",
  first_name: "Prénom",
  last_name: "Nom",
  email: "Email",
  new_password: "Nouveau mot de passe",
  old_password: "Ancien mot de passe",
};

function formatPydanticError(item: PydanticErrorItem): string {
  // loc = ["body", "field_name"] le plus souvent
  const fieldName = item.loc[item.loc.length - 1];
  const label = typeof fieldName === "string" ? FIELD_LABELS[fieldName] ?? fieldName : "Champ";
  return `${label} : ${item.msg}`;
}

/**
 * Extrait un message utilisateur lisible depuis n'importe quelle erreur axios.
 *
 * @param error l'erreur axios attrapée dans un catch
 * @param fallback message par défaut si rien d'exploitable
 */
export function extractErrorMessage(error: unknown, fallback = "Une erreur est survenue"): string {
  const err = error as {
    response?: { data?: { detail?: unknown; message?: unknown }; status?: number };
    message?: string;
  };

  const detail = err?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (isPydanticErrorList(detail)) {
    // Concat les premières erreurs (souvent 1 seule)
    return detail.slice(0, 3).map(formatPydanticError).join(" • ");
  }

  // Fallback sur `message` si le backend a renvoyé un autre format
  const message = err?.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  // Fallback sur le message d'axios (timeout, network error...)
  if (err?.message && err.message !== "Network Error") {
    return err.message;
  }
  if (err?.message === "Network Error") {
    return "Impossible de joindre le serveur. Vérifie ta connexion.";
  }

  return fallback;
}

/** Code HTTP de la réponse (undefined si pas de réponse — erreur réseau). */
export function extractStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
