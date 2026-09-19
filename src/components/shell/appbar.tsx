"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell, IconSearch, IconMenu } from "@/components/icons";
import { WORKSPACE_ITEMS, SYSTEM_ITEMS, TOP_ITEM } from "./nav-config";
import { BrandMark } from "./brand-mark";

const ALL_DESTINATIONS = [TOP_ITEM, ...WORKSPACE_ITEMS, ...SYSTEM_ITEMS].filter(
  (d): d is NonNullable<typeof d> => d !== null,
);

export function Appbar({ onMobileMenu }: { onMobileMenu?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return ALL_DESTINATIONS.slice(0, 6);
    const q = query.toLowerCase();
    return ALL_DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "e")) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div id="appbar">
      <BrandMark />

      <div id="topbar-eb" style={{ position: "relative" }}>
        <IconSearch width={16} height={16} style={{ flexShrink: 0, color: "var(--slate)" }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Start a new experiment, search a run, or jump anywhere…"
          aria-label="Jump to a screen or start a new experiment"
          autoComplete="off"
        />
        <span className="kbd">⌘K</span>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(18,36,28,0.14)",
              overflow: "hidden",
              zIndex: 300,
            }}
          >
            {results.length === 0 && <div className="empty-note">No matches for &ldquo;{query}&rdquo;.</div>}
            {results.map((r) => (
              <button
                key={r.href}
                onMouseDown={(e) => {
                  e.preventDefault();
                  router.push(r.href);
                  setOpen(false);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "var(--ink)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                className="cmdk-row"
              >
                <r.icon width={16} height={16} style={{ color: "var(--slate)", flexShrink: 0 }} />
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button
        className="ab-icon-btn"
        aria-label="Notifications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          border: "none",
          background: "none",
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--slate)",
        }}
      >
        <IconBell width={18} height={18} />
      </button>
      <button
        onClick={onMobileMenu}
        aria-label="Menu"
        className="ab-icon-btn"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          border: "none",
          background: "none",
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--ink)",
        }}
        id="mobile-menu-btn"
      >
        <IconMenu width={18} height={18} />
      </button>
    </div>
  );
}
