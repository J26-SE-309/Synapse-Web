import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { formatPoints } from "./badges";

/** The capacity line under a sprint's name: points against capacity, with a bar. */
export function Capacity({ points, capacity, size = "sm" }: { points: number; capacity: number | null; size?: "sm" | "lg" }) {
  if (capacity === null) {
    return <span className="text-xs text-muted-foreground tabular-nums">{formatPoints(points)} points, no capacity set</span>;
  }
  const over = points > capacity;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("relative hidden overflow-hidden rounded-full bg-muted sm:block", size === "lg" ? "h-2 w-36" : "h-1.5 w-24")}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            over ? "bg-warning" : "bg-gradient-to-r from-primary to-chart-3",
          )}
          style={{ width: `${Math.min(100, (points / capacity) * 100)}%` }}
        />
      </span>
      <span className={cn("tabular-nums", size === "lg" ? "text-sm" : "text-xs", over ? "font-medium text-warning" : "text-muted-foreground")}>
        {over ? <TriangleAlertIcon aria-hidden className="mr-0.5 inline size-3.5 align-[-2px]" /> : null}
        {formatPoints(points)} of {formatPoints(capacity)} points{over ? ", over capacity" : ""}
      </span>
    </span>
  );
}
