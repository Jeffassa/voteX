import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useMe } from "@/lib/queries";

interface Props {
  requireAdmin?: boolean;
}

/**
 * Route guard cookie-based.
 *
 * La décision vient exclusivement de /api/auth/me. Si le navigateur a un
 * cookie httpOnly valide, /me répond 200 et on autorise. Sinon, /me répond
 * 401 (l'interceptor api a déjà déclenché la redirection vers /login en amont).
 */
export function ProtectedRoute({ requireAdmin = false }: Props) {
  const location = useLocation();
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
  }

  if (isError || !me) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && me.role !== "admin" && me.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
