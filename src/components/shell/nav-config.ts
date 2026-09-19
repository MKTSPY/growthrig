import type { ComponentType, SVGProps } from "react";
import { IconActivity, IconTarget, IconMegaphone } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number;
  matchPrefix?: boolean;
}

// Simplified shell — three surfaces: Threads, Analytics, Voice.
export const TOP_ITEM: NavItem | null = null;

export const WORKSPACE_ITEMS: NavItem[] = [
  { href: "/threads", label: "Threads", icon: IconTarget, matchPrefix: true },
  { href: "/analytics", label: "Analytics", icon: IconActivity, matchPrefix: true },
  { href: "/voice", label: "Voice", icon: IconMegaphone, matchPrefix: true },
];

export const SYSTEM_ITEMS: NavItem[] = [];
