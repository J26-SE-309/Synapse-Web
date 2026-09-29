"use client";

import { ArrowRightIcon, CalendarPlusIcon, ListTodoIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/ui/chart";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Progress } from "@/shared/ui/progress";
import { Skeleton } from "@/shared/ui/skeleton";

import { useSprints, useStories } from "./api";
import { formatDate, formatPoints, SprintStatusBadge } from "./badges";
import { Burndown } from "./Burndown";
import { Capacity } from "./capacity";
import { daysLeft } from "./planning";
import { SprintFormDialog } from "./SprintFormDialog";
import { sprintStats } from "./sprint-stats";
import { storiesIn, type Sprint, type Story } from "./types";

const href = (sprint: Sprint) => `/sprints/${encodeURIComponent(sprint.sprint_id)}`;

/** A card whose name is the link; the link's area covers the whole card. */
function SprintTitle({ sprint }: { sprint: Sprint }) {
  return (
    <CardTitle className="flex flex-wrap items-center gap-2">
      <Link href={href(sprint)} className="text-foreground no-underline after:absolute after:inset-0 after:content-[''] hover:underline">
        {sprint.name}
      </Link>
      <SprintStatusBadge status={sprint.status} />
    </CardTitle>
  );
}

function ActiveSprint({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const stats = sprintStats(sprint, stories);
  const left = daysLeft(sprint);
  return (
    <Card className="relative border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <SprintTitle sprint={sprint} />
        <CardDescription>
          {formatDate(sprint.started_at)} – {formatDate(sprint.planned_end)} ·{" "}
          {left === 0 ? "last day" : `${left} ${left === 1 ? "day" : "days"} left`}
          {sprint.goal ? <span className="mt-1 block text-foreground">{sprint.goal}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Points done</span>
              <span className="tabular-nums text-muted-foreground">
                {formatPoints(stats.done)} of {formatPoints(stats.committed)}
              </span>
            </div>
            <Progress value={stats.committed ? (stats.done / stats.committed) * 100 : 0} aria-label="Points done" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Time used</span>
              <span className="tabular-nums text-muted-foreground">
                Day {Math.min(stats.elapsedDays + 1, stats.lengthDays)} of {stats.lengthDays}
              </span>
            </div>
            <Progress value={(stats.elapsedDays / stats.lengthDays) * 100} aria-label="Time used" />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["To do", stats.counts.to_do],
                ["In progress", stats.counts.in_progress],
                ["Done", stats.counts.done],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse rounded-lg bg-muted/60 p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <Capacity points={stats.committed} capacity={sprint.capacity_points} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Burndown</p>
          <Burndown sprint={sprint} stories={stories} compact />
          <Button asChild size="sm" className="relative z-10 w-full">
            <Link href={href(sprint)}>
              Open the board <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlannedSprint({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const stats = sprintStats(sprint, stories);
  return (
    <Card size="sm" className="relative transition-shadow hover:shadow-md">
      <CardHeader>
        <SprintTitle sprint={sprint} />
        <CardDescription className="line-clamp-2">{sprint.goal || `${sprint.length_days} days once started`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          {stories.length} {stories.length === 1 ? "story" : "stories"} · {sprint.length_days} days
        </p>
        <Capacity points={stats.committed} capacity={sprint.capacity_points} />
      </CardContent>
    </Card>
  );
}

function ClosedSprint({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const stats = sprintStats(sprint, stories);
  const share = stats.committed ? Math.round((stats.done / stats.committed) * 100) : 0;
  return (
    <Card size="sm" className="relative transition-shadow hover:shadow-md">
      <CardHeader>
        <SprintTitle sprint={sprint} />
        <CardDescription>
          {formatDate(sprint.started_at)} – {formatDate(sprint.closed_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Completed</span>
          <span className="tabular-nums text-muted-foreground">
            {formatPoints(stats.done)} of {formatPoints(stats.committed)} points ({share}%)
          </span>
        </div>
        <Progress value={share} aria-label={`${sprint.name}: points completed`} />
        <p className="text-muted-foreground">
          {stats.counts.done} done, {stories.length - stats.counts.done} spilled over
        </p>
      </CardContent>
    </Card>
  );
}

const velocityConfig = {
  committed: { label: "Committed", color: "var(--chart-4)" },
  completed: { label: "Completed", color: "var(--primary)" },
} satisfies ChartConfig;

/** Committed against completed points for the last closed sprints (the numbers are on the cards too). */
function Velocity({ closed, stories }: { closed: Sprint[]; stories: Story[] }) {
  const data = [...closed]
    .reverse()
    .slice(-8)
    .map((sprint) => {
      const stats = sprintStats(sprint, storiesIn(sprint, stories));
      return { sprint: sprint.name, committed: stats.committed, completed: stats.done };
    });
  if (data.length < 2) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Velocity</h3>
        </CardTitle>
        <CardDescription>Points committed and completed in each closed sprint, oldest first.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={velocityConfig} className="aspect-auto h-48 w-full" aria-hidden>
          <BarChart data={data} margin={{ left: -12, right: 8 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="sprint" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
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

function Sprints({ project }: { project: Project }) {
  const sprints = useSprints(project.id);
  const stories = useStories(project.id);
  const [creating, setCreating] = useState(false);
  const all = sprints.data ?? [];
  const list = stories.data ?? [];
  const active = all.find((sprint) => sprint.status === "active");
  const planned = all.filter((sprint) => sprint.status === "planned").reverse();
  const closed = all.filter((sprint) => sprint.status === "closed");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Sprints"
        description="The sprint in progress, the ones planned next, and how the finished ones went."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/backlog">
                <ListTodoIcon aria-hidden /> Backlog
              </Link>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <CalendarPlusIcon aria-hidden /> Plan a sprint
            </Button>
          </>
        }
      />

      {sprints.isPending || stories.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : sprints.isError || stories.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The sprints could not be loaded</AlertTitle>
          <AlertDescription>{describeError(sprints.error ?? stories.error)}</AlertDescription>
        </Alert>
      ) : all.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No sprints yet</EmptyTitle>
            <EmptyDescription>Plan the first sprint, then fill it from the backlog.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <CalendarPlusIcon aria-hidden /> Plan a sprint
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <section aria-labelledby="sprints-active" className="space-y-3">
            <h2 id="sprints-active" className="text-lg font-semibold">
              In progress
            </h2>
            {active ? (
              <ActiveSprint sprint={active} stories={storiesIn(active, list)} />
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No sprint is running. Start a planned one from its page.
              </p>
            )}
          </section>

          <section aria-labelledby="sprints-planned" className="space-y-3">
            <h2 id="sprints-planned" className="text-lg font-semibold">
              Planned
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {planned.map((sprint) => (
                <PlannedSprint key={sprint.sprint_id} sprint={sprint} stories={storiesIn(sprint, list)} />
              ))}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
              >
                <CalendarPlusIcon aria-hidden className="size-5" /> Plan a sprint
              </button>
            </div>
          </section>

          {closed.length > 0 ? (
            <section aria-labelledby="sprints-closed" className="space-y-3">
              <h2 id="sprints-closed" className="text-lg font-semibold">
                Closed
              </h2>
              <Velocity closed={closed} stories={list} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {closed.map((sprint) => (
                  <ClosedSprint key={sprint.sprint_id} sprint={sprint} stories={storiesIn(sprint, list)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <SprintFormDialog projectId={project.id} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export function SprintsView() {
  return <ProjectGate>{(project) => <Sprints key={project.id} project={project} />}</ProjectGate>;
}
