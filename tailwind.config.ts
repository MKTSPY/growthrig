import type { Config } from "tailwindcss";

// GrowthRig's token *shape* deliberately mirrors the internal Nexus
// control-center's system (ink/slate/line/paper neutrals driving the
// interface, a single reserved accent, CSS variables swapped by
// [data-theme] for a second palette). Only the accent hue and the
// product's tab/content vocabulary are new — see src/styles/globals.css
// for the variable definitions themselves.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        slate: "var(--slate)",
        line: "var(--line)",
        paper: "var(--paper)",
        hover: "var(--hover)",
        pill: "var(--pill)",
        critical: "var(--critical)",
        caution: "var(--caution)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-soft": "var(--accent-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        card: "16px",
        panel: "12px",
      },
      boxShadow: {
        panel: "0 1px 1px rgba(0,0,0,0.05)",
      },
      keyframes: {
        "logo-shine": {
          "0%": { left: "-100%" },
          "20%": { left: "150%" },
          "100%": { left: "150%" },
        },
      },
      animation: {
        "logo-shine": "logo-shine 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
