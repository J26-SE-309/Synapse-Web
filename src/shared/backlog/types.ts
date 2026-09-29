/** The platform's backlog and sprints, as the gateway serves them (contracts/common/story*, sprint*). */

export const ISSUE_TYPES = ["Story", "Task", "Bug", "Improvement", "New Feature"] as const;
export const PRIORITIES = ["Blocker", "Critical", "Major", "Minor", "Trivial"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type StoryStatus = "to_do" | "in_progress" | "done";
export type SprintStatus = "planned" | "active" | "closed";

export interface Story {
  project_id: string;
  story_id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  issue_type: IssueType | null;
  priority: Priority | null;
  story_points: number | null;
  epic: string | null;
  blocked_by: number;
  depends_on: number;
  needed_by: number;
  status: StoryStatus;
  /** Its place in the backlog and in its sprint: lower comes first. */
  rank: number;
  /** The sprint it is in now; null in the backlog. */
  sprint_id: string | null;
  source: "manual" | "import" | "refinement";
  /** Made-up data for development and demonstrations, never evidence. */
  synthetic: boolean;
  started_at: string | null;
  resolved_at: string | null;
  reopened: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryCreate {
  story_id?: string | null;
  title: string;
  description?: string;
  acceptance_criteria?: string[];
  issue_type?: IssueType | null;
  priority?: Priority | null;
  story_points?: number | null;
  epic?: string | null;
  blocked_by?: number;
  depends_on?: number;
  needed_by?: number;
}

export type StoryUpdate = Partial<Omit<StoryCreate, "story_id">> & {
  status?: StoryStatus;
  /** A sprint's id moves the story into it; null takes it back to the backlog. */
  sprint_id?: string | null;
  /** Its new place: lower comes first. */
  rank?: number;
};

export interface SprintItem {
  story_id: string;
  committed_at: string | null;
  added_mid_sprint: boolean;
  points_at_commit: number | null;
  left_at: string | null;
  points_at_close: number | null;
  done_in_sprint: boolean | null;
}

export interface EffortSync {
  status: "not_sent" | "sent" | "failed";
  sent_at: string | null;
  error: string | null;
}

export interface Sprint {
  project_id: string;
  sprint_id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  length_days: number;
  capacity_points: number | null;
  started_at: string | null;
  planned_end: string | null;
  closed_at: string | null;
  created_at: string;
  /** Every story that has been in the sprint, including ones taken out (left_at). */
  items: SprintItem[];
  effort_sync: EffortSync;
}

export interface SprintCreate {
  sprint_id?: string | null;
  name?: string | null;
  goal?: string;
  length_days?: number;
  capacity_points?: number | null;
}

export type SprintUpdate = Partial<Omit<SprintCreate, "sprint_id">>;

export interface StoryImport {
  stories: StoryCreate[];
  synthetic?: boolean;
  sprint?: SprintCreate | null;
}

export interface ImportResult {
  stories: Story[];
  sprint: Sprint | null;
}

export const STATUS_LABELS: Record<StoryStatus, string> = { to_do: "To do", in_progress: "In progress", done: "Done" };
export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = { planned: "Planned", active: "Active", closed: "Closed" };

/** The stories in a sprint now (not the ones taken out), in backlog order. */
export function storiesIn(sprint: Sprint, stories: Story[]): Story[] {
  const byId = new Map(stories.map((story) => [story.story_id, story]));
  return sprint.items
    .filter((item) => item.left_at === null)
    .flatMap((item) => byId.get(item.story_id) ?? [])
    .sort(byRank);
}

export function byRank(a: Pick<Story, "rank" | "story_id">, b: Pick<Story, "rank" | "story_id">): number {
  return a.rank - b.rank || a.story_id.localeCompare(b.story_id, undefined, { numeric: true });
}

/** A rank that puts a story between two neighbours (either may be missing: the start or end of a list). */
export function rankBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export function totalPoints(stories: Pick<Story, "story_points">[]): number {
  return stories.reduce((sum, story) => sum + (story.story_points ?? 0), 0);
}
