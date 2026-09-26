import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export type Status = "up" | "down" | "unknown";

const STYLES: Record<Status, string> = {
  up: "bg-success-soft text-success",
  down: "bg-danger-soft text-danger",
  unknown: "bg-muted text-muted-foreground",
};

const ICONS = { up: CircleCheckIcon, down: CircleXIcon, unknown: CircleDashedIcon } as const;

// Status is always spelled out, never shown by colour alone (NFR11).
const LABELS: Record<Status, string> = {
  up: "Running",
  down: "Not reachable",
  unknown: "Checking…",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {LABELS[status]}
    </span>
  );
}
