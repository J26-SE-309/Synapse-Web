"use client";

import { CircleCheckIcon, PencilIcon, PlayIcon, PlusIcon, SendIcon, SquareIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { SPRINT_PANELS } from "@/shared/module-slots";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Progress } from "@/shared/ui/progress";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";

import { AddStoriesDialog } from "./AddStoriesDialog";
import { useDeleteSprint, useSprintAction, useSprints, useStories } from "./api";
import { formatDate, formatDateTime, formatPoints, SprintStatusBadge } from "./badges";
import { SprintFormDialog } from "./SprintFormDialog";
import { StoryFormDialog } from "./StoryFormDialog";
import { StoryTable } from "./StoryTable";
import { storiesIn, totalPoints, type Sprint, type Story } from "./types";

type Confirm = "start" | "close" | "delete" | null;

function Summary({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const points = totalPoints(stories);
  const donePoints = totalPoints(
    stories.filter((story) =>
      sprint.status === "closed"
        ? sprint.items.find((item) => item.story_id === story.story_id)?.done_in_sprint
        : story.status === "done",
    ),
  );
  const capacity = sprint.capacity_points;
  const over = capacity !== null && points > capacity;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card size="sm">
        <CardHeader>
          <CardDescription>Committed</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatPoints(points)} <span className="text-base font-normal text-muted-foreground">points</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
          {stories.some((story) => story.story_points === null) ? ", some without an estimate" : ""}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardDescription>Capacity</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {capacity === null ? "–" : formatPoints(capacity)}{" "}
            {capacity !== null ? <span className="text-base font-normal text-muted-foreground">points</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {capacity === null ? (
            <span className="text-muted-foreground">Not set: the effort estimate uses the team&apos;s velocity.</span>
          ) : over ? (
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <TriangleAlertIcon aria-hidden className="size-4" /> {formatPoints(points - capacity)} points over capacity
            </span>
          ) : (
            <span className="text-muted-foreground">{formatPoints(capacity - points)} points to spare</span>
          )}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardDescription>Done</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {formatPoints(donePoints)} <span className="text-base font-normal text-muted-foreground">of {formatPoints(points)} points</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={points > 0 ? (donePoints / points) * 100 : 0} aria-label="Points done" />
        </CardContent>
      </Card>
    </div>
  );
}

function EffortSyncNote({ project, sprint }: { project: Project; sprint: Sprint }) {
  const action = useSprintAction(project.id, sprint.sprint_id);
  if (sprint.status === "planned") return null;
  if (sprint.effort_sync.status === "failed") {
    return (
      <Alert>
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>The effort service doesn&apos;t have the latest sprint</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {sprint.effort_sync.error}. The sprint is saved here; the effort service records outcomes and the team&apos;s
            history once it receives it.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={action.isPending}
            onClick={async () => {
              try {
                const result = await action.mutateAsync("sync");
                if (result.effort_sync.status === "sent") toast.success("Sent to Effort & Sprint Risk");
                else toast.error("Still not sent", { description: result.effort_sync.error ?? undefined });
              } catch (error) {
                toast.error("Not sent", { description: describeError(error) });
              }
            }}
          >
            {action.isPending ? <Spinner aria-hidden /> : <SendIcon aria-hidden />} Send again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (sprint.effort_sync.status === "sent") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CircleCheckIcon aria-hidden className="size-4 text-success" />
        Effort &amp; Sprint Risk has this sprint (sent {formatDateTime(sprint.effort_sync.sent_at)}).
      </p>
    );
  }
  return null;
}

