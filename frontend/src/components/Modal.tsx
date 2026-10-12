import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  /** Si true, le contenu doit gérer son propre scroll (header/body/footer pattern). */
  fitViewport?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  width = 520,
  fitViewport = false,
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
        {children}
      </div>
    </div>
  );
}
