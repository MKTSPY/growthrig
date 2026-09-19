"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Appbar } from "./appbar";
import { Sidebar } from "./sidebar";
import { IconPanelLeft } from "@/components/icons";

const THEME_KEY = "growthrig-theme";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<"signal" | "ember">("signal");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "ember" || saved === "signal") setTheme(saved);
    } catch {
      // best-effort only — a private window or blocked storage just keeps the default theme
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "ember" ? "ember" : "");
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore — theme just won't persist across reloads
    }
  }, [theme]);

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      className={`shell-root${navOpen ? " nav-open" : ""}${collapsed ? " nav-collapsed" : ""}`}
    >
      <Appbar onMobileMenu={() => setNavOpen((v) => !v)} />
      <div id="shell">
        <div id="nav-backdrop" onClick={() => setNavOpen(false)} />
        <Sidebar />
        <div id="main">
          <div id="app-glow" aria-hidden="true">
            <div className="glow-a" />
            <div className="glow-b" />
          </div>
          <div id="topbar">
            <button
              onClick={() => setCollapsed((v) => !v)}
              title="Collapse sidebar"
              aria-label="Toggle sidebar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                border: "none",
                background: "none",
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--slate)",
                flexShrink: 0,
              }}
            >
              <IconPanelLeft width={18} height={18} />
            </button>
            <div style={{ flex: 1 }} />
            <div className="scope-seg" style={{ display: "inline-flex", background: "var(--pill)", borderRadius: 8, padding: 2 }}>
              {(["signal", "ember"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`scope-opt${theme === t ? " on" : ""}`}
                  style={{
                    border: theme === t ? "1px solid var(--line)" : "1px solid transparent",
                    background: theme === t ? "#fff" : "transparent",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: theme === t ? "var(--ink)" : "var(--slate)",
                    cursor: "pointer",
                  }}
                >
                  {t === "signal" ? "Signal" : "Ember"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
