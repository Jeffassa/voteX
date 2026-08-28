import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, GraduationCap, LayoutDashboard, LogOut, Users, Vote } from "lucide-react";

import { Avatar, getInitials } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { useLogout, useMe } from "@/lib/queries";

const NAV = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/admin/elections", label: "Élections", icon: Vote },
  { to: "/admin/students", label: "Étudiants", icon: Users },
  { to: "/admin/classes", label: "Classes", icon: GraduationCap },
  { to: "/admin/audit", label: "Journal d'audit", icon: Activity },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="sv-admin-layout" style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside
        className="sv-admin-sidebar"
        style={{
          background: "var(--navy-900)",
          color: "white",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Link to="/" style={{ paddingLeft: 4 }}>
          <div style={{ filter: "brightness(0) invert(1)", display: "inline-block" }}>
            <Brand />
          </div>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div className="h-eyebrow" style={{ color: "rgba(255,255,255,0.4)", padding: "0 12px 6px" }}>
            Administration
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  color: isActive ? "white" : "rgba(255,255,255,0.7)",
                  background: isActive ? "rgba(255,122,0,0.18)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--orange-500)" : "3px solid transparent",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "all 160ms ease",
                })}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div
          className="sv-admin-profile-card"
          style={{
            padding: 14,
            borderRadius: "var(--r-md)",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Avatar
            initials={getInitials(me?.first_name, me?.last_name)}
            size={36}
            color="#FF7A00"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {me?.first_name} {me?.last_name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              {me?.role === "super_admin" ? "Super administrateur" : "Administrateur"}
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Se déconnecter"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              border: 0,
              padding: 6,
              borderRadius: 6,
              display: "grid",
              placeItems: "center",
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main style={{ background: "var(--bg)", overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
