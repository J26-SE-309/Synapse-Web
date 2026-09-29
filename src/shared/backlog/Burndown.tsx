"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/ui/chart";

import { formatPoints } from "./badges";
import { burndown } from "./sprint-stats";
import type { Sprint, Story } from "./types";

const config = {
  remaining: { label: "Points left", color: "var(--primary)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * Points still to do each day against the straight line to zero. The chart is for sighted readers; the same
 * information is in the sentence under it (the chart itself is hidden from screen readers).
 */
export function Burndown({ sprint, stories, compact = false }: { sprint: Sprint; stories: Story[]; compact?: boolean }) {
  const data = burndown(sprint, stories);
  if (data.length === 0) return null;
  const known = data.filter((point) => point.remaining !== null);
  const today = known[known.length - 1];
  const behind = today && today.remaining !== null && today.remaining > today.ideal;

  return (
    <div className="space-y-2">
      <ChartContainer config={config} className={compact ? "aspect-auto h-16 w-full" : "aspect-auto h-56 w-full"} aria-hidden>
        <LineChart data={data} margin={compact ? { top: 4, right: 4, bottom: 0, left: 4 } : { left: -12, right: 8, top: 8 }} accessibilityLayer={false}>
          {compact ? null : <CartesianGrid vertical={false} />}
          <XAxis dataKey="label" hide={compact} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis hide={compact} width={40} tickLine={false} axisLine={false} allowDecimals={false} />
          {compact ? null : <ChartTooltip content={<ChartTooltipContent />} />}
          {compact ? null : <ChartLegend content={<ChartLegendContent />} />}
          <Line dataKey="ideal" stroke="var(--color-ideal)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line
            dataKey="remaining"
            type="stepAfter"
            stroke="var(--color-remaining)"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      {today && today.remaining !== null ? (
        <p className={compact ? "sr-only" : "text-sm text-muted-foreground"}>
          {formatPoints(today.remaining)} points left {sprint.status === "closed" ? "when it closed" : "now"}; the ideal line
          is at {formatPoints(today.ideal)} by {today.label}. {behind ? "Behind the ideal line." : "On or ahead of the ideal line."}
        </p>
      ) : null}
    </div>
  );
}
