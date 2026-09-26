import { z } from "zod";

import type { EstimateRequest, StoryInput } from "./types";

/**
 * The sprint-planning form and its rules, checked in the browser before anything is sent. The limits are the
 * service's own (contracts/effort-estimation/estimate-request.schema.json; a test keeps them in step); numbers
 * are typed as text and turned into numbers only once they pass.
 */

export const MAX_STORIES = 200;
export const MAX_ID_LENGTH = 200; // the service stores story ids in 200 characters
export const MAX_SPRINT_ID_LENGTH = 100;
export const ISSUE_TYPES = ["Story", "Task", "Bug", "Improvement", "New Feature"] as const;
export const PRIORITIES = ["Blocker", "Critical", "Major", "Minor", "Trivial"] as const;

/** A number box: empty is allowed (unknown); otherwise a number at or above `min` (or above it if exclusive). */
function numberText({ min = 0, exclusive = false, integer = false }: { min?: number; exclusive?: boolean; integer?: boolean }) {
  const wanted = integer ? "a whole number" : "a number";
  const bound = exclusive ? `above ${min}` : `of ${min} or more`;
  return z
    .string()
    .trim()
    .refine((text) => {
      if (text === "") return true;
      const value = Number(text);
      if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return false;
      return exclusive ? value > min : value >= min;
    }, `Enter ${wanted} ${bound}.`);
}

const storySchema = z.object({
  story_id: z
    .string()
    .trim()
    .min(1, "Give the story an id.")
    .max(MAX_ID_LENGTH, `Use at most ${MAX_ID_LENGTH} characters.`),
  title: z.string().trim().min(1, "Enter the story's title."),
  description: z.string(),
  acceptance_criteria: z.string(),
  issue_type: z.string(),
  priority: z.string(),
  story_points: numberText({}),
  blocker_count: numberText({ integer: true }),
  dep_in_degree: numberText({ integer: true }),
  dep_out_degree: numberText({ integer: true }),
  has_epic: z.enum(["unknown", "yes", "no"]),
  in_progress: z.boolean(),
  added_mid_sprint: z.boolean(),
  days_into_sprint: numberText({}),
  /** Signals from Components 1-3 when the backlog came from the pipeline; passed on unchanged. */
  upstream: z.record(z.string(), z.unknown()).optional(),
});

export const planSchema = z.object({
  sprint_id: z.string().trim().max(MAX_SPRINT_ID_LENGTH, `Use at most ${MAX_SPRINT_ID_LENGTH} characters.`),
  length_days: numberText({ exclusive: true }),
  capacity_points: numberText({ exclusive: true }),
  model: z.string(),
  stories: z
    .array(storySchema)
    .min(1, "Add at least one story.")
    .max(MAX_STORIES, `A backlog can have at most ${MAX_STORIES} stories. Split it and estimate the parts.`)
    .superRefine((stories, context) => {
      const seen = new Map<string, number>();
      stories.forEach((story, index) => {
        const id = story.story_id.trim();
        if (!id) return;
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            path: [index, "story_id"],
            message: `Story ${seen.get(id)! + 1} already uses this id.`,
          });
        } else {
          seen.set(id, index);
        }
      });
    }),
});

export type StoryValues = z.infer<typeof storySchema>;
export type PlanValues = z.infer<typeof planSchema>;

/** "Use the project's setting": the pinned configuration if there is one, else automatic selection. */
export const PROJECT_MODEL = "project";

export function emptyStory(projectId: string, index: number): StoryValues {
  return {
    story_id: `${projectId}-${index + 1}`,
    title: "",
    description: "",
    acceptance_criteria: "",
    issue_type: "Story",
    priority: "",
    story_points: "",
    blocker_count: "",
    dep_in_degree: "",
    dep_out_degree: "",
    has_epic: "unknown",
    in_progress: false,
    added_mid_sprint: false,
    days_into_sprint: "",
  };
}

export function emptyPlan(projectId: string): PlanValues {
  return { sprint_id: "", length_days: "", capacity_points: "", model: PROJECT_MODEL, stories: [emptyStory(projectId, 0)] };
}

/** The next free id like PROJECT-7 for a story added to the form. */
export function nextStoryId(projectId: string, stories: { story_id: string }[]): string {
  const taken = new Set(stories.map((story) => story.story_id.trim()));
  let index = stories.length;
  while (taken.has(`${projectId}-${index + 1}`)) index += 1;
  return `${projectId}-${index + 1}`;
}

const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text));
const count = (text: string) => (text.trim() === "" ? 0 : Number(text));

