"use client";

import { ArrowRightIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";

import { useSprints, useStories } from "./api";
import { formatDate, formatPoints, SprintStatusBadge } from "./badges";
import { SprintFormDialog } from "./SprintFormDialog";
import { storiesIn, totalPoints, type Sprint, type SprintStatus, type Story } from "./types";

const GROUPS: { status: SprintStatus; title: string }[] = [
  { status: "active", title: "Active" },
  { status: "planned", title: "Planned" },
  { status: "closed", title: "Closed" },
];

function dates(sprint: Sprint): string {
  if (sprint.status === "planned") return `${sprint.length_days} days, not started`;
  if (sprint.status === "active") return `${formatDate(sprint.started_at)} – ${formatDate(sprint.planned_end)}`;
  return `${formatDate(sprint.started_at)} – closed ${formatDate(sprint.closed_at)}`;
}

function SprintRow({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const inSprint = storiesIn(sprint, stories);
  const points = totalPoints(inSprint);
  const done = sprint.status === "closed"
    ? sprint.items.filter((item) => item.done_in_sprint).length
    : inSprint.filter((story) => story.status === "done").length;
  return (
    <li>
      <Link
        href={`/sprints/${encodeURIComponent(sprint.sprint_id)}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-4 no-underline hover:bg-muted/50"
      >
        <span className="min-w-48 flex-1">
          <span className="flex items-center gap-2 font-medium text-foreground">
            {sprint.name} <SprintStatusBadge status={sprint.status} />
          </span>
          <span className="block font-mono text-xs text-muted-foreground">{sprint.sprint_id}</span>
          {sprint.goal ? <span className="mt-1 block text-sm text-muted-foreground">{sprint.goal}</span> : null}
        </span>
        <span className="text-sm text-muted-foreground">{dates(sprint)}</span>
        <span className="text-sm tabular-nums text-foreground">
          {inSprint.length} {inSprint.length === 1 ? "story" : "stories"}, {formatPoints(points)}
          {sprint.capacity_points ? ` of ${formatPoints(sprint.capacity_points)}` : ""} points
          {sprint.status !== "planned" ? `, ${done} done` : ""}
        </span>
        <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Sprints({ project }: { project: Project }) {
  const sprints = useSprints(project.id);
  const stories = useStories(project.id);
  const [creating, setCreating] = useState(false);
  const all = sprints.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sprints"
        description="Plan a sprint, fill it from the backlog, check the effort and risk estimates, then start it. Closing it records how each story ended."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden /> Plan a sprint
          </Button>
        }
      />

      {sprints.isPending || stories.isPending ? (
        <Skeleton className="h-48 w-full" />
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
            <EmptyDescription>Plan the first sprint, then add stories to it from the backlog.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden /> Plan a sprint
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        GROUPS.map(({ status, title }) => {
          const group = all.filter((sprint) => sprint.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status} aria-labelledby={`sprints-${status}`} className="space-y-3">
              <h2 id={`sprints-${status}`} className="text-lg font-semibold">
                {title}
              </h2>
              <ul className="space-y-2">
                {group.map((sprint) => (
                  <SprintRow key={sprint.sprint_id} sprint={sprint} stories={stories.data ?? []} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <SprintFormDialog projectId={project.id} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export function SprintsView() {
  return <ProjectGate>{(project) => <Sprints key={project.id} project={project} />}</ProjectGate>;
}
