"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CalendarPlusIcon,
  ChevronRightIcon,
  FilterXIcon,
  FlaskConicalIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/shared/lib/utils";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Skeleton } from "@/shared/ui/skeleton";

import { backlogKeys, useSprints, useStories, useUpdateStory } from "./api";
import { formatDate, formatPoints, SprintStatusBadge } from "./badges";
import { ImportStoriesDialog } from "./ImportStoriesDialog";
import {
  daysLeft,
  isFiltered,
  matches,
  NO_FILTERS,
  placeAt,
  planningSections,
  rankAfterStep,
  rankAtEnd,
  sectionOf,
  type Filters,
  type Section,
} from "./planning";
import { SprintFormDialog } from "./SprintFormDialog";
import { StoryDetailsSheet } from "./StoryDetailsSheet";
import { StoryFormDialog } from "./StoryFormDialog";
import { SortableStoryRow, StoryRowContent, type RowActions } from "./StoryRow";
import { ISSUE_TYPES, PRIORITIES, totalPoints, type Story, type StoryUpdate } from "./types";

const DROP_PREFIX = "drop:";

function sectionName(section: Section): string {
  return section.sprint ? section.sprint.name : "the backlog";
}

/** The capacity line under a sprint's name: points against capacity, with a bar. */
function Capacity({ points, capacity }: { points: number; capacity: number | null }) {
  if (capacity === null) {
    return <span className="text-xs text-muted-foreground tabular-nums">{formatPoints(points)} points, no capacity set</span>;
  }
  const over = points > capacity;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="relative hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(100, (points / capacity) * 100)}%` }}
        />
      </span>
      <span className={cn("text-xs tabular-nums", over ? "font-medium text-warning" : "text-muted-foreground")}>
        {over ? <TriangleAlertIcon aria-hidden className="mr-0.5 inline size-3.5 align-[-2px]" /> : null}
        {formatPoints(points)} of {formatPoints(capacity)} points{over ? ", over capacity" : ""}
      </span>
    </span>
  );
}

