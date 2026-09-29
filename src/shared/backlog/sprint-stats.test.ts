import { describe, expect, it } from "vitest";

import { ACTIVE, story } from "@/test/backlog-fixtures";

import { burndown, sprintStats } from "./sprint-stats";
import type { Sprint } from "./types";

// Sprint 4 started on Sep 14; TUTOR-2 was added on Sep 17.
const SPRINT: Sprint = { ...ACTIVE, length_days: 4, planned_end: "2026-09-18T09:00:00Z" };
const STORIES = [
  story("TUTOR-1", { story_points: 5, status: "done", resolved_at: "2026-09-15T12:00:00Z" }),
  story("TUTOR-2", { story_points: 2 }),
  story("TUTOR-3", { story_points: 1, status: "in_progress" }),
];

describe("a sprint's numbers", () => {
  it("count points, stories and days", () => {
    const stats = sprintStats(SPRINT, STORIES, Date.parse("2026-09-16T10:00:00Z"));
    expect(stats).toMatchObject({ committed: 8, done: 5, elapsedDays: 2, lengthDays: 4, capacity: 30 });
    expect(stats.counts).toEqual({ to_do: 1, in_progress: 1, done: 1 });
  });

  it("burn down day by day: done work leaves, work added mid-sprint joins, the latest point is now", () => {
    // Each point is the work left at the start of that day: TUTOR-1 (done on the 15th) leaves on the 16th, TUTOR-2
    // (added on the 17th) joins then, and the last point shows what is left now.
    const points = burndown(SPRINT, STORIES, Date.parse("2026-09-17T12:00:00Z"));
    expect(points.map((point) => point.remaining)).toEqual([6, 6, 1, 3, 3]);
    // Earlier, at 10:00 on the 15th (TUTOR-1 was done at 12:00): the 16th shows now, later days are empty.
    expect(burndown(SPRINT, STORIES, Date.parse("2026-09-15T10:00:00Z")).map((point) => point.remaining)).toEqual([
      6,
      6,
      6,
      null,
      null,
    ]);
    expect(points.map((point) => point.ideal)).toEqual([6, 4.5, 3, 1.5, 0]);
  });

  it("have no burndown before the sprint starts", () => {
    expect(burndown({ ...SPRINT, status: "planned", started_at: null }, STORIES)).toEqual([]);
  });
});
