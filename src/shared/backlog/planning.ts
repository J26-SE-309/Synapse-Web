import { byRank, rankBetween, type Sprint, type Story } from "./types";

/** The backlog page's sections: the active sprint, then planned sprints, then the backlog itself. */
export const BACKLOG_SECTION = "backlog";
export const sectionOf = (sprintId: string | null) => (sprintId === null ? BACKLOG_SECTION : `sprint:${sprintId}`);

export interface Section {
  id: string;
  sprint: Sprint | null;
  stories: Story[];
}

export function planningSections(stories: Story[], sprints: Sprint[]): Section[] {
  const open = sprints
    .filter((sprint) => sprint.status !== "closed")
    .sort((a, b) => (a.status === b.status ? a.created_at.localeCompare(b.created_at) : a.status === "active" ? -1 : 1));
  const inSprint = (id: string) => stories.filter((story) => story.sprint_id === id).sort(byRank);
  return [
    ...open.map((sprint) => ({ id: sectionOf(sprint.sprint_id), sprint, stories: inSprint(sprint.sprint_id) })),
    { id: BACKLOG_SECTION, sprint: null, stories: stories.filter((story) => story.sprint_id === null).sort(byRank) },
  ];
}

export interface Filters {
  text: string;
  type: string;
  priority: string;
  epic: string;
}

export const NO_FILTERS: Filters = { text: "", type: "", priority: "", epic: "" };

export function isFiltered(filters: Filters): boolean {
  return Object.values(filters).some((value) => value.trim() !== "");
}

export function matches(story: Story, filters: Filters): boolean {
  const text = filters.text.trim().toLowerCase();
  if (text && !`${story.story_id} ${story.title} ${story.description} ${story.epic ?? ""}`.toLowerCase().includes(text)) return false;
  if (filters.type && story.issue_type !== filters.type) return false;
  if (filters.priority && story.priority !== filters.priority) return false;
  if (filters.epic && story.epic !== filters.epic) return false;
  return true;
}

/**
 * Where a story lands when it is dropped at `index` in `list` (the list without the story itself): the section's
 * sprint and a rank between its new neighbours.
 */
export function placeAt(list: Story[], index: number): number {
  return rankBetween(list[index - 1]?.rank, list[index]?.rank);
}

/** A story moved one place up (-1) or down (+1) within its section; null when it is already at that end. */
export function rankAfterStep(list: Story[], storyId: string, step: -1 | 1): number | null {
  const index = list.findIndex((story) => story.story_id === storyId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= list.length) return null;
  const others = list.filter((story) => story.story_id !== storyId);
  return placeAt(others, target);
}

/** The rank that puts a story first (or last) in a section. */
export function rankAtEnd(list: Story[], storyId: string, end: "top" | "bottom"): number {
  const others = list.filter((story) => story.story_id !== storyId);
  return placeAt(others, end === "top" ? 0 : others.length);
}

/** Days left until a sprint's planned end (0 on the last day), or null when it has not started. */
export function daysLeft(sprint: Sprint, now = Date.now()): number | null {
  if (!sprint.planned_end || sprint.status !== "active") return null;
  return Math.max(0, Math.ceil((Date.parse(sprint.planned_end) - now) / 86_400_000));
}
