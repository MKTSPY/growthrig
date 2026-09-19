export interface Stat {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "caution" | "critical";
}

const TONE_COLOR: Record<NonNullable<Stat["tone"]>, string> = {
  default: "var(--ink)",
  accent: "var(--accent)",
  caution: "var(--caution)",
  critical: "var(--critical)",
};

export function StatQuadGrid({ stats }: { stats: Stat[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", background: "var(--paper)" }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: TONE_COLOR[s.tone ?? "default"] }}>{s.value}</div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
