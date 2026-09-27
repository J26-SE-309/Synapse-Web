import type { Sprint, Story } from "@/shared/backlog/types";

/** Stories and sprints as the gateway serves them, for tests. */
export function story(id: string, fields: Partial<Story> = {}): Story {
  return {
    project_id: "TUTOR",
    story_id: id,
    title: `Story ${id}`,
    description: "",
    acceptance_criteria: [],
    issue_type: "Story",
    priority: null,
    story_points: 3,
    epic: null,
    blocked_by: 0,
    depends_on: 0,
    needed_by: 0,
    status: "to_do",
    sprint_id: "TUTOR-S4",
    source: "manual",
    synthetic: false,
    started_at: null,
    resolved_at: null,
    reopened: false,
    created_at: "2026-09-10T09:00:00Z",
    updated_at: "2026-09-10T09:00:00Z",
    ...fields,
  };
}

export const ACTIVE: Sprint = {
  project_id: "TUTOR",
  sprint_id: "TUTOR-S4",
  name: "Sprint 4",
  goal: "",
  status: "active",
  length_days: 14,
  capacity_points: 30,
  started_at: "2026-09-14T09:00:00Z",
  planned_end: "2026-09-28T09:00:00Z",
  closed_at: null,
  created_at: "2026-09-11T10:00:00Z",
  items: [
    { story_id: "TUTOR-1", committed_at: "2026-09-14T09:00:00Z", added_mid_sprint: false, points_at_commit: 5, left_at: null, points_at_close: null, done_in_sprint: null },
    { story_id: "TUTOR-2", committed_at: "2026-09-17T09:00:00Z", added_mid_sprint: true, points_at_commit: 2, left_at: null, points_at_close: null, done_in_sprint: null },
    { story_id: "TUTOR-3", committed_at: "2026-09-14T09:00:00Z", added_mid_sprint: false, points_at_commit: 1, left_at: null, points_at_close: null, done_in_sprint: null },
  ],
  effort_sync: { status: "sent", sent_at: "2026-09-17T09:00:01Z", error: null },
};
