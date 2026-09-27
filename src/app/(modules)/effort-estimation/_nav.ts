import {
  FlaskConicalIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
} from "lucide-react";

import type { NavPage } from "@/shared/navigation";

/** This module's pages, as the sidebar and breadcrumbs show them. Owned by @Nikeshala22. */
export const EFFORT_PAGES: NavPage[] = [
  { href: "/effort-estimation", title: "Overview", icon: LayoutDashboardIcon },
  { href: "/effort-estimation/models", title: "Models", icon: FlaskConicalIcon },
  { href: "/effort-estimation/history", title: "Team history", icon: HistoryIcon },
  { href: "/effort-estimation/predictions", title: "Prediction log", icon: ScrollTextIcon },
];
