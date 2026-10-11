import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { LogoMark } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { authKeys } from "@/lib/queries/auth";
import { useAuthStore } from "@/stores/auth";
import type { Me } from "@/types/api";

/**
 * Arrivée après une connexion Google réussie.
 *
 * Le serveur a déjà posé les cookies de session. Il ne transmet pas le jeton
 * CSRF dans l'URL de redirection : on le récupère ici par /api/auth/me, comme
 * après un rechargement de page, puis on oriente selon le rôle.
 */
export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markLoggedIn = useAuthStore((s) => s.markLoggedIn);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Me>("/api/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        markLoggedIn();
        queryClient.setQueryData(authKeys.me, data);
        trackEvent("login_success");
        navigate(data.role === "student" ? "/" : "/admin", { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/login?erreur=google_session", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [markLoggedIn, navigate, queryClient]);

  return (
    <div role="status" className="sv-callback">
      <LogoMark size={52} />
      <span className="sv-callback-bar" aria-hidden="true" />
      <p className="sv-display sv-callback-title">Connexion en cours</p>
      <p className="sv-callback-sub">Ouverture de votre session…</p>
    </div>
  );
}
