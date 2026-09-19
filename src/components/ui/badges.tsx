export function SimBadge() {
  return <span className="badge badge-sim">Sim</span>;
}

export function StatusBadge({ status }: { status: "pass" | "fail" }) {
  return <span className={`badge ${status === "pass" ? "badge-pass" : "badge-fail"}`}>{status === "pass" ? "Pass" : "Fail"}</span>;
}

export function AccentBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge badge-accent">{children}</span>;
}

export function CitationChip({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw string if it's not a full URL
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--accent)",
        background: "var(--accent-soft)",
        borderRadius: 999,
        padding: "2px 8px",
        textDecoration: "none",
        fontWeight: 500,
      }}
    >
      {host}
    </a>
  );
}
