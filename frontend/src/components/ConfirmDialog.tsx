/**
 * Boîte de confirmation du site, à la place de window.confirm().
 *
 * La fenêtre native affichait « localhost:5173 indique », ne se mettait pas
 * en forme et ne disait pas clairement ce qui allait se passer. Celle-ci
 * nomme l'action, l'élément visé et les conséquences, et met en garde quand
 * l'action est sans retour.
 *
 * Utilisation, depuis n'importe quel gestionnaire :
 *
 *   if (!(await askConfirm({ title: "Supprimer la classe", subject: "L3 GL",
 *     message: "…", confirmLabel: "Supprimer", tone: "danger" }))) return;
 *
 * <ConfirmHost /> est monté une fois, dans main.tsx.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { create } from "zustand";

import { WaveBand } from "@/components/SecurityPattern";

export interface ConfirmOptions {
  /** L'action, à l'infinitif : « Clôturer le scrutin ». */
  title: string;
  /** L'élément concerné, rappelé pour éviter la confusion de ligne. */
  subject?: string;
  /** Ce qui va se passer. */
  message: ReactNode;
  /** Libellé du bouton de validation : reprend le verbe de l'action. */
  confirmLabel: string;
  cancelLabel?: string;
  /** « danger » pour ce qui supprime ou refuse ; bouton rouge. */
  tone?: "default" | "danger";
  /** Action sans retour : signalée, et le focus part sur « Annuler ». */
  irreversible?: boolean;
  /** Petite mention au-dessus du titre ; par défaut, selon le ton. */
  eyebrow?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const useConfirmStore = create<{ current: Pending | null }>(() => ({ current: null }));

/** Ouvre la boîte et rend la réponse : true si l'action est confirmée. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Une seule boîte à la fois : une demande plus récente annule l'ancienne.
    useConfirmStore.getState().current?.resolve(false);
    useConfirmStore.setState({ current: { ...options, resolve } });
  });
}

function settle(ok: boolean) {
  const current = useConfirmStore.getState().current;
  if (!current) return;
  useConfirmStore.setState({ current: null });
  current.resolve(ok);
}

export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current);
  return current ? <ConfirmDialog key={current.title + (current.subject ?? "")} {...current} /> : null;
}

function ConfirmDialog({
  title, subject, message, confirmLabel, cancelLabel = "Annuler", tone = "default", irreversible, eyebrow,
}: ConfirmOptions) {
  const titleId = useId();
  const messageId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = tone === "danger";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Devant une action sans retour, Entrée ne doit pas suffire à la lancer.
    (danger || irreversible ? cancelRef : confirmRef).current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(false);
        return;
      }
      if (e.key !== "Tab") return;
      // Le focus reste dans la boîte tant qu'elle est ouverte.
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button") ?? []);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [danger, irreversible]);

  return (
    <div className="backdrop sv-dialog-backdrop" onClick={() => settle(false)}>
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className={`modal sv-dialog${danger ? " is-danger" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {danger ? <div className="sv-dialog-tape" aria-hidden="true" /> : <WaveBand height={16} />}

        <div className="sv-dialog-body">
          <div className="row items-center gap-3">
            <span className="sv-dialog-icon" aria-hidden="true">
              {danger ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            </span>
            <span className="sv-ref">{eyebrow ?? (danger ? "Attention" : "Confirmation")}</span>
            {irreversible && <span className="badge badge-danger" style={{ marginLeft: "auto" }}>Sans retour</span>}
          </div>

          <h2 id={titleId} className="sv-dialog-title">{title}</h2>
          {subject && <p className="sv-dialog-subject">{subject}</p>}
          <div id={messageId} className="sv-dialog-message">{message}</div>
        </div>

        <div className="sv-dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-outline" onClick={() => settle(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => settle(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
