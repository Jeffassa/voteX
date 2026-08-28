import axios, { type AxiosRequestConfig } from "axios";

/**
 * Client HTTP — modèle cookie-based.
 *
 * - withCredentials: true → axios envoie les cookies httpOnly automatiquement
 * - Pour les mutations (POST/PUT/PATCH/DELETE), on lit le cookie `sv_csrf`
 *   (non httpOnly, exposé au JS) et on le renvoie en header `X-CSRF-Token`
 *   (pattern double-submit cookie — voir backend csrf.py)
 * - Sur 401, on tente un /refresh une seule fois puis on déconnecte
 *
 * Aucun token n'est manipulé côté client — c'est le serveur qui gère tout via
 * les cookies httpOnly. Une faille XSS ne peut donc pas voler la session.
 */

const CSRF_COOKIE = "sv_csrf";
const CSRF_HEADER = "X-CSRF-Token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  withCredentials: true,
});

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);
const REFRESH_URL = "/api/auth/refresh";
const LOGIN_URL = "/api/auth/login";
const LOGOUT_URL = "/api/auth/logout";

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    const csrf = readCsrfCookie();
    if (csrf) {
      config.headers.set(CSRF_HEADER, csrf);
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
