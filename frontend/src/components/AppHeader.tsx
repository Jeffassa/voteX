import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Avatar, getInitials } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { useLogout, useMe } from "@/lib/queries";

export function AppHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const logout = useLogout();
  const { data: me } = useMe();

  // Le rôle vient EXCLUSIVEMENT de la réponse serveur — pas du localStorage
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  const links = isAdmin
    ? [
        { to: "/admin", label: "Tableau de bord" },
        { to: "/verify", label: "Vérifier un vote" },
      ]
    : [
        { to: "/", label: "Tableau de bord" },
        { to: "/verify", label: "Vérifier un vote" },
      ];

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/"><Brand /></Link>
        <nav>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={pathname === l.to ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="row items-center gap-3">
          {me && (
            <Link to="/profile" title="Mon profil">
              <Avatar
                initials={getInitials(me.first_name, me.last_name)}
                size={34}
                color="#0A2540"
                src={me.photo_url || undefined}
              />
            </Link>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Se déconnecter"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
