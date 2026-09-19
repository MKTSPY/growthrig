import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <div className="page-title">
        {title} {accent && <em>{accent}</em>}
      </div>
      {children}
    </div>
  );
}

export function FilterChips({
  items,
  active,
  onSelect,
}: {
  items: { key: string; label: string }[];
  active: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div className="filters-row">
      <span className="filters-label">Filter</span>
      {items.map((item) => (
        <button
          key={item.key}
          className={`sfchip${active === item.key ? " on" : ""}`}
          onClick={() => onSelect?.(item.key)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
