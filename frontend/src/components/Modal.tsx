import { useEffect, type ReactNode } from "react";

import { WaveBand } from "@/components/SecurityPattern";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  /** Si true, le contenu doit gérer son propre scroll (header/body/footer pattern). */
  fitViewport?: boolean;
  /** Bande ondulée en tête, comme l'en-tête d'un formulaire officiel. */
  band?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  width = 520,
  fitViewport = false,
  band = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: width,
          maxHeight: fitViewport ? "90vh" : undefined,
          display: fitViewport ? "flex" : undefined,
          flexDirection: fitViewport ? "column" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {band && <WaveBand height={16} />}
        {children}
      </div>
    </div>
  );
}
