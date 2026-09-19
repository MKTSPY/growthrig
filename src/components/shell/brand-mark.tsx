export function BrandMark({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, width: withWordmark ? 170 : "auto" }}>
      <span className="shine">
        <svg viewBox="0 0 32 32" width={28} height={28} role="img" aria-label="GrowthRig">
          <defs>
            <linearGradient id="gr-mark-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--emblem-a)" />
              <stop offset="1" stopColor="var(--emblem-b)" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#gr-mark-grad)" />
          {/* upward step-bars — a growth chart, not the fleet-hub emblem */}
          <g fill="#0B2622">
            <rect x="8" y="18" width="4" height="7" rx="1" />
            <rect x="14" y="13" width="4" height="12" rx="1" />
            <rect x="20" y="7" width="4" height="18" rx="1" />
          </g>
        </svg>
      </span>
      {withWordmark && (
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
          GrowthRig<span style={{ color: "var(--slate)", fontWeight: 500 }}></span>
        </div>
      )}
    </div>
  );
}
