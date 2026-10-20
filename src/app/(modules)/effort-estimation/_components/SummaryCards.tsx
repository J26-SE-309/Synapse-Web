"use client";

import { TriangleAlertIcon } from "lucide-react";

import { describeError } from "@/shared/api/gateway";
import { cn } from "@/shared/lib/utils";
import type { Project } from "@/shared/projects/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

import { useSummary } from "../_lib/api";
import { percent, points, when } from "../_lib/format";
import type { RiskLevel } from "../_lib/types";
import { RiskBadge } from "./indicators";

const LEVELS: RiskLevel[] = ["high", "medium", "low"];
const BAR: Record<RiskLevel, string> = { high: "bg-danger/70", medium: "bg-warning/70", low: "bg-success/70" };

/** The project's predictions at a glance, what was decided, and how they turned out so far. */
export function SummaryCards({ project }: { project: Project }) {
  const summary = useSummary(project.id);

  if (summary.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (summary.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>The summary could not be loaded</AlertTitle>
        <AlertDescription>{describeError(summary.error)}</AlertDescription>
      </Alert>
    );
  }

  const data = summary.data;
  const reviewed = Object.values(data.feedback).reduce((total, count) => total + count, 0);
  const predictedDone = data.mean_spillover_probability == null ? null : 1 - data.mean_spillover_probability;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3>Predictions</h3>
          </CardTitle>
          <CardDescription>
            {data.predictions === 0 ? "None yet" : `${data.stories} stories, the latest ${when(data.last_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{data.predictions}</p>
          <ul className="space-y-2" aria-label="Predictions by risk level">
            {LEVELS.map((level) => {
              const count = data.by_risk_level[level] ?? 0;
              const share = data.predictions ? count / data.predictions : 0;
              return (
                <li key={level} className="flex items-center gap-2 text-sm">
                  <RiskBadge level={level} variant="subtle" className="w-28 justify-start" />
                  <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", BAR[level])} style={{ width: `${share * 100}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3>Decisions</h3>
          </CardTitle>
          <CardDescription>
            {reviewed === 0 ? "No estimate reviewed yet" : `${percent(reviewed / Math.max(data.predictions, 1))} of estimates reviewed`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(["accept", "adjust", "reject"] as const).map((decision) => (
              <div key={decision} className="flex flex-col-reverse gap-0.5 rounded-xl bg-muted/60 px-2 py-3">
                <dt className="text-xs text-muted-foreground">
                  {{ accept: "Accepted", adjust: "Adjusted", reject: "Rejected" }[decision]}
                </dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">{data.feedback[decision] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {data.pinned > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{data.pinned} made by a model you chose.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3>How they turned out</h3>
          </CardTitle>
          <CardDescription>
            {data.outcomes === 0 ? "Known once the sprints close" : `${data.outcomes} outcomes known`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.outcomes === 0 ? (
            <p className="text-sm text-muted-foreground">
              When the platform closes a sprint, each story&apos;s outcome is recorded against its prediction.
            </p>
          ) : (
            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <dt className="text-muted-foreground">Finished in their sprint</dt>
                <dd className="font-medium tabular-nums">{percent(data.completed_share)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <dt className="text-muted-foreground">The models expected</dt>
                <dd className="font-medium tabular-nums">{percent(predictedDone)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <dt className="text-muted-foreground">Average effort error</dt>
                <dd className="font-medium tabular-nums">
                  {data.effort_mae == null ? "—" : `${points(data.effort_mae)} points`}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
