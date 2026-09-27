import { z } from "zod";

import { ISSUE_TYPES, PRIORITIES, type SprintCreate, type Story, type StoryCreate } from "./types";

/**
 * The rules for stories and sprints, checked in the browser before anything is sent. They are the gateway's own
 * (contracts/common/story-create.schema.json, sprint-create.schema.json); a test keeps the two in step.
 */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const STORY_ID_MAX = 200;
export const TITLE_MAX = 300;
export const DESCRIPTION_MAX = 10000;
export const CRITERIA_MAX = 30;
export const CRITERION_MAX = 1000;
export const POINTS_MAX = 1000;
export const COUNT_MAX = 1000;
export const EPIC_MAX = 200;
export const MAX_STORIES_PER_IMPORT = 200;
export const SPRINT_ID_MAX = 100;
export const SPRINT_NAME_MAX = 80;
export const GOAL_MAX = 1000;
export const LENGTH_MIN = 1;
export const LENGTH_MAX = 60;
export const CAPACITY_MAX = 10000;

/** A number typed in a box: empty is allowed (optional), anything else must be a number in range. */
function numberText({ min = 0, max, integer = false, exclusive = false }: { min?: number; max: number; integer?: boolean; exclusive?: boolean }) {
  const wanted = integer ? "a whole number" : "a number";
  return z
    .string()
    .trim()
    .refine((text) => {
      if (text === "") return true;
      const value = Number(text);
      if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return false;
      return (exclusive ? value > min : value >= min) && value <= max;
    }, exclusive ? `Enter ${wanted} above ${min}, up to ${max}.` : `Enter ${wanted} from ${min} to ${max}.`);
}

function idText(max: number, what: string) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .refine((id) => id === "" || ID_PATTERN.test(id), `Start ${what} with a letter or digit, then use letters, digits, dots, hyphens or underscores only.`);
}

export const storyFormSchema = z.object({
  story_id: idText(STORY_ID_MAX, "the id"),
  title: z.string().trim().min(1, "Enter the story's title.").max(TITLE_MAX, `Use at most ${TITLE_MAX} characters.`),
  description: z.string().trim().max(DESCRIPTION_MAX, `Use at most ${DESCRIPTION_MAX} characters.`),
  acceptance_criteria: z
    .string()
    .superRefine((text, context) => {
      const lines = criteriaLines(text);
      if (lines.length > CRITERIA_MAX) context.addIssue({ code: "custom", message: `Use at most ${CRITERIA_MAX} criteria.` });
      if (lines.some((line) => line.length > CRITERION_MAX)) {
        context.addIssue({ code: "custom", message: `Keep each criterion to ${CRITERION_MAX} characters.` });
      }
    }),
  issue_type: z.string(),
  priority: z.string(),
  story_points: numberText({ max: POINTS_MAX }),
  epic: z.string().trim().max(EPIC_MAX, `Use at most ${EPIC_MAX} characters.`),
  blocked_by: numberText({ max: COUNT_MAX, integer: true }),
  depends_on: numberText({ max: COUNT_MAX, integer: true }),
  needed_by: numberText({ max: COUNT_MAX, integer: true }),
});

export type StoryFormValues = z.infer<typeof storyFormSchema>;

export const EMPTY_STORY: StoryFormValues = {
  story_id: "",
  title: "",
  description: "",
  acceptance_criteria: "",
  issue_type: "Story",
  priority: "",
  story_points: "",
  epic: "",
  blocked_by: "",
  depends_on: "",
  needed_by: "",
};

/** One criterion per line; list markers people paste in are dropped. */
export function criteriaLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

const count = (text: string) => (text.trim() === "" ? 0 : Number(text));
const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

/** The checked form as the gateway's story (the id only when one was typed: otherwise the next free one). */
export function toStory(values: StoryFormValues): StoryCreate {
  return {
    ...(values.story_id.trim() ? { story_id: values.story_id.trim() } : {}),
    title: values.title.trim(),
    description: values.description.trim(),
    acceptance_criteria: criteriaLines(values.acceptance_criteria),
    issue_type: (orNull(values.issue_type) as StoryCreate["issue_type"]) ?? null,
    priority: (orNull(values.priority) as StoryCreate["priority"]) ?? null,
    story_points: values.story_points.trim() === "" ? null : Number(values.story_points),
    epic: orNull(values.epic),
    blocked_by: count(values.blocked_by),
    depends_on: count(values.depends_on),
    needed_by: count(values.needed_by),
  };
}

/** A story as the form shows it, for editing. */
export function toFormValues(story: Story): StoryFormValues {
  const text = (value: number | null) => (value === null || value === 0 ? "" : String(value));
  return {
    story_id: story.story_id,
    title: story.title,
    description: story.description,
    acceptance_criteria: story.acceptance_criteria.join("\n"),
    issue_type: story.issue_type ?? "",
    priority: story.priority ?? "",
    story_points: story.story_points === null ? "" : String(story.story_points),
    epic: story.epic ?? "",
    blocked_by: text(story.blocked_by),
    depends_on: text(story.depends_on),
    needed_by: text(story.needed_by),
  };
}

export const sprintFormSchema = z.object({
  sprint_id: idText(SPRINT_ID_MAX, "the id"),
  name: z.string().trim().max(SPRINT_NAME_MAX, `Use at most ${SPRINT_NAME_MAX} characters.`),
  goal: z.string().trim().max(GOAL_MAX, `Use at most ${GOAL_MAX} characters.`),
  length_days: z
    .string()
    .trim()
    .min(1, "Enter the sprint's length in days.")
    .refine((text) => {
      const value = Number(text);
      return Number.isInteger(value) && value >= LENGTH_MIN && value <= LENGTH_MAX;
    }, `Enter a whole number of days from ${LENGTH_MIN} to ${LENGTH_MAX}.`),
  capacity_points: numberText({ max: CAPACITY_MAX, exclusive: true }),
});

