import type { CSSProperties } from "react";

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  rounded?: boolean | number;
  style?: CSSProperties;
  className?: string;
}

export function Skeleton({
  height = 16,
  width = "100%",
  rounded = true,
  style,
  className,
}: SkeletonProps) {
  const borderRadius = rounded === true ? 8 : rounded === false ? 0 : rounded;
  return (
    <div
      className={`skel ${className || ""}`}
      style={{ height, width, borderRadius, ...style }}
    />
  );
}

export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? "65%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 200 }: { height?: number }) {
  return (
    <div
      className="card card-pad"
      style={{ height, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div className="row items-center gap-3">
        <Skeleton width={48} height={48} rounded={24} />
        <div style={{ flex: 1 }}>
          <Skeleton height={14} width="40%" style={{ marginBottom: 8 }} />
          <Skeleton height={10} width="25%" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}
