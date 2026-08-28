import { useId } from "react";

interface DotPatternProps {
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
  fill?: string;
}

export function DotPattern({
  width = 18,
  height = 18,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  fill = "rgba(10, 37, 64, 0.08)",
}: DotPatternProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x="0"
          y="0"
        >
          <circle cx={cx} cy={cy} r={cr} fill={fill} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
