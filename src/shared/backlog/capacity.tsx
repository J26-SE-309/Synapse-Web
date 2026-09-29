import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { formatPoints } from "./badges";

/** The capacity line under a sprint's name: points against capacity, with a bar. */
export function Capacity({ points, capacity }: { points: number; capacity: number | null }) {
  if (capacity === null) {
    return <span className="text-xs text-muted-foreground tabular-nums">{formatPoints(points)} points, no capacity set</span>;
  }
  const over = points > capacity;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="relative hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(100, (points / capacity) * 100)}%` }}
        />
      </span>
      <span className={cn("text-xs tabular-nums", over ? "font-medium text-warning" : "text-muted-foreground")}>
        {over ? <TriangleAlertIcon aria-hidden className="mr-0.5 inline size-3.5 align-[-2px]" /> : null}
        {formatPoints(points)} of {formatPoints(capacity)} points{over ? ", over capacity" : ""}
      </span>
    </span>
  );
}
