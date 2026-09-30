import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import Loader from "@/components/kokonutui/loader";
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
    <div role="status" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <Loader size="sm" title="Connexion en cours" subtitle="Ouverture de votre session…" />
    </div>
  );
}
