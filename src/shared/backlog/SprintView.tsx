"use client";

import {
  CircleCheckIcon,
  ColumnsIcon,
  ListIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import { AddStoriesDialog } from "./AddStoriesDialog";
import { Burndown } from "./Burndown";
import { useDeleteSprint, useSprintAction, useSprints, useStories } from "./api";
import { formatDate, formatDateTime, formatPoints, SprintStatusBadge } from "./badges";
import { daysLeft } from "./planning";
import { SprintBoard } from "./SprintBoard";
import { SprintFormDialog } from "./SprintFormDialog";
import { sprintStats } from "./sprint-stats";
import { StoryDetailsSheet } from "./StoryDetailsSheet";
import { StoryFormDialog } from "./StoryFormDialog";
import { StoryTable } from "./StoryTable";
import { storiesIn, totalPoints, type Sprint, type Story } from "./types";

type Confirm = "start" | "close" | "delete" | null;

function Stat({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {children ? <CardContent className="space-y-1.5 text-xs text-muted-foreground">{children}</CardContent> : null}
    </Card>
  );
}

function Stats({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const stats = sprintStats(sprint, stories);
  const left = daysLeft(sprint);
  const over = stats.capacity !== null && stats.committed > stats.capacity;
  const muted = "text-sm font-normal text-muted-foreground";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Time"
        value={
          sprint.status === "planned" ? (
            <>
              {sprint.length_days} <span className={muted}>days</span>
            </>
          ) : sprint.status === "closed" ? (
            "Closed"
          ) : (
            <>
              Day {Math.min(stats.elapsedDays + 1, stats.lengthDays)} <span className={muted}>of {stats.lengthDays}</span>
            </>
          )
        }
      >
        {sprint.status === "active" ? (
          <>
            <Progress value={(stats.elapsedDays / stats.lengthDays) * 100} aria-label="Time used" />
            <p>{left === 0 ? "Last day" : `${left} ${left === 1 ? "day" : "days"} left, ends ${formatDate(sprint.planned_end)}`}</p>
          </>
        ) : (
          <p>{sprint.status === "closed" ? `On ${formatDate(sprint.closed_at)}` : "Starts when you start it"}</p>
        )}
      </Stat>
      <Stat
        label="Done"
        value={
          <>
            {formatPoints(stats.done)} <span className={muted}>of {formatPoints(stats.committed)} points</span>
          </>
        }
      >
        <Progress value={stats.committed > 0 ? (stats.done / stats.committed) * 100 : 0} aria-label="Points done" />
        <p>{stats.committed > 0 ? `${Math.round((stats.done / stats.committed) * 100)}% of the points` : "Nothing estimated yet"}</p>
      </Stat>
      <Stat
        label="Capacity"
        value={
          stats.capacity === null ? (
            "Not set"
          ) : (
            <>
              {formatPoints(stats.capacity)} <span className={muted}>points</span>
            </>
          )
        }
      >
        {stats.capacity === null ? (
          <p>The effort estimate uses the team&apos;s velocity.</p>
        ) : over ? (
          <p className="inline-flex items-center gap-1 font-medium text-warning">
            <TriangleAlertIcon aria-hidden className="size-3.5" /> {formatPoints(stats.committed - stats.capacity)} points over
          </p>
        ) : (
          <p>{formatPoints(stats.capacity - stats.committed)} points to spare</p>
        )}
      </Stat>
      <Stat
        label="Stories"
        value={
          <>
            {stories.length} <span className={muted}>{stories.length === 1 ? "story" : "stories"}</span>
          </>
        }
      >
        <p>
          {sprint.status === "closed"
            ? `${stats.counts.done} done, ${stories.length - stats.counts.done} spilled over`
            : `${stats.counts.to_do} to do, ${stats.counts.in_progress} in progress, ${stats.counts.done} done`}
        </p>
      </Stat>
    </div>
  );
}

type View = "board" | "list";
const VIEW_KEY = "synapse-sprint-view";

/** Board or list, remembered per viewer; phones start with the list. */
function initialView(): View {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "board" || saved === "list") return saved;
  } catch {
    // storage may be unavailable (a private window): fall back to the default
  }
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches ? "list" : "board";
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
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<string | null>(null);

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
      <Stats sprint={sprint} stories={inSprint} />

      {sprint.status !== "planned" && inSprint.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Burndown</h2>
            </CardTitle>
            <CardDescription>Points still to do each day, against a straight line to zero by the planned end.</CardDescription>
          </CardHeader>
          <CardContent>
            <Burndown sprint={sprint} stories={inSprint} />
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="sprint-backlog-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sprint-backlog-heading" className="text-lg font-semibold">
            Sprint backlog
          </h2>
          {sprint.status !== "closed" ? (
            <div className="flex flex-wrap gap-2">
              {sprint.status === "active" ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={view}
                  aria-label="Show the stories as"
                  onValueChange={(next) => {
                    if (next !== "board" && next !== "list") return;
                    setView(next);
                    try {
                      window.localStorage.setItem(VIEW_KEY, next);
                    } catch {
                      // not remembered: fine
                    }
                  }}
                >
                  <ToggleGroupItem value="board" aria-label="Board">
                    <ColumnsIcon aria-hidden /> <span className="hidden sm:inline">Board</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List">
                    <ListIcon aria-hidden /> <span className="hidden sm:inline">List</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : null}
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
        ) : sprint.status === "active" && view === "board" ? (
          <SprintBoard project={project} sprint={sprint} stories={inSprint} onOpen={(story) => setSelected(story.story_id)} />
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

      <StoryDetailsSheet
        project={project}
        story={selected ? (stories.data.find((story) => story.story_id === selected) ?? null) : null}
        sprints={sprints.data}
        onClose={() => setSelected(null)}
      />
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
