interface BrandProps {
  size?: number;
  tag?: string;
}

export function SmartVoteLogo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="logo"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2.5" fill="white" opacity="0.08" />
        <rect
          x="3" y="4" width="18" height="16" rx="2.5"
          stroke="currentColor" strokeWidth="1.6"
        />
        <path
          d="M16 9 C 16 7.3, 14.5 7, 12 7 C 9.5 7, 8 7.7, 8 9.3 C 8 10.7, 9 11.4, 12 12 C 15 12.6, 16 13.3, 16 14.7 C 16 16.3, 14.5 17, 12 17 C 9.5 17, 8 16.7, 8 15"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"
        />
      </svg>
    </span>
  );
}

export function Brand({ size = 32, tag = "SmartVote" }: BrandProps) {
  return (
    <div className="brand">
      <SmartVoteLogo size={size} />
      <div className="name">
        ESATIC <span className="tag">{tag}</span>
      </div>
    </div>
  );
}
