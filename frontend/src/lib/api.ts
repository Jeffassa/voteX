import axios, { type AxiosRequestConfig } from "axios";

/**
 * Client HTTP — modèle cookie-based.
 *
 * - withCredentials: true → axios envoie les cookies httpOnly automatiquement
 * - Le jeton CSRF n'est plus lu dans un cookie : le serveur le scelle dans
 *   l'access token (httpOnly) et en publie une copie dans l'en-tête de réponse
 *   `X-CSRF-Token`. On le garde EN MÉMOIRE et on le recopie dans les mutations.
 * - Sur 401, on tente un /refresh une seule fois puis on déconnecte
 *
 * Aucun cookie n'est lisible par le script, et rien n'est écrit dans le
 * stockage du navigateur : le jeton meurt avec l'onglet. Sur une machine
 * partagée, l'onglet suivant ne trouve donc aucune trace de la session.
 */

const CSRF_HEADER = "X-CSRF-Token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  withCredentials: true,
});

/**
 * Jeton CSRF courant. Volontairement une variable de module : ni cookie, ni
 * localStorage, ni sessionStorage — sa durée de vie est celle de la page.
 */
let csrfToken: string | null = null;

/** Le serveur republie le jeton à chaque login, refresh et /me. */
api.interceptors.response.use((response) => {
  const issued = response.headers?.[CSRF_HEADER.toLowerCase()];
  if (typeof issued === "string" && issued) {
    csrfToken = issued;
  }
  return response;
});

const ME_URL = "/api/auth/me";

/**
 * Récupère un jeton quand la mémoire est vide — après un rechargement de page,
 * la première mutation peut précéder l'appel à /me. Un GET ne déclenche pas de
 * vérification CSRF, la requête ne peut donc pas boucler.
 */
async function ensureCsrfToken(): Promise<void> {
  if (csrfToken) return;
  try {
    await api.get(ME_URL);
  } catch {
    /* non authentifié : la mutation recevra un 401, ce qui est correct */
  }
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);
const REFRESH_URL = "/api/auth/refresh";
const LOGIN_URL = "/api/auth/login";
const LOGOUT_URL = "/api/auth/logout";

/**
 * Routes qui n'exigent pas de jeton CSRF côté serveur (aucune session n'existe
 * encore, ou c'est justement l'appel qui en délivre un). Aller y chercher un
 * jeton ferait une requête inutile avant chaque tentative de connexion.
 */
const CSRF_EXEMPT_URLS = [LOGIN_URL, REFRESH_URL, "/api/auth/register", "/api/auth/password-reset"];

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (MUTATING_METHODS.has(method) && !CSRF_EXEMPT_URLS.some((u) => config.url?.includes(u))) {
    await ensureCsrfToken();
    if (csrfToken) {
      config.headers.set(CSRF_HEADER, csrfToken);
    }
  }
  return config;
});

// ──────────────────────────────────────────────────────────────────────
// Refresh logic — dédup des /refresh concurrents
// ──────────────────────────────────────────────────────────────────────

let refreshPromise: Promise<void> | null = null;
const onLogoutCallbacks: Array<() => void> = [];

export function onLogout(cb: () => void) {
  onLogoutCallbacks.push(cb);
}

function triggerLogout() {
  csrfToken = null; // rien ne doit survivre à la fin de session
  for (const cb of onLogoutCallbacks) {
    try {
      cb();
    } catch {
      /* noop */
    }
  }
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const onPublicAuthRoute =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify");
  if (!onPublicAuthRoute) {
    window.location.href = "/login";
  }
}

async function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post(REFRESH_URL, undefined, { _skipRefresh: true } as AxiosRequestConfig)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retried?: boolean; _skipRefresh?: boolean })
      | undefined;
    const status = error.response?.status;

    if (status !== 401 || !original) {
      return Promise.reject(error);
    }

    // Ne pas refresh ni boucler sur /login, /refresh, /logout
    if (
      original._skipRefresh ||
      original.url?.includes(REFRESH_URL) ||
      original.url?.includes(LOGIN_URL) ||
      original.url?.includes(LOGOUT_URL) ||
      original._retried
    ) {
      if (original.url?.includes(REFRESH_URL)) {
        triggerLogout();
      }
      return Promise.reject(error);
    }

    original._retried = true;

    try {
      await refreshOnce();
      return api(original);
    } catch {
      triggerLogout();
      return Promise.reject(error);
    }
  }
);

declare module "axios" {
  interface AxiosRequestConfig {
    _skipRefresh?: boolean;
    _retried?: boolean;
  }
}
