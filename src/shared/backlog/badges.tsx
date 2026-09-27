import {
  CalendarClockIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  FlaskConicalIcon,
  FlagIcon,
  PlayIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { SPRINT_STATUS_LABELS, STATUS_LABELS, type SprintStatus, type StoryStatus } from "./types";

/** Status in a word with an icon, never colour alone (NFR11). */
function Pill({ icon: Icon, label, className }: { icon: LucideIcon; label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const STORY: Record<StoryStatus, { icon: LucideIcon; className: string }> = {
  to_do: { icon: CircleDashedIcon, className: "bg-muted text-muted-foreground" },
  in_progress: { icon: CircleDotIcon, className: "bg-primary/10 text-primary" },
  done: { icon: CircleCheckIcon, className: "bg-success-soft text-success" },
};

export function StoryStatusBadge({ status }: { status: StoryStatus }) {
  return <Pill {...STORY[status]} label={STATUS_LABELS[status]} />;
}

const SPRINT: Record<SprintStatus, { icon: LucideIcon; className: string }> = {
  planned: { icon: CalendarClockIcon, className: "bg-muted text-muted-foreground" },
  active: { icon: PlayIcon, className: "bg-primary/10 text-primary" },
  closed: { icon: FlagIcon, className: "bg-secondary text-secondary-foreground" },
};

export function SprintStatusBadge({ status }: { status: SprintStatus }) {
  return <Pill {...SPRINT[status]} label={SPRINT_STATUS_LABELS[status]} />;
}

export function SyntheticBadge() {
  return <Pill icon={FlaskConicalIcon} label="Synthetic" className="bg-warning-soft text-warning" />;
}

/** "Sep 27, 2026", or a dash. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
