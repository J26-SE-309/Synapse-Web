import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

const TONES = {
  primary: "bg-primary/12 text-primary",
  sky: "bg-chart-2/15 text-chart-2",
  violet: "bg-chart-3/15 text-chart-3",
  pink: "bg-chart-5/15 text-chart-5",
} as const;

/** One number worth knowing, with what it is, a line of detail, and room for a bar or a link under it. */
export function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "primary",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: keyof typeof TONES;
  children?: ReactNode;
}) {
  const tile = TONES[tone];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-(--shadow-soft)">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tile)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      {children}
    </div>
  );
}