function SprintPage({ project, sprintId }: { project: Project; sprintId: string }) {
  const sprints = useSprints(project.id);
  const stories = useStories(project.id);
  const action = useSprintAction(project.id, sprintId);
  const remove = useDeleteSprint(project.id);
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  if (sprints.isPending || stories.isPending) return <Skeleton className="mx-auto h-96 max-w-6xl" />;
  if (sprints.isError || stories.isError) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-6xl">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>The sprint could not be loaded</AlertTitle>
        <AlertDescription>{describeError(sprints.error ?? stories.error)}</AlertDescription>
      </Alert>
    );
  }
  const sprint = sprints.data.find((entry) => entry.sprint_id === sprintId);
  if (!sprint) {
    return (
      <Empty className="mx-auto max-w-6xl border">
        <EmptyHeader>
          <EmptyTitle>No sprint {sprintId} in {project.name}</EmptyTitle>
          <EmptyDescription>
            It may belong to another project. <Link href="/sprints">See this project&apos;s sprints</Link>.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const inSprint = storiesIn(sprint, stories.data);
  const backlog = stories.data.filter((story) => story.sprint_id === null && story.status !== "done");
  const unfinished = inSprint.filter((story) => story.status !== "done").length;
  const running = sprints.data.find((entry) => entry.status === "active" && entry.sprint_id !== sprint.sprint_id);

  async function run(what: "start" | "close") {
    try {
      await action.mutateAsync(what);
      toast.success(what === "start" ? `${sprint!.name} started` : `${sprint!.name} closed`, {
        description:
          what === "close" && unfinished > 0
            ? `${unfinished} unfinished ${unfinished === 1 ? "story is" : "stories are"} back in the backlog`
            : undefined,
      });
    } catch (error) {
      toast.error(`${sprint!.name} was not ${what === "start" ? "started" : "closed"}`, {
        description: error instanceof GatewayError ? error.message : describeError(error),
      });
    }
    setConfirm(null);
  }

  async function deleteSprint() {
    try {
      await remove.mutateAsync(sprint!.sprint_id);
      toast.success(`Deleted ${sprint!.name}`, { description: "Its stories are back in the backlog" });
      router.push("/sprints");
    } catch (error) {
      toast.error(`${sprint!.name} was not deleted`, { description: describeError(error) });
    }
    setConfirm(null);
  }

  const dates =
    sprint.status === "planned"
      ? `${sprint.length_days} days once started`
      : `${formatDate(sprint.started_at)} – ${sprint.status === "closed" ? `closed ${formatDate(sprint.closed_at)}` : `ends ${formatDate(sprint.planned_end)}`}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={sprint.name}
        description={sprint.goal || undefined}
        actions={
          <>
            {sprint.status !== "closed" ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden /> Edit
              </Button>
            ) : null}
            {sprint.status === "planned" ? (
              <>
                <Button variant="outline" onClick={() => setConfirm("delete")}>
                  <Trash2Icon aria-hidden /> Delete
                </Button>
                <Button onClick={() => setConfirm("start")} disabled={inSprint.length === 0 || !!running}>
                  <PlayIcon aria-hidden /> Start sprint
                </Button>
              </>
            ) : null}
            {sprint.status === "active" ? (
              <Button onClick={() => setConfirm("close")}>
                <SquareIcon aria-hidden /> Close sprint
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
          <SprintStatusBadge status={sprint.status} />
          <span className="font-mono text-xs">{sprint.sprint_id}</span>
          <span>{dates}</span>
        </div>
      </PageHeader>

      {sprint.status === "planned" && running ? (
        <Alert>
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>{running.name} is still running</AlertTitle>
          <AlertDescription>
            A project runs one sprint at a time. <Link href={`/sprints/${encodeURIComponent(running.sprint_id)}`}>Close {running.name}</Link> before starting this one.
          </AlertDescription>
        </Alert>
      ) : null}

      <EffortSyncNote project={project} sprint={sprint} />
      <Summary sprint={sprint} stories={inSprint} />

      <section aria-labelledby="sprint-backlog-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sprint-backlog-heading" className="text-lg font-semibold">
            Sprint backlog
          </h2>
          {sprint.status !== "closed" ? (
            <div className="flex gap-2">
              <AddStoriesDialog projectId={project.id} sprint={sprint} backlog={backlog} />
              <Button variant="outline" onClick={() => setCreating(true)}>
                <PlusIcon aria-hidden /> New story
              </Button>
            </div>
          ) : null}
        </div>
        {inSprint.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No stories in this sprint yet</EmptyTitle>
              <EmptyDescription>
                {backlog.length > 0
                  ? `Add stories from the backlog (${backlog.length} waiting), or write a new one.`
                  : "The backlog is empty: write a new story, or import some on the Backlog page."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <StoryTable
            projectId={project.id}
            stories={inSprint}
            sprints={sprints.data}
            sprint={sprint}
            caption={`Stories in ${sprint.name}`}
          />
        )}
      </section>

      {inSprint.length > 0
        ? SPRINT_PANELS.map(({ slug, Component }) => (
            // A new key when the sprint starts or closes: results from before no longer apply.
            <Component key={`${slug}-${sprint.status}`} project={project} sprint={sprint} stories={inSprint} />
          ))
        : null}

      <SprintFormDialog projectId={project.id} sprint={sprint} open={editing} onOpenChange={setEditing} />
      <StoryFormDialog projectId={project.id} sprintId={sprint.sprint_id} open={creating} onOpenChange={setCreating} />

      <AlertDialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "start" ? `Start ${sprint.name}?` : confirm === "close" ? `Close ${sprint.name}?` : `Delete ${sprint.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "start"
                ? `The team commits to ${inSprint.length} ${inSprint.length === 1 ? "story" : "stories"} (${formatPoints(totalPoints(inSprint))} points) for ${sprint.length_days} days. Stories added later count as added mid-sprint.`
                : confirm === "close"
                  ? unfinished > 0
                    ? `${unfinished} ${unfinished === 1 ? "story is" : "stories are"} not done and will go back to the backlog as spilled over. Each story's outcome is recorded against its estimate.`
                    : "Every story is done. Each story's outcome is recorded against its estimate."
                  : "The sprint has not started, so it is removed; its stories go back to the backlog."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "delete" ? "destructive" : "default"}
              onClick={(event) => {
                event.preventDefault();
                if (confirm === "delete") void deleteSprint();
                else if (confirm) void run(confirm);
              }}
            >
              {action.isPending || remove.isPending ? <Spinner aria-hidden /> : null}
              {confirm === "start" ? "Start sprint" : confirm === "close" ? "Close sprint" : "Delete sprint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SprintView({ sprintId }: { sprintId: string }) {
  return <ProjectGate>{(project) => <SprintPage key={project.id} project={project} sprintId={sprintId} />}</ProjectGate>;
}
