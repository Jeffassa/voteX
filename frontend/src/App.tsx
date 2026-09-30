import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";

import { AdminLayout } from "@/components/AdminLayout";
import { CookieBanner } from "@/components/CookieBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteEffects } from "@/components/RouteEffects";
import { SiteFooter } from "@/components/SiteFooter";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const VotingRoomPage = lazy(() => import("@/pages/VotingRoomPage"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const ResultsPage = lazy(() => import("@/pages/ResultsPage"));
const VerifyVotePage = lazy(() => import("@/pages/VerifyVotePage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const ElectionsListPage = lazy(() => import("@/pages/admin/ElectionsListPage"));
const ElectionFormPage = lazy(() => import("@/pages/admin/ElectionFormPage"));
const ElectionDetailPage = lazy(() => import("@/pages/admin/ElectionDetailPage"));
const StudentsPage = lazy(() => import("@/pages/admin/StudentsPage"));
const ClassesPage = lazy(() => import("@/pages/admin/ClassesPage"));
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"));

import { useMe } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth";

// Indicateur de chargement en CSS pur : il s'affiche avant tout le reste, il ne
// doit donc embarquer aucune bibliothèque d'animation dans le bundle initial.
const PageLoader = () => (
  <div role="status" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
    <span className="sv-spinner" aria-hidden="true" />
    <span className="sr-only">Chargement</span>
  </div>
);

function HomeRedirect() {
  const hasHint = useAuthStore((s) => s.hasSessionHint);
  const { data: me, isLoading } = useMe(hasHint);

  if (!hasHint && !me) return <LandingPage />;
  if (isLoading) return <PageLoader />;
  if (!me) return <LandingPage />;
  if (me.role === "admin" || me.role === "super_admin") {
    return <Navigate to="/admin" replace />;
  }
  return <DashboardPage />;
}

/** Pied de page légal partout, sauf sur la page d'accueil publique qui a le sien. */
function GlobalFooter() {
  const { pathname } = useLocation();
  const hasHint = useAuthStore((s) => s.hasSessionHint);
  const { data: me } = useMe(false);
  if (pathname === "/" && !hasHint && !me) return null;
  return <SiteFooter />;
}

export default function App() {
  useMe(true);

  return (
    <>
    <RouteEffects />
    <a href="#contenu" className="sv-skip-link">Aller au contenu</a>
    <main id="contenu" tabIndex={-1} style={{ outline: "none" }}>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* La vérification d'un reçu est publique : l'API l'est aussi, et un
            électeur doit pouvoir la faire sans se reconnecter. */}
        <Route path="/verify" element={<VerifyVotePage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/cgu" element={<TermsPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/elections/:id/vote" element={<VotingRoomPage />} />
          <Route path="/elections/:id/receipt" element={<ReceiptPage />} />
          <Route path="/elections/:id/results" element={<ResultsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="elections" element={<ElectionsListPage />} />
            <Route path="elections/new" element={<ElectionFormPage mode="create" />} />
            <Route path="elections/:id" element={<ElectionDetailPage />} />
            <Route path="elections/:id/edit" element={<ElectionFormPage mode="edit" />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </main>
    <GlobalFooter />
    <CookieBanner />
    </>
  );
}
