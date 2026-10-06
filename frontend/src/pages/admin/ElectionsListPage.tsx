import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Plus, Search, Vote } from "lucide-react";

import { ElectionStatusBadge, EmptyState, PageHeader, Segmented } from "@/components/admin/AdminUI";
import { useReveal } from "@/hooks/useReveal";
import { formatDateTime, formatPeriod } from "@/lib/dates";
import { useClasses, useElections } from "@/lib/queries";
import type { Election } from "@/types/api";

type Filter = "all" | "open" | "draft" | "done";

const FILTERS: Record<Filter, (e: Election) => boolean> = {
  all: () => true,
  open: (e) => e.status === "open",
  draft: (e) => e.status === "draft",
  done: (e) => e.status === "closed" || e.status === "published",
};

// Ce qui demande une action d'abord : scrutins en cours, puis brouillons.
const ORDER: Record<Election["status"], number> = { open: 0, draft: 1, closed: 2, published: 3 };

export default function ElectionsListPage() {
  // Écran d'administration : les blocs se posent de haut en bas, sans
  // retarder la lecture d'un tableau qu'on vient consulter.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const { data: elections, isLoading } = useElections();
  const { data: classes } = useClasses();

  const raw = params.get("statut");
  const filter: Filter = raw && raw in FILTERS ? (raw as Filter) : "all";
  const setFilter = (f: Filter) => setParams(f === "all" ? {} : { statut: f }, { replace: true });

  const classMap = new Map(classes?.map((c) => [c.id, `${c.level} ${c.name}`]) || []);
  const all = elections ?? [];
  const count = (f: Filter) => all.filter(FILTERS[f]).length;
  const q = search.trim().toLowerCase();
  const list = all
    .filter(FILTERS[filter])
    .filter((e) => !q || e.title.toLowerCase().includes(q) || (classMap.get(e.class_id) ?? "").toLowerCase().includes(q))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.starts_at.localeCompare(a.starts_at));
  const now = Date.now();
  const openCount = count("open");

  return (
    <div ref={pageRef} className="sv-admin-page">
      <PageHeader
        title="Élections"
        subtitle={
          elections
            ? `${all.length} élection${all.length > 1 ? "s" : ""}, dont ${openCount} ouverte${openCount > 1 ? "s" : ""}.`
            : undefined
        }
        actions={
          <Link to="/admin/elections/new" className="btn btn-primary">
            <Plus size={16} aria-hidden="true" /> Nouvelle élection
          </Link>
        }
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="sv-toolbar">
          <Segmented
            label="Filtrer par statut"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Toutes", count: all.length },
              { value: "open", label: "Ouvertes", count: openCount },
              { value: "draft", label: "Brouillons", count: count("draft") },
              { value: "done", label: "Terminées", count: count("done") },
            ]}
          />
          <div className="input-wrap sv-search">
            <span className="input-icon"><Search size={16} aria-hidden="true" /></span>
            <input
              type="search"
              aria-label="Rechercher une élection par titre ou par classe"
              className="input has-icon"
              placeholder="Titre ou classe…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}>
            <div className="skel" style={{ height: 52, marginBottom: 8 }} />
            <div className="skel" style={{ height: 52 }} />
          </div>
        ) : list.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              icon={<Vote size={20} />}
              title="Aucune élection"
              action={
                <Link to="/admin/elections/new" className="btn btn-primary btn-sm">
                  <Plus size={14} aria-hidden="true" /> Créer la première
                </Link>
              }
            >
              Une élection naît en brouillon : vous y ajoutez les candidats, puis vous ouvrez le scrutin.
            </EmptyState>
          ) : (
            <EmptyState icon={<Search size={20} />} title="Aucune élection ne correspond">
              Changez de filtre ou de recherche.
            </EmptyState>
          )
        ) : (
          <div className="sv-table-scroll">
            <table className="sv-table" style={{ minWidth: 760 }}>
              <caption className="sr-only">Élections</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: "42%" }}>Élection</th>
                  <th scope="col">Classe</th>
                  <th scope="col">Période</th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="actions"><span className="sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const overdue = e.status === "open" && new Date(e.ends_at).getTime() < now;
                  return (
                    // La ligne entière est cliquable ; le lien du titre la rend
                    // accessible au clavier et aux lecteurs d'écran.
                    <tr key={e.id} className="sv-row-link" onClick={() => navigate(`/admin/elections/${e.id}`)}>
                      <td style={{ maxWidth: 0 }}>
                        <Link
                          to={`/admin/elections/${e.id}`}
                          className="sv-cell-title sv-truncate"
                          style={{ display: "block" }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {e.title}
                        </Link>
                        {e.description && <div className="sv-cell-sub sv-truncate">{e.description}</div>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{classMap.get(e.class_id) || "Classe inconnue"}</td>
                      <td style={{ whiteSpace: "nowrap" }} title={`Du ${formatDateTime(e.starts_at)} au ${formatDateTime(e.ends_at)}`}>
                        {formatPeriod(e.starts_at, e.ends_at)}
                      </td>
                      <td>
                        <div className="row items-center gap-2" style={{ flexWrap: "wrap" }}>
                          <ElectionStatusBadge status={e.status} />
                          {overdue && <span className="badge badge-warn">À clôturer</span>}
                        </div>
                      </td>
                      <td className="actions" style={{ color: "var(--ink-400)" }}>
                        <ArrowRight size={16} aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