function PlanningSection({
  project,
  section,
  stories,
  total,
  collapsed,
  onToggle,
  draggable,
  actions,
}: {
  project: Project;
  section: Section;
  /** The stories shown (filtered, or moved about while dragging). */
  stories: Story[];
  /** Every story of the section, for its totals. */
  total: Story[];
  collapsed: boolean;
  onToggle: () => void;
  draggable: boolean;
  actions: RowActions;
}) {
  const ids = useId();
  // The list itself is a drop target only while it is empty (a story dropped on another story goes before it); as a
  // target it would also be the nearest one for the keyboard's arrow keys and keep a story in its own section.
  const { setNodeRef, isOver } = useDroppable({ id: `${DROP_PREFIX}${section.id}`, disabled: stories.length > 0 });
  const sprint = section.sprint;
  const left = sprint ? daysLeft(sprint) : null;
  const points = totalPoints(total);

  return (
    <section aria-labelledby={`${ids}-name`} className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={`${ids}-list`}
          className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted"
        >
          <ChevronRightIcon aria-hidden className={cn("size-4 transition-transform", !collapsed && "rotate-90")} />
          <h2 id={`${ids}-name`} className="text-base font-semibold">
            {sprint ? sprint.name : "Backlog"}
          </h2>
        </button>
        {sprint ? <SprintStatusBadge status={sprint.status} /> : null}
        <span className="text-xs text-muted-foreground">
          {sprint?.status === "active"
            ? `${formatDate(sprint.started_at)} – ${formatDate(sprint.planned_end)} · ${left === 0 ? "last day" : `${left} ${left === 1 ? "day" : "days"} left`}`
            : sprint
              ? `${sprint.length_days} days, not started`
              : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {total.length} {total.length === 1 ? "story" : "stories"}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {sprint ? <Capacity points={points} capacity={sprint.capacity_points} /> : (
            <span className="text-xs text-muted-foreground tabular-nums">{formatPoints(points)} points</span>
          )}
          {sprint ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/sprints/${encodeURIComponent(sprint.sprint_id)}`}>
                {sprint.status === "active" ? "Board" : "Open"} <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          ) : null}
        </span>
      </div>
      {sprint?.goal && !collapsed ? <p className="pl-7 text-sm text-muted-foreground">{sprint.goal}</p> : null}
      {!collapsed ? (
        <SortableContext id={section.id} items={stories.map((story) => story.story_id)} strategy={verticalListSortingStrategy}>
          <ol
            id={`${ids}-list`}
            ref={setNodeRef}
            aria-label={`Stories in ${sectionName(section)}`}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              sprint?.status === "active" && "border-primary/40",
              isOver && "ring-2 ring-primary/40",
            )}
          >
            {stories.map((story, index) => (
              <SortableStoryRow
                key={story.story_id}
                project={project}
                story={story}
                section={section.id}
                index={index}
                count={stories.length}
                draggable={draggable}
                actions={actions}
              />
            ))}
            {stories.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {total.length > 0
                  ? "No story here matches the filters."
                  : sprint
                    ? "Drag stories here from the backlog, or use a story's menu: Move to."
                    : "The backlog is empty. Add a story, or move one back from a sprint."}
              </li>
            ) : null}
          </ol>
        </SortableContext>
      ) : null}
    </section>
  );
}

function Planning({ project }: { project: Project }) {
  const stories = useStories(project.id);
  const sprints = useSprints(project.id);
  const update = useUpdateStory(project.id);
  const queryClient = useQueryClient();
  const ids = useId();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingStory, setCreatingStory] = useState(false);
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const all = useMemo(() => stories.data ?? [], [stories.data]);
  const sections = useMemo(() => planningSections(all, sprints.data ?? []), [all, sprints.data]);
  const byId = useMemo(() => new Map(all.map((story) => [story.story_id, story])), [all]);
  const filtered = isFiltered(filters);
  const epics = useMemo(() => [...new Set(all.flatMap((story) => (story.epic ? [story.epic] : [])))].sort(), [all]);
  const targets = (sprints.data ?? []).filter((sprint) => sprint.status !== "closed");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const title = (id: string | number) => byId.get(String(id))?.title ?? String(id);
  const sectionById = (id: string) => sections.find((section) => section.id === id);
  function sectionOfItem(id: string | number, lists: Record<string, string[]> | null): string | undefined {
    const key = String(id);
    if (key.startsWith(DROP_PREFIX)) return key.slice(DROP_PREFIX.length);
    if (sectionById(key)) return key;
    if (lists) return Object.keys(lists).find((section) => lists[section].includes(key));
    const story = byId.get(key);
    return story ? sectionOf(story.sprint_id) : undefined;
  }

  async function save(story: Story, changes: StoryUpdate, done: string) {
    // Shown straight away; the gateway's answer then replaces it.
    queryClient.setQueryData<Story[]>(backlogKeys.stories(project.id), (old) =>
      old?.map((entry) => (entry.story_id === story.story_id ? { ...entry, ...changes } as Story : entry)),
    );
    try {
      await update.mutateAsync({ storyId: story.story_id, update: changes });
      toast.success(done);
    } catch (error) {
      toast.error(`${story.story_id} was not moved`, { description: describeError(error) });
      void queryClient.invalidateQueries({ queryKey: backlogKeys.stories(project.id) });
    }
  }

  const actions: RowActions = {
    targets,
    onOpen: (story) => setSelected(story.story_id),
    onMove: (story, where) => {
      const list = sectionById(sectionOf(story.sprint_id))?.stories ?? [];
      const rank =
        where === "up" || where === "down" ? rankAfterStep(list, story.story_id, where === "up" ? -1 : 1) : rankAtEnd(list, story.story_id, where === "top" ? "top" : "bottom");
      if (rank !== null) void save(story, { rank }, `${story.story_id} moved ${where === "top" || where === "bottom" ? `to the ${where}` : where}`);
    },
    onMoveTo: (story, sprintId) => {
      const list = sectionById(sectionOf(sprintId))?.stories ?? [];
      const name = sprintId ? sectionName(sectionById(sectionOf(sprintId))!) : "the backlog";
      void save(story, { sprint_id: sprintId, rank: rankAtEnd(list, story.story_id, "bottom") }, `${story.story_id} moved to ${name}`);
    },
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setDraft(Object.fromEntries(sections.map((section) => [section.id, section.stories.map((story) => story.story_id)])));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !draft) return;
    const from = sectionOfItem(active.id, draft);
    const to = sectionOfItem(over.id, draft);
    if (!from || !to || from === to) return;
    setDraft((current) => {
      if (!current) return current;
      const source = current[from].filter((id) => id !== active.id);
      const target = [...current[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, String(active.id));
      return { ...current, [from]: source, [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const lists = draft;
    setDraft(null);
    setActiveId(null);
    const story = byId.get(String(active.id));
    if (!over || !lists || !story) return;
    const to = sectionOfItem(over.id, lists);
    if (!to) return;
    let list = lists[to];
    const oldIndex = list.indexOf(story.story_id);
    const overIndex = list.indexOf(String(over.id));
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) list = arrayMove(list, oldIndex, overIndex);
    const index = list.indexOf(story.story_id);
    const others = list.filter((id) => id !== story.story_id).map((id) => byId.get(id)!);
    const section = sectionById(to)!;
    const moved = sectionOf(story.sprint_id) !== to;
    const before = (sectionById(sectionOf(story.sprint_id))?.stories ?? []).map((entry) => entry.story_id);
    if (!moved && before.indexOf(story.story_id) === index) return;
    const changes: StoryUpdate = { rank: placeAt(others, index) };
    if (moved) changes.sprint_id = section.sprint?.sprint_id ?? null;
    void save(story, changes, moved ? `${story.story_id} moved to ${sectionName(section)}` : `${story.story_id} reordered`);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => {
      if (!over) return `${title(active.id)} is not over a list.`;
      const section = sectionById(sectionOfItem(over.id, draft) ?? "");
      return `${title(active.id)} is in ${section ? sectionName(section) : "a list"}.`;
    },
    onDragEnd: ({ active, over }) => {
      const section = over ? sectionById(sectionOfItem(over.id, draft) ?? "") : undefined;
      return section ? `${title(active.id)} was dropped in ${sectionName(section)}.` : `${title(active.id)} was dropped.`;
    },
    onDragCancel: ({ active }) => `Moving ${title(active.id)} was cancelled; it is back where it was.`,
  };

  const active = activeId ? byId.get(activeId) : undefined;
  const selectedStory = selected ? byId.get(selected) ?? null : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Backlog"
        description="Plan the next sprints: put the most important stories at the top, then drag them up into a sprint."
        actions={
          <>
            <ImportStoriesDialog projectId={project.id} />
            <Button variant="outline" onClick={() => setCreatingSprint(true)}>
              <CalendarPlusIcon aria-hidden /> Plan a sprint
            </Button>
            <Button onClick={() => setCreatingStory(true)}>
              <PlusIcon aria-hidden /> New story
            </Button>
          </>
        }
      />

      {stories.isPending || sprints.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : stories.isError || sprints.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The backlog could not be loaded</AlertTitle>
          <AlertDescription>{describeError(stories.error ?? sprints.error)}</AlertDescription>
        </Alert>
      ) : all.length === 0 && sections.length === 1 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No stories yet</EmptyTitle>
            <EmptyDescription>
              Add the project&apos;s user stories one by one, or import a backlog file. Stories from story refinement will
              arrive here too.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center">
            <Button onClick={() => setCreatingStory(true)}>
              <PlusIcon aria-hidden /> New story
            </Button>
            <ImportStoriesDialog projectId={project.id} />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div role="search" aria-label="Filter the stories" className="flex flex-col gap-2 rounded-xl border bg-card p-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search stories"
                placeholder="Search by id, title, description or epic"
                className="pl-8"
                value={filters.text}
                onChange={(event) => setFilters({ ...filters, text: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <NativeSelect aria-label="Type" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
                <NativeSelectOption value="">All types</NativeSelectOption>
                {ISSUE_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Priority" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
                <NativeSelectOption value="">All priorities</NativeSelectOption>
                {PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Epic" value={filters.epic} onChange={(event) => setFilters({ ...filters, epic: event.target.value })}>
                <NativeSelectOption value="">All epics</NativeSelectOption>
                {epics.map((epic) => (
                  <NativeSelectOption key={epic} value={epic}>
                    {epic}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {filtered ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                <FilterXIcon aria-hidden /> Clear
              </Button>
            ) : null}
          </div>
          {all.some((story) => story.synthetic) ? (
            <Alert>
              <FlaskConicalIcon aria-hidden />
              <AlertTitle>
                {all.every((story) => story.synthetic) ? "These stories are synthetic" : "Some stories are synthetic"}
              </AlertTitle>
              <AlertDescription>
                Made up for development and demonstrations (marked with a flask). Use them to try the platform, not as
                evidence about a team.
              </AlertDescription>
            </Alert>
          ) : null}
          <p id={`${ids}-hint`} className="-mt-3 text-xs text-muted-foreground" aria-live="polite">
            {filtered
              ? "Filtered: dragging is off so nothing moves out of sight. Clear the filters to reorder."
              : "Drag a story by its handle, or with the keyboard (space to pick up, arrows to move, space to drop). A story's menu does the same."}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setDraft(null);
              setActiveId(null);
            }}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  "To pick up a story, press space or enter. Use the arrow keys to move it, also into another sprint or the backlog. Press space or enter to drop it, or escape to cancel.",
              },
            }}
          >
            <div className="space-y-6">
              {sections.map((section) => {
                const shown = (draft?.[section.id] ?? section.stories.map((story) => story.story_id))
                  .map((id) => byId.get(id)!)
                  .filter((story) => story && matches(story, filters));
                return (
                  <PlanningSection
                    key={section.id}
                    project={project}
                    section={section}
                    stories={shown}
                    total={section.stories}
                    collapsed={collapsed.has(section.id)}
                    onToggle={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        return next;
                      })
                    }
                    draggable={!filtered}
                    actions={actions}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {active ? (
                <div className="rounded-lg border bg-card shadow-lg ring-2 ring-primary/40">
                  <StoryRowContent project={project} story={active} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <StoryDetailsSheet project={project} story={selectedStory} sprints={sprints.data ?? []} onClose={() => setSelected(null)} />
      <StoryFormDialog projectId={project.id} open={creatingStory} onOpenChange={setCreatingStory} />
      <SprintFormDialog projectId={project.id} open={creatingSprint} onOpenChange={setCreatingSprint} stay />
    </div>
  );
}

export function BacklogView() {
  return <ProjectGate>{(project) => <Planning key={project.id} project={project} />}</ProjectGate>;
}

