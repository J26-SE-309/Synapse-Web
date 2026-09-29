"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { STORY_PANELS } from "@/shared/module-slots";
import type { Project } from "@/shared/projects/api";
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
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

import { useDeleteStory, useUpdateStory } from "./api";
import { formatDateTime, StoryStatusBadge, SyntheticBadge } from "./badges";
import { EpicChip, IssueTypeIcon, PointsPill, PriorityIcon } from "./icons";
import { StoryFormDialog } from "./StoryFormDialog";
import { STATUS_LABELS, type Sprint, type Story, type StoryStatus, type StoryUpdate } from "./types";

const SOURCES: Record<Story["source"], string> = {
  manual: "Added by hand",
  import: "Imported",
  refinement: "From story refinement",
};

const BACKLOG = "__backlog";

/** Everything about one story, in a panel beside the page: details, status, where it is, and each component's view. */
export function StoryDetailsSheet({
  project,
  story,
  sprints,
  onClose,
}: {
  project: Project;
  story: Story | null;
  sprints: Sprint[];
  onClose: () => void;
}) {
  const ids = useId();
  const update = useUpdateStory(project.id);
  const remove = useDeleteStory(project.id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const current = story ? sprints.find((sprint) => sprint.sprint_id === story.sprint_id) : undefined;
  const closedSprint = current?.status === "closed";
  const targets = sprints.filter((sprint) => sprint.status !== "closed");

  async function change(changes: StoryUpdate, done: string) {
    if (!story) return;
    try {
      await update.mutateAsync({ storyId: story.story_id, update: changes });
      toast.success(done);
    } catch (error) {
      toast.error(`${story.story_id} was not changed`, { description: describeError(error) });
    }
  }

  async function confirmDelete() {
    if (!story) return;
    try {
      await remove.mutateAsync(story.story_id);
      toast.success(`Deleted ${story.story_id}`);
      setDeleting(false);
      onClose();
    } catch (error) {
      toast.error(`${story.story_id} was not deleted`, { description: describeError(error) });
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet open={story !== null} onOpenChange={(next) => !next && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {story ? (
            <>
              <SheetHeader className="gap-2 border-b pr-12">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <IssueTypeIcon type={story.issue_type} />
                  <span className="font-mono">{story.story_id}</span>
                  {story.synthetic ? <SyntheticBadge /> : null}
                </p>
                <SheetTitle className="text-lg leading-snug">{story.title}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <StoryStatusBadge status={story.status} />
                  <span className="inline-flex items-center gap-1">
                    <PriorityIcon priority={story.priority} decorative /> {story.priority ? `${story.priority} priority` : "No priority"}
                  </span>
                  <PointsPill points={story.story_points} />
                  {story.epic ? <EpicChip epic={story.epic} /> : null}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor={`${ids}-status`} className="text-sm font-medium">
                      Status
                    </label>
                    <NativeSelect
                      id={`${ids}-status`}
                      className="w-full"
                      value={story.status}
                      disabled={closedSprint}
                      onChange={(event) => {
                        const next = event.target.value as StoryStatus;
                        void change({ status: next }, `${story.story_id}: ${STATUS_LABELS[next]}`);
                      }}
                    >
                      {(Object.keys(STATUS_LABELS) as StoryStatus[]).map((status) => (
                        <NativeSelectOption key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`${ids}-sprint`} className="text-sm font-medium">
                      Sprint
                    </label>
                    <NativeSelect
                      id={`${ids}-sprint`}
                      className="w-full"
                      value={story.sprint_id ?? BACKLOG}
                      disabled={closedSprint}
                      onChange={(event) => {
                        const target = event.target.value === BACKLOG ? null : event.target.value;
                        const name = sprints.find((sprint) => sprint.sprint_id === target)?.name ?? "the backlog";
                        void change({ sprint_id: target }, `${story.story_id} moved to ${name}`);
                      }}
                    >
                      <NativeSelectOption value={BACKLOG}>Backlog</NativeSelectOption>
                      {closedSprint && current ? (
                        <NativeSelectOption value={current.sprint_id}>{current.name} (closed)</NativeSelectOption>
                      ) : null}
                      {targets.map((sprint) => (
                        <NativeSelectOption key={sprint.sprint_id} value={sprint.sprint_id}>
                          {sprint.name} ({sprint.status})
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-medium">Description</h3>
                  <p className={story.description ? "text-sm whitespace-pre-line" : "text-sm text-muted-foreground"}>
                    {story.description || "No description."}
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-medium">Acceptance criteria</h3>
                  {story.acceptance_criteria.length > 0 ? (
                    <ol className="space-y-1.5 text-sm">
                      {story.acceptance_criteria.map((criterion, index) => (
                        <li key={index} className="flex gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">None yet.</p>
                  )}
                </section>

                {STORY_PANELS.map(({ slug, Component }) => (
                  <Component key={slug} project={project} story={story} />
                ))}

                <section className="space-y-1.5">
                  <h3 className="text-sm font-medium">Details</h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Blocked by</dt>
                    <dd>{story.blocked_by} open {story.blocked_by === 1 ? "issue" : "issues"}</dd>
                    <dt className="text-muted-foreground">Depends on</dt>
                    <dd>{story.depends_on} {story.depends_on === 1 ? "issue" : "issues"}</dd>
                    <dt className="text-muted-foreground">Needed by</dt>
                    <dd>{story.needed_by} {story.needed_by === 1 ? "issue" : "issues"}</dd>
                    <dt className="text-muted-foreground">Started</dt>
                    <dd>{formatDateTime(story.started_at)}</dd>
                    <dt className="text-muted-foreground">Done</dt>
                    <dd>{formatDateTime(story.resolved_at)}</dd>
                    {story.reopened ? (
                      <>
                        <dt className="text-muted-foreground">Reopened</dt>
                        <dd>Yes, after it was done</dd>
                      </>
                    ) : null}
                    <dt className="text-muted-foreground">Source</dt>
                    <dd>{SOURCES[story.source]}</dd>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{formatDateTime(story.created_at)}</dd>
                  </dl>
                </section>
              </div>

              <SheetFooter className="mt-auto flex-row justify-between border-t">
                <Button variant="outline" onClick={() => setDeleting(true)} disabled={!!current && current.status !== "planned"}>
                  <Trash2Icon aria-hidden /> Delete
                </Button>
                <Button onClick={() => setEditing(true)}>
                  <PencilIcon aria-hidden /> Edit story
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <StoryFormDialog projectId={project.id} story={story ?? undefined} open={editing} onOpenChange={setEditing} />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {story?.story_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{story?.title}” is removed from the backlog. A story that has been in a started sprint stays in that
              sprint&apos;s history and can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete story
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
