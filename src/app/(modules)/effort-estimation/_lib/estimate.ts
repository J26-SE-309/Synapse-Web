import type { Sprint, Story } from "@/shared/backlog/types";

import type { EstimateRequest, StoryInput } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The stories this estimate covers: in an active sprint, the ones not done yet (done work has no risk left). */
export function storiesToEstimate(sprint: Sprint, stories: Story[]): Story[] {
  return sprint.status === "active" ? stories.filter((story) => story.status !== "done") : stories;
}

/**
 * A platform sprint as this service's estimate request (contracts/effort-estimation/estimate-request.schema.json):
 * the stories with everything the models read, where each one stands in the sprint, and the sprint's length and
 * capacity. pinnedConfiguration is a model chosen just for this estimate (null: the project's setting).
 */
export function toEstimateRequest(
  sprint: Sprint,
  stories: Story[],
  pinnedConfiguration: string | null,
): EstimateRequest {
  const items = new Map(sprint.items.map((item) => [item.story_id, item]));
  const started = sprint.started_at ? Date.parse(sprint.started_at) : null;
  return {
    project_id: sprint.project_id,
    sprint_id: sprint.sprint_id,
    pinned_configuration: pinnedConfiguration,
    sprint_context: { length_days: sprint.length_days, capacity_points: sprint.capacity_points },
    stories: stories.map((story): StoryInput => {
      const item = items.get(story.story_id);
      const added = !!item?.added_mid_sprint;
      const committed = item?.committed_at ? Date.parse(item.committed_at) : null;
      return {
        story_id: story.story_id,
        title: story.title,
        description: story.description,
        acceptance_criteria: story.acceptance_criteria,
        issue_type: story.issue_type,
        priority: story.priority,
        story_points: story.story_points,
        blocker_count: story.blocked_by,
        dep_out_degree: story.depends_on,
        dep_in_degree: story.needed_by,
        // The platform knows whether a story belongs to an epic.
        has_epic: story.epic !== null,
        in_progress: story.status === "in_progress",
        added_mid_sprint: added,
        days_into_sprint:
          added && started !== null && committed !== null ? Math.max(0, Math.round(((committed - started) / DAY_MS) * 10) / 10) : 0,
      };
    }),
  };
}
