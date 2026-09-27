import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  OctagonAlertIcon,
  PinIcon,
  SparklesIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { CONFIDENCE_LABELS, EFFORT_LABELS, interval, label, percent, points, RISK_LABELS } from "../_lib/format";
import type { ConfidenceLevel, RiskLevel, RiskReason, SelectionMode } from "../_lib/types";

const RISK_STYLES: Record<RiskLevel, { className: string; icon: typeof CircleCheckIcon }> = {
  low: { className: "bg-success-soft text-success", icon: CircleCheckIcon },
  medium: { className: "bg-warning-soft text-warning", icon: CircleAlertIcon },
  high: { className: "bg-danger-soft text-danger", icon: OctagonAlertIcon },
};

/** Risk as an icon, a word and a colour: never colour alone (NFR11). */
export function RiskBadge({
  level,
  suffix = "risk",
  className,
}: {
  level: RiskLevel | null | undefined;
  suffix?: string;
  className?: string;
}) {
  if (!level) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Unknown</span>;
  }
  const { className: style, icon: Icon } = RISK_STYLES[level];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {RISK_LABELS[level]}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** Three bars filled for high, two for medium, one for low, with the word and the score. */
export function ConfidenceIndicator({
  level,
  score,
  className,
}: {
  level: ConfidenceLevel | string | null | undefined;
  score?: number | null;
  className?: string;
}) {
  const known = level === "high" || level === "medium" || level === "low" ? level : "low";
  const filled = { high: 3, medium: 2, low: 1 }[known];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className)}>
      <span aria-hidden className="flex h-3.5 items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn("w-1 rounded-sm", bar <= filled ? "bg-primary" : "bg-muted-foreground/30")}
            style={{ height: `${bar * 33}%` }}
          />
        ))}
      </span>
      <span>{CONFIDENCE_LABELS[known]}</span>
      {score != null ? <span className="text-muted-foreground tabular-nums">({percent(score)})</span> : null}
    </span>
  );
}

/** Story points with their 80% interval and size class. */
export function EffortValue({
  value,
  range,
  category,
  coverage = 0.8,
}: {
  value: number;
  range: { lower: number; upper: number };
  category?: string;
  coverage?: number;
}) {
  return (
    <span className="inline-flex flex-col">
      <span className="font-medium tabular-nums">
        {points(value)} <span className="text-xs font-normal text-muted-foreground">points</span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">
              {interval(range)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            In {percent(coverage)} of past stories the real points fell inside this range.
          </TooltipContent>
        </Tooltip>
        {category ? ` · ${label(EFFORT_LABELS, category)}` : null}
      </span>
    </span>
  );
}

export function SelectionBadge({ mode, className }: { mode: SelectionMode; className?: string }) {
  const Icon = mode === "pinned" ? PinIcon : SparklesIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Icon aria-hidden className="size-3.5" />
      {mode === "pinned" ? "Chosen by you" : "Chosen automatically"}
    </span>
  );
}

/** The planning factors behind a prediction, strongest first (FR14). */
export function ReasonList({ reasons, limit }: { reasons: RiskReason[]; limit?: number }) {
  const shown = limit ? reasons.slice(0, limit) : reasons;
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">No main factors reported.</p>;
  return (
    <ul className="space-y-2">
      {shown.map((reason) => {
        const up = reason.direction === "increases";
        const Icon = up ? ArrowUpIcon : ArrowDownIcon;
        return (
          <li key={reason.factor} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Icon aria-hidden className={cn("size-3.5", up ? "text-danger" : "text-success")} />
                <span>{reason.factor}</span>
                <span className="sr-only">{up ? "(raises the risk)" : "(lowers the risk)"}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{percent(reason.weight)}</span>
            </div>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", up ? "bg-danger/70" : "bg-success/70")}
                style={{ width: `${Math.max(4, Math.round(reason.weight * 100))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
