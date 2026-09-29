"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, FlaskConicalIcon, GripVerticalIcon, PlusCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { cn } from "@/shared/lib/utils";
import { STORY_BADGES } from "@/shared/module-slots";
import type { Project } from "@/shared/projects/api";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { backlogKeys, useUpdateStory } from "./api";
import { formatPoints, StoryStatusBadge } from "./badges";
import { EpicChip, IssueTypeIcon, PointsPill, PriorityIcon } from "./icons";
import { STATUS_LABELS, totalPoints, type Sprint, type Story, type StoryStatus } from "./types";

const COLUMNS: StoryStatus[] = ["to_do", "in_progress", "done"];
const COLUMN_PREFIX = "column:";

/** With the keyboard, left and right move a picked-up card to the neighbouring column. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (step === 0 || !context.collisionRect) return undefined;
  event.preventDefault();
  const columns = context.droppableContainers
    .getEnabled()
    .flatMap((container) => {
      const rect = context.droppableRects.get(container.id);
      return rect ? [rect] : [];
    })
    .sort((a, b) => a.left - b.left);
  const centre = context.collisionRect.left + context.collisionRect.width / 2;
  const current = columns.findIndex((rect) => centre >= rect.left && centre <= rect.right);
  const next = columns[(current < 0 ? 0 : current) + step];
  return next ? { x: next.left + 8, y: next.top + 8 } : undefined;
};

function CardContent({ project, story, added }: { project: Project; story: Story; added: boolean }) {
  return (
    <>
      <p className="line-clamp-3 text-sm font-medium leading-snug">{story.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {story.epic ? <EpicChip epic={story.epic} /> : null}
        {STORY_BADGES.map(({ slug, Component }) => (
          <Component key={slug} project={project} story={story} />
        ))}
        {added ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Added after the sprint started">
            <PlusCircleIcon aria-hidden className="size-3.5" /> Added mid-sprint
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <IssueTypeIcon type={story.issue_type} />
        <span className="truncate font-mono">{story.story_id}</span>
        {story.synthetic ? (
          <span title="Synthetic: made up for development and demonstrations" className="text-warning">
            <FlaskConicalIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(synthetic)</span>
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityIcon priority={story.priority} />
          <PointsPill points={story.story_points} />
        </span>
      </div>
    </>
  );
}

function Card({
  project,
  story,
  added,
  onOpen,
  onMove,
}: {
  project: Project;
  story: Story;
  added: boolean;
  onOpen: (story: Story) => void;
  onMove: (story: Story, status: StoryStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: story.story_id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      // The whole card can be dragged with a pointer; the keyboard uses the handle, so Enter on the title still opens it.
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler | undefined}
      className={cn(
        "group relative touch-none rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(story)}
        className="block w-full rounded-lg p-3 pr-16 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CardContent project={project} story={story} added={added} />
      </button>
      <div className="absolute top-1.5 right-1.5 flex">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler | undefined}
          aria-label={`Move ${story.story_id} to another column`}
          className="flex size-7 cursor-grab items-center justify-center rounded text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
        >
          <GripVerticalIcon aria-hidden className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${story.story_id}`}>
              <EllipsisIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(story)}>Open details</DropdownMenuItem>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {COLUMNS.filter((status) => status !== story.status).map((status) => (
              <DropdownMenuItem key={status} onSelect={() => onMove(story, status)}>
                {STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function Column({
  status,
  children,
  stories,
}: {
  status: StoryStatus;
  children: React.ReactNode;
  stories: Story[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  return (
    <section
      aria-labelledby={`column-${status}`}
      className="flex w-72 shrink-0 snap-start flex-col rounded-xl bg-muted/50 md:w-auto md:min-w-0 md:shrink"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h3 id={`column-${status}`} className="sr-only">
          {STATUS_LABELS[status]}
        </h3>
        <StoryStatusBadge status={status} />
        <span className="text-xs text-muted-foreground">
          {stories.length} {stories.length === 1 ? "story" : "stories"} · {formatPoints(totalPoints(stories))} pts
        </span>
      </header>
      <ol
        ref={setNodeRef}
        aria-labelledby={`column-${status}`}
        className={cn("flex min-h-32 flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors", isOver && "bg-primary/10 ring-2 ring-primary/30 ring-inset")}
      >
        {children}
        {stories.length === 0 ? (
          <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Drop a story here
          </li>
        ) : null}
      </ol>
    </section>
  );
}

/** The sprint's stories in To do, In progress and Done: drag a card (or use its menu) to move it along. */
export function SprintBoard({
  project,
  sprint,
  stories,
  onOpen,
}: {
  project: Project;
  sprint: Sprint;
  stories: Story[];
  onOpen: (story: Story) => void;
}) {
  const update = useUpdateStory(project.id);
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Story | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );
  const added = new Set(sprint.items.filter((item) => item.added_mid_sprint).map((item) => item.story_id));
  const byId = new Map(stories.map((story) => [story.story_id, story]));
  const title = (id: string | number) => byId.get(String(id))?.story_id ?? String(id);
  const column = (id: string | number | undefined) =>
    id !== undefined && String(id).startsWith(COLUMN_PREFIX) ? (String(id).slice(COLUMN_PREFIX.length) as StoryStatus) : null;

  async function move(story: Story, status: StoryStatus) {
    if (story.status === status) return;
    queryClient.setQueryData<Story[]>(backlogKeys.stories(project.id), (old) =>
      old?.map((entry) => (entry.story_id === story.story_id ? { ...entry, status } : entry)),
    );
    try {
      await update.mutateAsync({ storyId: story.story_id, update: { status } });
      toast.success(`${story.story_id}: ${STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(`${story.story_id} was not moved`, { description: describeError(error) });
      void queryClient.invalidateQueries({ queryKey: backlogKeys.stories(project.id) });
    }
  }

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    const story = byId.get(String(dragged.id));
    const status = column(over?.id);
    if (story && status) void move(story, status);
  }

  const announcements: Announcements = {
    onDragStart: ({ active: dragged }) => `Picked up ${title(dragged.id)}. Use the left and right arrows to choose a column.`,
    onDragOver: ({ active: dragged, over }) =>
      over ? `${title(dragged.id)} is over ${STATUS_LABELS[column(over.id) ?? "to_do"]}.` : `${title(dragged.id)} is not over a column.`,
    onDragEnd: ({ active: dragged, over }) =>
      over ? `${title(dragged.id)} was moved to ${STATUS_LABELS[column(over.id) ?? "to_do"]}.` : `${title(dragged.id)} was dropped.`,
    onDragCancel: ({ active: dragged }) => `Moving ${title(dragged.id)} was cancelled.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active: dragged }) => setActive(byId.get(String(dragged.id)) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a story to another column, press space or enter, use the left and right arrows, then press space or enter to drop it, or escape to cancel. The story's menu does the same.",
        },
      }}
    >
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {COLUMNS.map((status) => {
          const inColumn = stories.filter((story) => story.status === status);
          return (
            <Column key={status} status={status} stories={inColumn}>
              {inColumn.map((story) => (
                <Card key={story.story_id} project={project} story={story} added={added.has(story.story_id)} onOpen={onOpen} onMove={move} />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-72 rotate-2 rounded-lg border bg-card p-3 shadow-xl ring-2 ring-primary/40">
            <CardContent project={project} story={active} added={added.has(active.story_id)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
