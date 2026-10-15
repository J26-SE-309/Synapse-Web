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
    stories: stories.map((story) => {
      const item = items.get(story.story_id);
      const added = !!item?.added_mid_sprint;
      const committed = item?.committed_at ? Date.parse(item.committed_at) : null;
      return toStoryInput(story, {
        added,
        daysIn: added && started !== null && committed !== null ? (committed - started) / DAY_MS : 0,
      });
    }),
  };
}

/** A platform story with everything the models read; where it stands in its sprint, when it is in one. */
export function toStoryInput(story: Story, { added = false, daysIn = 0 } = {}): StoryInput {
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
    days_into_sprint: added ? Math.max(0, Math.round(daysIn * 10) / 10) : 0,
    // What Components 1-3 found, when the platform has it (otherwise the service uses its text proxies).
    ...(story.upstream ? { upstream: story.upstream } : {}),
  };
}

/**
 * One story's prediction, made the way a sprint's is: with a sprint, the sprint's other stories go along as its
 * committed work (focus_story_ids keeps them from being predicted or recorded), and a story not in the sprint is
 * treated as added to it now. The prediction carries the sprint's id only when the story really is in the sprint,
 * so its outcome is recorded at the close and a story that is only tried out never counts in the sprint's figures.
 */
export function toStoryPrediction({
  projectId,
  story,
  sprint,
  sprintStories,
  pinnedConfiguration,
  now = Date.now(),
}: {
  projectId: string;
  story: Story;
  sprint: Sprint | null;
  sprintStories: Story[];
  pinnedConfiguration: string | null;
  now?: number;
}): EstimateRequest {
  if (!sprint) {
    return {
      project_id: projectId,
      sprint_id: null,
      pinned_configuration: pinnedConfiguration,
      stories: [toStoryInput(story)],
      focus_story_ids: [story.story_id],
    };
  }
  const inSprint = sprint.items.some((item) => item.story_id === story.story_id && item.left_at === null);
  const others = storiesToEstimate(sprint, sprintStories).filter((entry) => entry.story_id !== story.story_id);
  const request = toEstimateRequest(sprint, [story, ...others], pinnedConfiguration);
  if (!inSprint && sprint.status === "active" && sprint.started_at) {
    request.stories[0] = toStoryInput(story, { added: true, daysIn: (now - Date.parse(sprint.started_at)) / DAY_MS });
  }
  return { ...request, sprint_id: inSprint ? sprint.sprint_id : null, focus_story_ids: [story.story_id] };
}
