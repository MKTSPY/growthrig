import type { ReactNode } from "react";

export function ContentCard({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return <div className="content-card">{scroll ? <div className="card-scroll">{children}</div> : children}</div>;
}

export function CardSection({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="card-section">
      {children}
      {typeof count === "number" && <span className="n">· {count}</span>}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="empty-note">{children}</div>;
}
