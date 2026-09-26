"use client";

import { CircleCheckIcon, FlaskConicalIcon, HourglassIcon, TriangleAlertIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useHistory } from "../_lib/api";
import { day, hours, number, percent, points } from "../_lib/format";
import type { HistorySummary } from "../_lib/types";
import { HistoryImport } from "./HistoryImport";

const SOURCE_NAMES: Record<string, string> = {
  platform: "Synapse",
  imported: "CSV import",
  tawos: "TAWOS replay (development data)",
  synthetic: "Synthetic (development data)",
};

const chartConfig = {
  committed: { label: "Committed", color: "var(--chart-4)" },
  completed: { label: "Completed", color: "var(--chart-1)" },
} satisfies ChartConfig;

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="space-y-0.5 rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function VelocityChart({ history }: { history: HistorySummary }) {
  const closed = [...history.sprints]
    .filter((sprint) => sprint.closed_at)
    .reverse()
    .slice(-12)
    .map((sprint) => ({
      sprint: sprint.name ?? sprint.sprint_id,
      committed: sprint.committed_points,
      completed: sprint.completed_points ?? 0,
    }));
  if (closed.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Committed and completed points</h2>
        </CardTitle>
        <CardDescription>The last {closed.length} closed sprints, oldest first. The table below has the same numbers.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" aria-hidden>
          <BarChart data={closed} margin={{ left: -12, right: 8 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="sprint" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="committed" fill="var(--color-committed)" radius={4} />
            <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function History({ project }: { project: Project }) {
  const history = useHistory(project.id);
  const data = history.data;
  const team = data?.team_context;
  const development = (data?.sources ?? []).filter((source) => source === "tawos" || source === "synthetic");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Team history"
        description="The sprints the models learn this team's pace from: velocity, spillover, reopened stories and cycle time. The platform sends each sprint as it changes; until then, import them from a CSV."
      >
        {data?.sources.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {data.sources.map((source) => (
              <Badge key={source} variant="outline" className="font-normal">
                {SOURCE_NAMES[source] ?? source}
              </Badge>
            ))}
          </div>
        ) : null}
      </PageHeader>

      {history.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : history.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The history could not be loaded</AlertTitle>
          <AlertDescription>{describeError(history.error)}</AlertDescription>
        </Alert>
      ) : !data ? null : (
        <>
          {development.length > 0 ? (
            <Alert>
              <FlaskConicalIcon aria-hidden />
              <AlertTitle>Development data</AlertTitle>
              <AlertDescription>
                This history is {development.map((source) => (source === "tawos" ? "replayed TAWOS" : "synthetic")).join(" and ")}{" "}
                data kept for development and demonstrations. It is labelled so it is never used as evidence.
              </AlertDescription>
            </Alert>
          ) : null}

          <Alert>
            {data.cold_start ? <HourglassIcon aria-hidden /> : <CircleCheckIcon aria-hidden />}
            <AlertTitle>
              {data.cold_start
                ? `Cold start: ${data.sprints_needed} more closed ${data.sprints_needed === 1 ? "sprint" : "sprints"} needed`
                : `The team's history is in use (${data.closed_sprints} closed sprints)`}
            </AlertTitle>
            <AlertDescription>
              {data.cold_start
                ? "Until then the models lean on what they learned from other teams, and confidence is lowered."
                : "Estimates for this project take the team's own pace into account."}
            </AlertDescription>
          </Alert>

          <section aria-labelledby="team-heading" className="space-y-3">
            <h2 id="team-heading" className="text-lg font-semibold">
              What the models see now
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Velocity" value={team?.velocity_mean == null ? "—" : `${points(team.velocity_mean)} pts`} hint="Mean of the last 3 sprints" />
              <Stat label="Velocity variance" value={number(team?.velocity_variance, 1)} hint="Over the last 5 sprints" />
              <Stat label="Spillover rate" value={percent(team?.spillover_rate)} hint="Stories not done in their sprint" />
              <Stat label="Reopen rate" value={percent(team?.reopen_rate)} hint="Stories reopened after done" />
              <Stat label="Cycle time" value={hours(team?.mean_cycle_time_hours)} hint="Mean time in progress" />
            </dl>
          </section>

          <VelocityChart history={data} />

          <section aria-labelledby="sprints-heading" className="space-y-3">
            <h2 id="sprints-heading" className="text-lg font-semibold">
              Sprints <span className="text-sm font-normal text-muted-foreground">({data.sprints.length}, newest first)</span>
            </h2>
            {data.sprints.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>No sprints yet</EmptyTitle>
                  <EmptyDescription>Import them below, or wait for the platform to send them.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="sprints-heading"
                className="max-h-[28rem] overflow-auto rounded-xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Sprint</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Stories</TableHead>
                      <TableHead className="text-right">Committed</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Spilled over</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sprints.map((sprint) => (
                      <TableRow key={sprint.sprint_id}>
                        <TableCell>
                          <p className="font-medium">{sprint.name ?? sprint.sprint_id}</p>
                          {sprint.name ? <p className="font-mono text-xs text-muted-foreground">{sprint.sprint_id}</p> : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {day(sprint.started_at)} – {day(sprint.planned_end)}
                        </TableCell>
                        <TableCell>
                          {sprint.closed_at ? (
                            <span className="text-sm">Closed {day(sprint.closed_at)}</span>
                          ) : (
                            <Badge variant="secondary">Running</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{sprint.stories}</TableCell>
                        <TableCell className="text-right tabular-nums">{points(sprint.committed_points)}</TableCell>
                        <TableCell className="text-right tabular-nums">{points(sprint.completed_points)}</TableCell>
                        <TableCell className="text-right tabular-nums">{sprint.spilled_over ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <HistoryImport project={project} storedSprints={data.sprints.length} />
        </>
      )}
    </div>
  );
}

export function HistoryView() {
  return <ProjectGate>{(project) => <History key={project.id} project={project} />}</ProjectGate>;
}
