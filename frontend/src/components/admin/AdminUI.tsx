/**
 * Briques communes des écrans d'administration : en-tête de page, état vide,
 * filtres, badge de statut, menu d'actions. Les styles sont dans index.css
 * (section « Administration »).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import type { ElectionStatus } from "@/types/api";

export function PageHeader({
  title, subtitle, actions, back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header>
      {back && (
        <Link to={back.to} className="btn btn-ghost btn-sm sv-back">
          <ArrowLeft size={14} aria-hidden="true" /> {back.label}
        </Link>
      )}
      <div className="sv-page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="h-title">{title}</h1>
          {subtitle && <p className="sv-page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="sv-page-actions">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon, title, children, action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sv-empty">
      <span className="sv-empty-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Compteur mis en avant (éléments qui attendent une action). */
  alert?: boolean;
}

/** Filtres exclusifs, présentés en boutons à bascule. */
export function Segmented<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
}) {
  return (
    <div role="group" aria-label={label} className="sv-segmented">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && (o.count > 0 || !o.alert) && (
            <span className={`sv-seg-count${o.alert && o.count > 0 ? " alert" : ""}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export const ELECTION_STATUS: Record<ElectionStatus, { label: string; badge: string }> = {
  draft: { label: "Brouillon", badge: "badge-draft" },
  open: { label: "Ouverte", badge: "badge-open" },
  closed: { label: "Clôturée", badge: "badge-closed" },
  published: { label: "Publiée", badge: "badge-navy" },
};

export function ElectionStatusBadge({ status }: { status: ElectionStatus }) {
  const meta = ELECTION_STATUS[status];
  return (
    <span className={`badge ${meta.badge}`}>
      {status === "open" && <span className="dot" aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

/**
 * Menu d'actions d'une ligne. Rendu dans <body> en position fixe : dans une
 * carte à défilement horizontal, le menu des dernières lignes était rogné.
 */
export function RowMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = false) => {
    setPos(null);
    if (refocus) button.current?.focus();
  }, []);

  function open() {
    const r = button.current!.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    // Ouvert vers le haut quand la place manque sous le bouton.
    setPos(window.innerHeight - r.bottom < 260 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  }

  useEffect(() => {
    if (!pos) return;
    const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close(true);
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    };
    const onMove = () => close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [pos, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => (pos ? close() : open())}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {pos &&
        createPortal(
          <div ref={menu} role="menu" aria-label={label} className="sv-menu" style={pos}>
            {children(() => close(true))}
          </div>,
          document.body
        )}
    </>
  );
}

export function MenuItem({
  icon, children, onSelect, danger,
}: {
  icon: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" role="menuitem" className={`sv-menu-item${danger ? " danger" : ""}`} onClick={onSelect}>
      <span aria-hidden="true" style={{ display: "inline-flex" }}>{icon}</span>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="sv-menu-sep" />;
}

/** Valeur différée : la recherche ne part qu'une fois la frappe arrêtée. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
