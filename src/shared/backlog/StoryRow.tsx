"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EllipsisIcon, FlaskConicalIcon, GripVerticalIcon } from "lucide-react";

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
import { EpicChip, IssueTypeIcon, PointsPill, PriorityIcon } from "./icons";
import type { Sprint, Story } from "./types";

export interface RowActions {
  onOpen: (story: Story) => void;
  onMove: (story: Story, where: "up" | "down" | "top" | "bottom") => void;
  onMoveTo: (story: Story, sprintId: string | null) => void;
  /** Sprints a story can be moved to (planned or active). */
  targets: Sprint[];
}

/** One line of a story: what it is, how big, how urgent, and where it stands. */
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
  // Fixed-width slots so the columns line up from row to row.
  return (
    <div className="flex min-h-11 items-center gap-2 px-2 py-1.5">
      {handle}
      <IssueTypeIcon type={story.issue_type} />
      <span className="hidden w-28 shrink-0 truncate font-mono text-xs text-muted-foreground lg:inline" title={story.story_id}>
        {story.story_id}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpen?.(story)}
          className="min-w-0 truncate rounded text-left text-sm font-medium hover:underline focus-visible:underline"
          title={story.title}
        >
          <span className="font-mono text-xs font-normal text-muted-foreground lg:hidden">{story.story_id} </span>
          {story.title}
        </button>
        {story.synthetic ? (
          <span title="Synthetic: made up for development and demonstrations" className="shrink-0 text-warning">
            <FlaskConicalIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(synthetic)</span>
          </span>
        ) : null}
      </span>
      <span className="hidden w-28 shrink-0 justify-end md:flex">{story.epic ? <EpicChip epic={story.epic} /> : null}</span>
      <span className="hidden w-24 shrink-0 justify-end xl:flex">
        {STORY_BADGES.map(({ slug, Component }) => (
          <Component key={slug} project={project} story={story} />
        ))}
      </span>
      <span className="flex w-5 shrink-0 justify-center">
        <PriorityIcon priority={story.priority} />
      </span>
      <span className="hidden w-28 shrink-0 sm:flex">
        <StoryStatusBadge status={story.status} />
      </span>
      <span className="flex w-8 shrink-0 justify-center">
        <PointsPill points={story.story_points} />
      </span>
      {menu}
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
      className="-ml-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30 active:cursor-grabbing"
    >
      <GripVerticalIcon aria-hidden className="size-4" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("border-b bg-card last:border-b-0", isDragging && "relative z-10 opacity-40")}
    >
      <StoryRowContent project={project} story={story} onOpen={actions.onOpen} handle={handle} menu={menu} />
    </li>
  );
}
