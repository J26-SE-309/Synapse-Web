import { describe, expect, it } from "vitest";

import estimateExample from "../../../contracts/effort-estimation/examples/estimate-request.json";
import sprintContract from "../../../contracts/common/sprint-create.schema.json";
import storyContract from "../../../contracts/common/story-create.schema.json";
import importContract from "../../../contracts/common/story-import.schema.json";
import {
  CAPACITY_MAX,
  COUNT_MAX,
  CRITERIA_MAX,
  CRITERION_MAX,
  DESCRIPTION_MAX,
  EMPTY_STORY,
  EPIC_MAX,
  GOAL_MAX,
  ID_PATTERN,
  LENGTH_MAX,
  LENGTH_MIN,
  MAX_STORIES_PER_IMPORT,
  parseBacklogFile,
  POINTS_MAX,
  SPRINT_ID_MAX,
  SPRINT_NAME_MAX,
  sprintFormSchema,
  STORY_ID_MAX,
  storyFormSchema,
  TITLE_MAX,
  toStory,
} from "./schema";
import { ISSUE_TYPES, PRIORITIES } from "./types";

/** The non-null branch of a pydantic "X | None" field. */
function branch(property: { anyOf?: Record<string, unknown>[] } & Record<string, unknown>) {
  return (property.anyOf?.find((entry) => entry.type !== "null") ?? property) as Record<string, unknown> & {
    items?: Record<string, unknown>;
    enum?: string[];
  };
}

describe("the story and sprint rules", () => {
  it("are the gateway's own (contracts/common/story-create, sprint-create, story-import)", () => {
    const story = storyContract.properties;
    expect(branch(story.story_id).pattern).toBe(ID_PATTERN.source);
    expect(branch(story.story_id).maxLength).toBe(STORY_ID_MAX);
    expect(story.title.maxLength).toBe(TITLE_MAX);
    expect(story.description.maxLength).toBe(DESCRIPTION_MAX);
    expect(story.acceptance_criteria.maxItems).toBe(CRITERIA_MAX);
    expect(story.acceptance_criteria.items.maxLength).toBe(CRITERION_MAX);
    expect(branch(story.story_points).maximum).toBe(POINTS_MAX);
    expect(branch(story.epic).maxLength).toBe(EPIC_MAX);
    expect(story.blocked_by.maximum).toBe(COUNT_MAX);
    expect(branch(story.issue_type).enum).toEqual([...ISSUE_TYPES]);
    expect(branch(story.priority).enum).toEqual([...PRIORITIES]);
    const sprint = sprintContract.properties;
    expect(branch(sprint.sprint_id).pattern).toBe(ID_PATTERN.source);
    expect(branch(sprint.sprint_id).maxLength).toBe(SPRINT_ID_MAX);
    expect(branch(sprint.name).maxLength).toBe(SPRINT_NAME_MAX);
    expect(sprint.goal.maxLength).toBe(GOAL_MAX);
    expect([sprint.length_days.minimum, sprint.length_days.maximum]).toEqual([LENGTH_MIN, LENGTH_MAX]);
    expect(branch(sprint.capacity_points).maximum).toBe(CAPACITY_MAX);
    expect(importContract.properties.stories.maxItems).toBe(MAX_STORIES_PER_IMPORT);
  });

  it("ask for a title and check the numbers", () => {
    const result = storyFormSchema.safeParse({ ...EMPTY_STORY, story_points: "-1", blocked_by: "1.5", story_id: "has space" });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
    expect(messages).toContain("title: Enter the story's title.");
    expect(messages).toContain("story_points: Enter a number from 0 to 1000.");
    expect(messages).toContain("blocked_by: Enter a whole number from 0 to 1000.");
    expect(messages.some((message) => message.startsWith("story_id:"))).toBe(true);
    expect(sprintFormSchema.safeParse({ sprint_id: "", name: "", goal: "", length_days: "0", capacity_points: "0" }).success).toBe(false);
  });

  it("turn the form into the gateway's story: criteria per line, empty boxes as nothing", () => {
    const story = toStory({
      ...EMPTY_STORY,
      title: " Book a session ",
      acceptance_criteria: "- Given a slot\n\n• When I book it\nthen it is mine",
      story_points: "3",
      depends_on: "2",
    });
    expect(story).toEqual({
      title: "Book a session",
      description: "",
      acceptance_criteria: ["Given a slot", "When I book it", "then it is mine"],
      issue_type: "Story",
      priority: null,
      story_points: 3,
      epic: null,
      blocked_by: 0,
      depends_on: 2,
      needed_by: 0,
    });
  });
});

describe("a backlog file", () => {
  it("can be the effort service's estimate request: its fields become the platform's", () => {
    const parsed = parseBacklogFile(
      JSON.stringify({
        _synthetic: "made up",
        sprint_id: "MY-FIRST-PROJECT-S1",
        sprint_context: { length_days: 14, capacity_points: 30 },
        stories: [{ story_id: "MY-FIRST-PROJECT-1", title: "Sign up", blocker_count: 1, dep_out_degree: 2, dep_in_degree: 3, has_epic: true }],
      }),
    );
    expect("backlog" in parsed).toBe(true);
    if (!("backlog" in parsed)) return;
    expect(parsed.backlog.synthetic).toBe(true);
    expect(parsed.backlog.sprint).toEqual({ sprint_id: "MY-FIRST-PROJECT-S1", length_days: 14, capacity_points: 30 });
    expect(parsed.backlog.stories[0]).toMatchObject({ blocked_by: 1, depends_on: 2, needed_by: 3, epic: "Unnamed epic" });
  });

  it("can be the contract's example", () => {
    const parsed = parseBacklogFile(JSON.stringify(estimateExample));
    expect("backlog" in parsed && parsed.backlog.stories.length).toBe(estimateExample.stories.length);
  });

  it("says what is wrong, story by story", () => {
    expect(parseBacklogFile("{")).toEqual({ problems: [expect.stringMatching(/^This is not valid JSON/)] });
    const parsed = parseBacklogFile(JSON.stringify([{ title: "" }, { title: "B", issue_type: "Epic" }]));
    expect("problems" in parsed && parsed.problems).toEqual([
      "Story 1, title: A story needs a title.",
      `Story 2, issue_type: Use one of: ${ISSUE_TYPES.join(", ")}.`,
    ]);
    expect(parseBacklogFile(JSON.stringify([{ story_id: "A-1", title: "x" }, { story_id: "A-1", title: "y" }]))).toEqual({
      problems: ["Two stories use the id A-1."],
    });
  });
});
