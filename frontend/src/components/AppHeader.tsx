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

  const links = !me
    ? [
        { to: "/", label: "Accueil" },
        { to: "/verify", label: "Vérifier un vote" },
      ]
    : isAdmin
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
        <nav aria-label="Navigation principale">
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
          {!me && (
            <Link to="/login" className="btn btn-navy btn-sm">
              Se connecter
            </Link>
          )}
          {me && (
            <Link to="/profile" title="Mon profil" aria-label="Mon profil">
              <Avatar
                initials={getInitials(me.first_name, me.last_name)} name={`${me.first_name ?? ""} ${me.last_name ?? ""}`}
                size={34}
                color="#0A2540"
                src={me.photo_url || undefined}
              />
            </Link>
          )}
          {me && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
