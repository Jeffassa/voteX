import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, GraduationCap, LayoutDashboard, LogOut, Users, Vote } from "lucide-react";

import { Avatar, getInitials } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { useLogout, useMe } from "@/lib/queries";
import { usePendingStudents } from "@/lib/queries/admin";

const NAV = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/admin/elections", label: "Élections", icon: Vote },
  { to: "/admin/students", label: "Étudiants", icon: Users, pending: true },
  { to: "/admin/classes", label: "Classes", icon: GraduationCap },
  { to: "/admin/audit", label: "Journal d'audit", icon: Activity },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  // Comptes à valider : signalés dans le menu, quel que soit l'écran ouvert.
  const { data: pending } = usePendingStudents();
  const pendingCount = pending?.length ?? 0;
  const fullName = `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim();

  return (
    <div className="sv-admin-layout" style={{ display: "grid", gridTemplateColumns: "248px 1fr", minHeight: "100vh" }}>
      <aside
        className="sv-admin-sidebar"
        style={{
          background: "var(--navy-900)",
          color: "white",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Link to="/admin" style={{ paddingLeft: 6 }} aria-label="Tableau de bord">
          <div className="brand-inverse" style={{ display: "inline-block" }}>
            <Brand />
          </div>
        </Link>

        <nav aria-label="Administration" className="sv-admin-nav" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <div className="h-eyebrow sv-admin-eyebrow" style={{ color: "rgba(255,255,255,0.55)", padding: "0 12px 8px", fontSize: 12 }}>
            Administration
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const count = item.pending ? pendingCount : 0;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon size={16} aria-hidden="true" />
                {item.label}
                {count > 0 && (
                  <span className="sv-nav-count" title={`${count} compte${count > 1 ? "s" : ""} à valider`}>
                    {count}
                    <span className="sr-only"> en attente de validation</span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div
          className="sv-admin-profile-card"
          style={{
            padding: 12,
            borderRadius: "var(--r-md)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link to="/admin/profile" className="sv-admin-profile-link row items-center" style={{ gap: 10 }} title="Mon profil">
            <Avatar initials={getInitials(me?.first_name, me?.last_name)} name={fullName} size={34} color="#FF9333" onDark />
            <span style={{ minWidth: 0 }}>
              <span className="sv-admin-profile-name sv-truncate" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                {fullName}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {me?.role === "super_admin" ? "Super administrateur" : "Administrateur"}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="sv-admin-logout"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div style={{ background: "var(--bg)", overflow: "auto" }}>
        <Outlet />
      </div>
    </div>
  );
}
