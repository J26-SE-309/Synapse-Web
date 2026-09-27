"use client";

import { ChevronRightIcon, EllipsisIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { cn } from "@/shared/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useDeleteStory, useUpdateStory } from "./api";
import { formatDateTime, StoryStatusBadge, SyntheticBadge } from "./badges";
import { StoryFormDialog } from "./StoryFormDialog";
import { STATUS_LABELS, type Sprint, type SprintItem, type Story, type StoryStatus, type StoryUpdate } from "./types";

const SOURCE_LABELS: Record<Story["source"], string> = {
  manual: "Added by hand",
  import: "Imported",
  refinement: "From story refinement",
};

function Details({ story, item }: { story: Story; item?: SprintItem }) {
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-3">
        <section>
          <h4 className="font-medium">Description</h4>
          <p className={cn("whitespace-pre-line", !story.description && "text-muted-foreground")}>
            {story.description || "No description."}
          </p>
        </section>
        <section>
          <h4 className="font-medium">Acceptance criteria</h4>
          {story.acceptance_criteria.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {story.acceptance_criteria.map((criterion, index) => (
                <li key={index}>{criterion}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">None yet.</p>
          )}
        </section>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 self-start">
        <dt className="text-muted-foreground">Epic</dt>
        <dd>{story.epic ?? "None"}</dd>
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
        {item?.added_mid_sprint ? (
          <>
            <dt className="text-muted-foreground">Added</dt>
            <dd>After the sprint started ({formatDateTime(item.committed_at)})</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Source</dt>
        <dd>{SOURCE_LABELS[story.source]}</dd>
        <dt className="text-muted-foreground">Estimates</dt>
        <dd>
          <Link href={`/effort-estimation/predictions?story=${encodeURIComponent(story.story_id)}`}>
            Effort and risk predictions
          </Link>
        </dd>
      </dl>
    </div>
  );
}

/**
 * Stories with every detail a row can open. In the backlog it shows each story's sprint; in a sprint, how each
 * story is going (its status can change while the sprint is active) and, once closed, how it ended.
 */
export function StoryTable({
  projectId,
  stories,
  sprints,
  sprint,
  caption,
}: {
  projectId: string;
  stories: Story[];
  /** The project's sprints, for "Move to" and to name each story's sprint. */
  sprints: Sprint[];
  /** Showing one sprint's stories. */
  sprint?: Sprint;
  caption: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState<Story | null>(null);
  const update = useUpdateStory(projectId);
  const remove = useDeleteStory(projectId);
  const names = new Map(sprints.map((entry) => [entry.sprint_id, entry.name]));
  const targets = sprints.filter((entry) => entry.status !== "closed");
  const items = new Map(sprint?.items.map((item) => [item.story_id, item]) ?? []);
  const inSprint = !!sprint;
  // During an active sprint the team moves stories along here; elsewhere the status is only shown.
  const statusEditable = sprint?.status === "active";

  function toggle(storyId: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }

  async function change(story: Story, changes: StoryUpdate, done: string) {
    try {
      await update.mutateAsync({ storyId: story.story_id, update: changes });
      toast.success(done);
    } catch (error) {
      toast.error(`${story.story_id} was not changed`, { description: describeError(error) });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.story_id);
      toast.success(`Deleted ${deleting.story_id}`);
    } catch (error) {
      toast.error(`${deleting.story_id} was not deleted`, { description: describeError(error) });
    }
    setDeleting(null);
  }

  const columns = 6;

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Story</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{inSprint && sprint.status === "closed" ? "Outcome" : inSprint ? "Priority" : "Sprint"}</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stories.map((story) => {
              const expanded = open.has(story.story_id);
              const item = items.get(story.story_id);
              return (
                <Fragment key={story.story_id}>
                  <TableRow>
                    <TableCell className="max-w-md min-w-56 whitespace-normal">
                      <button
                        type="button"
                        onClick={() => toggle(story.story_id)}
                        aria-expanded={expanded}
                        aria-controls={expanded ? `story-details-${story.story_id}` : undefined}
                        className="flex w-full items-start gap-2 rounded-md text-left"
                      >
                        <ChevronRightIcon
                          aria-hidden
                          className={cn("mt-0.5 size-4 shrink-0 transition-transform", expanded && "rotate-90")}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{story.title}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
                            {story.story_id}
                            {story.synthetic ? <SyntheticBadge /> : null}
                            {item?.added_mid_sprint ? (
                              <span className="font-sans">Added mid-sprint</span>
                            ) : null}
                          </span>
                          <span className="sr-only">{expanded ? ", hide details" : ", show details"}</span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>{story.issue_type ?? "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">{story.story_points ?? "–"}</TableCell>
                    <TableCell>
                      {statusEditable ? (
                        <NativeSelect
                          size="sm"
                          aria-label={`Status of ${story.story_id}`}
                          value={story.status}
                          onChange={(event) =>
                            change(
                              story,
                              { status: event.target.value as StoryStatus },
                              `${story.story_id}: ${STATUS_LABELS[event.target.value as StoryStatus]}`,
                            )
                          }
                        >
                          {(Object.keys(STATUS_LABELS) as StoryStatus[]).map((status) => (
                            <NativeSelectOption key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <StoryStatusBadge status={story.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {inSprint && sprint.status === "closed" ? (
                        item?.left_at ? (
                          "Taken out"
                        ) : item?.done_in_sprint ? (
                          "Done in the sprint"
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <RotateCcwIcon aria-hidden className="size-3.5" /> Spilled over
                          </span>
                        )
                      ) : inSprint ? (
                        story.priority ?? "–"
                      ) : story.sprint_id ? (
                        <Link href={`/sprints/${encodeURIComponent(story.sprint_id)}`}>
                          {names.get(story.sprint_id) ?? story.sprint_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Backlog</span>
                      )}
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${story.story_id}`}>
                            <EllipsisIcon aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(story)}>Edit</DropdownMenuItem>
                          {sprint?.status !== "closed" ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              {targets
                                .filter((entry) => entry.sprint_id !== story.sprint_id)
                                .map((entry) => (
                                  <DropdownMenuItem
                                    key={entry.sprint_id}
                                    onSelect={() => change(story, { sprint_id: entry.sprint_id }, `${story.story_id} moved to ${entry.name}`)}
                                  >
                                    {entry.name} ({entry.status})
                                  </DropdownMenuItem>
                                ))}
                              {story.sprint_id ? (
                                <DropdownMenuItem
                                  onSelect={() => change(story, { sprint_id: null }, `${story.story_id} is back in the backlog`)}
                                >
                                  The backlog
                                </DropdownMenuItem>
                              ) : null}
                              {targets.length === 0 && !story.sprint_id ? (
                                <DropdownMenuItem disabled>No planned or active sprint</DropdownMenuItem>
                              ) : null}
                            </>
                          ) : null}
                          {!inSprint ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(story)}>
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columns} id={`story-details-${story.story_id}`} className="bg-muted/30 whitespace-normal">
                        <Details story={story} item={item} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <StoryFormDialog
        projectId={projectId}
        story={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.story_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” is removed from the backlog. A story that has been in a started sprint stays in that
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
