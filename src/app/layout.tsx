import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "GrowthRig",
  description: "Turn a goal into a verified growth experiment — run by agents, governed by you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
