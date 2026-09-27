import {
  GaugeIcon,
  IterationCwIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  ListChecksIcon,
  NetworkIcon,
  ScanSearchIcon,
  type LucideIcon,
} from "lucide-react";

import { EFFORT_PAGES } from "@/app/(modules)/effort-estimation/_nav";
import { MODULES, type ModuleSlug } from "@/shared/modules";

export interface NavPage {
  href: string;
  title: string;
  icon: LucideIcon;
}

export interface NavModule {
  slug: ModuleSlug;
  href: string;
  title: string;
  icon: LucideIcon;
  /** The module's own pages; a module without them is one page. */
  pages: NavPage[];
}

const ICONS: Record<ModuleSlug, LucideIcon> = {
  "requirement-quality": ScanSearchIcon,
  "story-refinement": ListChecksIcon,
  traceability: NetworkIcon,
  "effort-estimation": GaugeIcon,
};

/**
 * Each module lists its pages in its own folder (src/app/(modules)/<slug>/_nav.ts, owned by that module's
 * developer) and registers the list here once.
 */
const PAGES: Partial<Record<ModuleSlug, NavPage[]>> = {
  "effort-estimation": EFFORT_PAGES,
};

export const OVERVIEW: NavPage = { href: "/", title: "Overview", icon: LayoutDashboardIcon };

/** The platform's own pages: the project's backlog and its sprints, which every component works from. */
export const PLATFORM_PAGES: NavPage[] = [
  OVERVIEW,
  { href: "/backlog", title: "Backlog", icon: ListTodoIcon },
  { href: "/sprints", title: "Sprints", icon: IterationCwIcon },
];

export const NAV_MODULES: NavModule[] = MODULES.map((entry) => ({
  slug: entry.slug,
  href: `/${entry.slug}`,
  title: entry.shortName,
  icon: ICONS[entry.slug],
  pages: PAGES[entry.slug] ?? [],
}));

function within(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a link is the current page: a module's first page only when exactly on it, others for sub-paths too. */
export function isCurrent(pathname: string, href: string, exact = false): boolean {
  return exact ? pathname === href : within(pathname, href);
}

export interface Crumb {
  title: string;
  href: string;
}

/** Where a path is, from the platform down: e.g. Effort & Sprint Risk › Models, or Sprints › TUTOR-S4. */
export function breadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ title: OVERVIEW.title, href: "/" }];
  const platform = PLATFORM_PAGES.find((entry) => entry.href !== "/" && within(pathname, entry.href));
  if (platform) {
    const crumbs: Crumb[] = [{ title: platform.title, href: platform.href }];
    const rest = pathname.slice(platform.href.length + 1);
    if (rest) crumbs.push({ title: decodeURIComponent(rest.split("/")[0]), href: pathname });
    return crumbs;
  }
  const found = NAV_MODULES.find((entry) => within(pathname, entry.href));
  if (!found) return [];
  const crumbs: Crumb[] = [{ title: found.title, href: found.href }];
  const page = [...found.pages]
    .filter((entry) => entry.href !== found.href)
    .sort((a, b) => b.href.length - a.href.length)
    .find((entry) => within(pathname, entry.href));
  if (page) crumbs.push({ title: page.title, href: page.href });
  return crumbs;
}
