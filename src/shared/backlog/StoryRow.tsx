"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EllipsisIcon, GripVerticalIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { STORY_BADGES } from "@/shared/module-slots";
import type { Project } from "@/shared/projects/api";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { StoryStatusBadge } from "./badges";
import { EpicChip, IssueTypeIcon, PointsPill, PriorityLabel } from "./icons";
import type { Sprint, Story } from "./types";

export interface RowActions {
  onOpen: (story: Story) => void;
  onMove: (story: Story, where: "up" | "down" | "top" | "bottom") => void;
  onMoveTo: (story: Story, sprintId: string | null) => void;
  /** Sprints a story can be moved to (planned or active). */
  targets: Sprint[];
}

/**
 * A story in a list: its type, title and id, then epic and priority on a second line, and on the right its risk,
 * status and size. The whole row opens the story; the handle and the menu keep their own clicks.
 */
export function StoryRowContent({
  project,
  story,
  onOpen,
  handle,
  menu,
}: {
  project: Project;
  story: Story;
  onOpen?: (story: Story) => void;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-2 sm:pr-4">
      {handle}
      <IssueTypeIcon type={story.issue_type} size="lg" />
      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          onClick={() => onOpen?.(story)}
          className="line-clamp-2 max-w-full rounded text-left text-[0.9375rem]/snug font-medium after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:underline"
          title={story.title}
        >
          {story.title}
        </button>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{story.story_id}</span>
          {story.epic ? <EpicChip epic={story.epic} /> : null}
          <PriorityLabel priority={story.priority} />
          <span className="sm:hidden">
            · <StoryStatusBadge status={story.status} plain />
          </span>
        </p>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-3">
        <span className="hidden w-24 lg:flex">
          {STORY_BADGES.map(({ slug, Component }) => (
            <Component key={slug} project={project} story={story} />
          ))}
        </span>
        <span className="hidden w-28 sm:flex sm:justify-end">
          <StoryStatusBadge status={story.status} />
        </span>
        <PointsPill points={story.story_points} size="lg" />
        {menu}
      </div>
    </div>
  );
}

export function SortableStoryRow({
  project,
  story,
  section,
  index,
  count,
  draggable,
  actions,
}: {
  project: Project;
  story: Story;
  section: string;
  index: number;
  count: number;
  draggable: boolean;
  actions: RowActions;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: story.story_id,
    data: { section },
    disabled: !draggable,
  });

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${story.story_id}`}>
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => actions.onOpen(story)}>Open details</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={index === 0} onSelect={() => actions.onMove(story, "top")}>
          Move to the top
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onSelect={() => actions.onMove(story, "up")}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => actions.onMove(story, "down")}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onSelect={() => actions.onMove(story, "bottom")}>
          Move to the bottom
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {actions.targets
          .filter((sprint) => sprint.sprint_id !== story.sprint_id)
          .map((sprint) => (
            <DropdownMenuItem key={sprint.sprint_id} onSelect={() => actions.onMoveTo(story, sprint.sprint_id)}>
              {sprint.name} ({sprint.status})
            </DropdownMenuItem>
          ))}
        {story.sprint_id ? (
          <DropdownMenuItem onSelect={() => actions.onMoveTo(story, null)}>The backlog</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={!draggable}
      aria-label={`Drag ${story.story_id}: ${story.title}`}
      className="relative z-10 -mr-1 flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors group-hover/row:text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30 active:cursor-grabbing"
    >
      <GripVerticalIcon aria-hidden className="size-4" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row border-b border-border/70 bg-card transition-colors last:border-b-0 hover:bg-accent/40",
        isDragging && "relative z-10 opacity-40",
      )}
    >
      <StoryRowContent project={project} story={story} onOpen={actions.onOpen} handle={handle} menu={menu} />
    </li>
  );
}