export type SprintFormValues = z.infer<typeof sprintFormSchema>;

export const EMPTY_SPRINT: SprintFormValues = { sprint_id: "", name: "", goal: "", length_days: "14", capacity_points: "" };

export function toSprint(values: SprintFormValues): SprintCreate {
  return {
    ...(values.sprint_id.trim() ? { sprint_id: values.sprint_id.trim() } : {}),
    ...(values.name.trim() ? { name: values.name.trim() } : {}),
    goal: values.goal.trim(),
    length_days: Number(values.length_days),
    capacity_points: values.capacity_points.trim() === "" ? null : Number(values.capacity_points),
  };
}

// ------------------------------------------------------------------------------------------- importing a backlog

/**
 * A story in a backlog file: the platform's own fields, or the effort service's estimate-request ones
 * (blocker_count, dep_out_degree, dep_in_degree, has_epic), so a backlog made for either imports.
 */
const fileStory = z.object({
  story_id: z.string().trim().max(STORY_ID_MAX).regex(ID_PATTERN, "Use letters, digits, dots, hyphens or underscores.").optional(),
  title: z.string().trim().min(1, "A story needs a title.").max(TITLE_MAX),
  description: z.string().max(DESCRIPTION_MAX).optional(),
  acceptance_criteria: z.array(z.string().trim().min(1).max(CRITERION_MAX)).max(CRITERIA_MAX).optional(),
  issue_type: z.enum(ISSUE_TYPES, { message: `Use one of: ${ISSUE_TYPES.join(", ")}.` }).nullable().optional(),
  priority: z.enum(PRIORITIES, { message: `Use one of: ${PRIORITIES.join(", ")}.` }).nullable().optional(),
  story_points: z.number().min(0).max(POINTS_MAX).nullable().optional(),
  epic: z.string().trim().max(EPIC_MAX).nullable().optional(),
  has_epic: z.boolean().nullable().optional(),
  blocked_by: z.number().int().min(0).max(COUNT_MAX).optional(),
  depends_on: z.number().int().min(0).max(COUNT_MAX).optional(),
  needed_by: z.number().int().min(0).max(COUNT_MAX).optional(),
  blocker_count: z.number().int().min(0).max(COUNT_MAX).optional(),
  dep_out_degree: z.number().int().min(0).max(COUNT_MAX).optional(),
  dep_in_degree: z.number().int().min(0).max(COUNT_MAX).optional(),
});

const storyList = z
  .array(fileStory)
  .min(1, "The backlog has no stories.")
  .max(MAX_STORIES_PER_IMPORT, `Import at most ${MAX_STORIES_PER_IMPORT} stories at a time.`);

const backlogObject = z.object({
  sprint_id: z.string().trim().max(SPRINT_ID_MAX).regex(ID_PATTERN).nullable().optional(),
  sprint_context: z
    .object({ length_days: z.number().gt(0).nullable().optional(), capacity_points: z.number().gt(0).nullable().optional() })
    .nullable()
    .optional(),
  stories: storyList,
  _synthetic: z.unknown().optional(),
});

export interface ParsedBacklog {
  stories: StoryCreate[];
  /** The file says its stories are made up (_synthetic): they are labelled so. */
  synthetic: boolean;
  /** The sprint the file names, offered as a new planned sprint. */
  sprint: SprintCreate | null;
}

export function parseBacklogFile(text: string): { backlog: ParsedBacklog } | { problems: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { problems: [`This is not valid JSON: ${(error as Error).message}`] };
  }
  // A list of stories, or a backlog object; checked by shape so each problem names its story.
  const parsed = Array.isArray(data) ? storyList.safeParse(data) : backlogObject.safeParse(data);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.slice(0, 20).map((issue) => {
        // "Story 2, issue_type" for a story's field; the backlog's own fields by name.
        const path = issue.path[0] === "stories" ? issue.path.slice(1) : issue.path;
        const [first, ...rest] = path;
        const where = [
          typeof first === "number" ? `Story ${first + 1}` : first === undefined ? "Backlog" : String(first),
          ...rest.map((part) => (typeof part === "number" ? `item ${part + 1}` : String(part))),
        ].join(", ");
        return `${where}: ${issue.message}`;
      }),
    };
  }
  const file = parsed.data;
  const list = Array.isArray(file) ? file : file.stories;
  const ids = list.map((story) => story.story_id).filter(Boolean);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) return { problems: [`Two stories use the id ${duplicate}.`] };
  const stories = list.map(
    (story): StoryCreate => ({
      ...(story.story_id ? { story_id: story.story_id } : {}),
      title: story.title,
      description: story.description?.trim() ?? "",
      acceptance_criteria: story.acceptance_criteria ?? [],
      issue_type: story.issue_type ?? null,
      priority: story.priority ?? null,
      story_points: story.story_points ?? null,
      epic: story.epic ?? (story.has_epic ? "Unnamed epic" : null),
      blocked_by: story.blocked_by ?? story.blocker_count ?? 0,
      depends_on: story.depends_on ?? story.dep_out_degree ?? 0,
      needed_by: story.needed_by ?? story.dep_in_degree ?? 0,
    }),
  );
  const sprint =
    !Array.isArray(file) && file.sprint_id
      ? {
          sprint_id: file.sprint_id,
          length_days: Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, Math.round(file.sprint_context?.length_days ?? 14))),
          capacity_points: file.sprint_context?.capacity_points ?? null,
        }
      : null;
  return { backlog: { stories, synthetic: !Array.isArray(file) && file._synthetic !== undefined, sprint } };
}
