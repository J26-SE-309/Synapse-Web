import {
  BookmarkIcon,
  BugIcon,
  ChevronDownIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  ChevronUpIcon,
  CircleSlashIcon,
  SparklesIcon,
  SquareCheckIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type { IssueType, Priority } from "./types";

/**
 * Story types and priorities as icons, the way people know them from Jira. The icon is never the only cue: each
 * carries its name for screen readers and as a tooltip, and the chart colours used here carry no status meaning
 * (green, amber and red are kept for status and risk).
 */
const TYPES: Record<IssueType, { icon: LucideIcon; className: string }> = {
  Story: { icon: BookmarkIcon, className: "bg-chart-1/15 text-chart-1" },
  Task: { icon: SquareCheckIcon, className: "bg-chart-2/15 text-chart-2" },
  Bug: { icon: BugIcon, className: "bg-chart-5/15 text-chart-5" },
  Improvement: { icon: TrendingUpIcon, className: "bg-chart-3/15 text-chart-3" },
  "New Feature": { icon: SparklesIcon, className: "bg-chart-4/20 text-foreground" },
};

export function IssueTypeIcon({ type, className }: { type: IssueType | null; className?: string }) {
  const entry = type ? TYPES[type] : null;
  const Icon = entry?.icon ?? CircleSlashIcon;
  const label = type ?? "No type";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded",
        entry?.className ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

const PRIORITIES: Record<Priority, { icon: LucideIcon; className: string }> = {
  Blocker: { icon: ChevronsUpIcon, className: "text-chart-5" },
  Critical: { icon: ChevronsUpIcon, className: "text-chart-5" },
  Major: { icon: ChevronUpIcon, className: "text-chart-1" },
  Minor: { icon: ChevronDownIcon, className: "text-chart-2" },
  Trivial: { icon: ChevronsDownIcon, className: "text-muted-foreground" },
};

/** `decorative` when the priority is also written next to it (so it is not read twice). */
export function PriorityIcon({
  priority,
  decorative = false,
  className,
}: {
  priority: Priority | null;
  decorative?: boolean;
  className?: string;
}) {
  if (!priority) return decorative ? null : <span className="sr-only">No priority</span>;
  const { icon: Icon, className: colour } = PRIORITIES[priority];
  return (
    <span title={decorative ? undefined : `${priority} priority`} className={cn("inline-flex shrink-0", colour, className)}>
      <Icon aria-hidden className="size-4" strokeWidth={2.5} />
      {decorative ? null : <span className="sr-only">{priority} priority</span>}
    </span>
  );
}

const EPIC_COLOURS = [
  "bg-chart-1/15 text-foreground ring-chart-1/30",
  "bg-chart-2/15 text-foreground ring-chart-2/30",
  "bg-chart-3/15 text-foreground ring-chart-3/30",
  "bg-chart-4/20 text-foreground ring-chart-4/40",
  "bg-chart-5/15 text-foreground ring-chart-5/30",
];

/** An epic's name on a colour of its own (the same epic always gets the same one). */
export function EpicChip({ epic, className }: { epic: string; className?: string }) {
  let hash = 0;
  for (const character of epic) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (
    <span
      title={`Epic: ${epic}`}
      className={cn(
        "inline-flex max-w-40 shrink-0 items-center truncate rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        EPIC_COLOURS[hash % EPIC_COLOURS.length],
        className,
      )}
    >
      <span className="sr-only">Epic: </span>
      {epic}
    </span>
  );
}

/** Story points as a small grey pill; a dash when the team has not estimated it. */
export function PointsPill({ points, className }: { points: number | null; className?: string }) {
  return (
    <span
      title={points === null ? "Not estimated" : `${points} story points`}
      className={cn(
        "inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums",
        points === null && "text-muted-foreground",
        className,
      )}
    >
      {points ?? "–"}
      <span className="sr-only">{points === null ? " (not estimated)" : " points"}</span>
    </span>
  );
}