/** The checked form as the service's request. */
export function toRequest(values: PlanValues, projectId: string): EstimateRequest {
  const lengthDays = numberOrNull(values.length_days);
  const capacity = numberOrNull(values.capacity_points);
  return {
    project_id: projectId,
    sprint_id: values.sprint_id.trim() || null,
    pinned_configuration: values.model === PROJECT_MODEL ? null : values.model,
    sprint_context:
      lengthDays !== null || capacity !== null ? { length_days: lengthDays, capacity_points: capacity } : null,
    stories: values.stories.map(
      (story): StoryInput => ({
        story_id: story.story_id.trim(),
        title: story.title.trim(),
        description: story.description.trim(),
        acceptance_criteria: story.acceptance_criteria
          .split("\n")
          .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
          .filter(Boolean),
        issue_type: story.issue_type || null,
        priority: story.priority || null,
        story_points: numberOrNull(story.story_points),
        blocker_count: count(story.blocker_count),
        dep_in_degree: count(story.dep_in_degree),
        dep_out_degree: count(story.dep_out_degree),
        has_epic: story.has_epic === "unknown" ? null : story.has_epic === "yes",
        in_progress: story.in_progress,
        added_mid_sprint: story.added_mid_sprint,
        days_into_sprint: story.added_mid_sprint ? count(story.days_into_sprint) : 0,
        ...(story.upstream ? { upstream: story.upstream } : {}),
      }),
    ),
  };
}

// ------------------------------------------------------------------------------------------- importing a backlog

const text = (value: unknown) => (value == null ? "" : String(value));

/** A story as the service takes it (estimate-request.schema.json's StoryInput), for checking a pasted backlog. */
const importedStory = z.object({
  story_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  issue_type: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  story_points: z.number().min(0).nullable().optional(),
  blocker_count: z.number().int().min(0).optional(),
  dep_in_degree: z.number().int().min(0).optional(),
  dep_out_degree: z.number().int().min(0).optional(),
  has_epic: z.boolean().nullable().optional(),
  in_progress: z.boolean().optional(),
  added_mid_sprint: z.boolean().optional(),
  days_into_sprint: z.number().min(0).optional(),
  upstream: z.record(z.string(), z.unknown()).optional(),
});

const importedBacklog = z.union([
  z.object({
    sprint_id: z.string().nullable().optional(),
    stories: z.array(importedStory).min(1).max(MAX_STORIES),
    sprint_context: z
      .object({ length_days: z.number().gt(0).nullable().optional(), capacity_points: z.number().gt(0).nullable().optional() })
      .nullable()
      .optional(),
    _synthetic: z.unknown().optional(),
  }),
  z.array(importedStory).min(1).max(MAX_STORIES),
]);

export interface ImportedBacklog {
  values: Pick<PlanValues, "sprint_id" | "length_days" | "capacity_points" | "stories">;
  synthetic: boolean;
}

/** A pasted backlog (an estimate request, or just its stories) as form values, or the problems with it. */
export function parseBacklog(json: string): { backlog: ImportedBacklog } | { problems: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    return { problems: [`This is not valid JSON: ${(error as Error).message}`] };
  }
  const parsed = importedBacklog.safeParse(data);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.slice(0, 20).map((issue) => {
        const where = issue.path.map((part) => (typeof part === "number" ? `[${part + 1}]` : `.${String(part)}`)).join("");
        return `${where.replace(/^\./, "") || "backlog"}: ${issue.message}`;
      }),
    };
  }
  const backlog = parsed.data;
  const stories = Array.isArray(backlog) ? backlog : backlog.stories;
  const sprint = Array.isArray(backlog) ? undefined : backlog;
  return {
    backlog: {
      synthetic: !Array.isArray(backlog) && backlog._synthetic !== undefined,
      values: {
        sprint_id: text(sprint?.sprint_id),
        length_days: text(sprint?.sprint_context?.length_days),
        capacity_points: text(sprint?.sprint_context?.capacity_points),
        stories: stories.map((story) => ({
          story_id: story.story_id,
          title: story.title,
          description: story.description ?? "",
          acceptance_criteria: (story.acceptance_criteria ?? []).join("\n"),
          issue_type: story.issue_type ?? "",
          priority: story.priority ?? "",
          story_points: text(story.story_points),
          blocker_count: story.blocker_count ? String(story.blocker_count) : "",
          dep_in_degree: story.dep_in_degree ? String(story.dep_in_degree) : "",
          dep_out_degree: story.dep_out_degree ? String(story.dep_out_degree) : "",
          has_epic: story.has_epic == null ? "unknown" : story.has_epic ? "yes" : "no",
          in_progress: story.in_progress ?? false,
          added_mid_sprint: story.added_mid_sprint ?? false,
          days_into_sprint: story.days_into_sprint ? String(story.days_into_sprint) : "",
          ...(story.upstream ? { upstream: story.upstream } : {}),
        })),
      },
    },
  };
}
