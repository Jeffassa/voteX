import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

interface ShimmerButtonProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  background?: string;
  shimmerColor?: string;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function ShimmerButton({
  children,
  onClick,
  background = "linear-gradient(135deg, #FF7A00 0%, #E86A00 100%)",
  shimmerColor = "rgba(255, 255, 255, 0.45)",
  className,
  type = "button",
  disabled,
}: ShimmerButtonProps) {
  const styles: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    background,
    color: "white",
    border: 0,
    padding: "16px 28px",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: "0 6px 20px rgba(255, 122, 0, 0.32)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    isolation: "isolate",
    opacity: disabled ? 0.5 : 1,
    transition: "transform 160ms ease",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={styles}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(110deg, transparent 25%, ${shimmerColor} 50%, transparent 75%)`,
          backgroundSize: "200% 100%",
          animation: "sv-gradient-x 3.5s linear infinite",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 10 }}>
        {children}
      </span>
    </button>
  );
}
