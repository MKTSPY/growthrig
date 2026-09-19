"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_ITEM, WORKSPACE_ITEMS, SYSTEM_ITEMS, type NavItem } from "./nav-config";

function isActive(pathname: string, item: NavItem) {
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`}>
      <Icon />
      <span className="label">{item.label}</span>
      {typeof item.count === "number" && <span className="count">{item.count}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div id="nav">
      {TOP_ITEM && <NavRow item={TOP_ITEM} active={isActive(pathname, TOP_ITEM)} />}

      <div className="nav-section">Workspace</div>
      {WORKSPACE_ITEMS.map((item) => (
        <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      <div className="nav-section">System</div>
      {SYSTEM_ITEMS.map((item) => (
        <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      <div id="nav-spacer" />
      <div id="nav-status">
        <div className="row">
          <span className="dot up" />
          <span>Simulated execution — no live posting</span>
        </div>
        <div className="row">
          <span className="dot up" />
          <span>2 approval gates armed</span>
        </div>
      </div>
    </div>
  );
}
