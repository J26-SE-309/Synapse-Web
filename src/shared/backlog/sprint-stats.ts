import { totalPoints, type Sprint, type Story, type StoryStatus } from "./types";

const DAY = 86_400_000;

export interface SprintStats {
  committed: number;
  done: number;
  counts: Record<StoryStatus, number>;
  /** Whole days since the start (0 before it starts), and the sprint's length. */
  elapsedDays: number;
  lengthDays: number;
  capacity: number | null;
}

/** Whether a story counts as done for this sprint: for a closed sprint, as it ended; otherwise as it is now. */
export function isDone(sprint: Sprint, story: Story): boolean {
  if (sprint.status === "closed") return !!sprint.items.find((item) => item.story_id === story.story_id)?.done_in_sprint;
  return story.status === "done";
}

export function sprintStats(sprint: Sprint, stories: Story[], now = Date.now()): SprintStats {
  const counts: Record<StoryStatus, number> = { to_do: 0, in_progress: 0, done: 0 };
  for (const story of stories) counts[isDone(sprint, story) ? "done" : story.status === "done" ? "in_progress" : story.status] += 1;
  const start = sprint.started_at ? Date.parse(sprint.started_at) : null;
  const end = sprint.closed_at ? Date.parse(sprint.closed_at) : now;
  return {
    committed: totalPoints(stories),
    done: totalPoints(stories.filter((story) => isDone(sprint, story))),
    counts,
    elapsedDays: start === null ? 0 : Math.min(sprint.length_days, Math.max(0, Math.floor((end - start) / DAY))),
    lengthDays: sprint.length_days,
    capacity: sprint.capacity_points,
  };
}

export interface BurndownPoint {
  day: number;
  label: string;
  /** The straight line from the committed points to zero at the planned end. */
  ideal: number;
  /** Points still open at the end of that day; null for days still to come. */
  remaining: number | null;
}

const dayLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/**
 * Points still to do at the end of each day of a started sprint. A story counts from the moment it was committed
 * (so stories added mid-sprint raise the line) until it was taken out or done.
 */
export function burndown(sprint: Sprint, stories: Story[], now = Date.now()): BurndownPoint[] {
  if (!sprint.started_at) return [];
  const start = Date.parse(sprint.started_at);
  const last = sprint.closed_at ? Date.parse(sprint.closed_at) : now;
  const byId = new Map(stories.map((story) => [story.story_id, story]));
  const scope = sprint.items.flatMap((item) => {
    const story = byId.get(item.story_id);
    if (!story) return [];
    const points = item.points_at_close ?? story.story_points ?? item.points_at_commit ?? 0;
    const committed = item.committed_at ? Date.parse(item.committed_at) : start;
    const left = item.left_at ? Date.parse(item.left_at) : Infinity;
    const doneAt = isDone(sprint, story) && story.resolved_at ? Date.parse(story.resolved_at) : Infinity;
    return [{ points, committed, left, doneAt }];
  });
  const initial = scope.filter((entry) => entry.committed <= start + 60_000).reduce((sum, entry) => sum + entry.points, 0);
  const days = sprint.length_days;
  return Array.from({ length: days + 1 }, (_, day) => {
    const at = start + day * DAY;
    const remaining =
      at - DAY >= last
        ? null
        : scope
            .filter((entry) => entry.committed <= Math.min(at, last) && entry.left > Math.min(at, last) && entry.doneAt > Math.min(at, last))
            .reduce((sum, entry) => sum + entry.points, 0);
    return {
      day,
      label: dayLabel.format(new Date(at)),
      ideal: Math.round(initial * (1 - day / days) * 10) / 10,
      remaining,
    };
  });
}
