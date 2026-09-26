import { describe, expect, it } from "vitest";

import schema from "../../../../../contracts/effort-estimation/estimate-request.schema.json";
import example from "../../../../../contracts/effort-estimation/examples/estimate-request.json";
import { emptyPlan, emptyStory, MAX_STORIES, nextStoryId, parseBacklog, planSchema, PROJECT_MODEL, toRequest } from "./backlog";

function problems(values: ReturnType<typeof emptyPlan>) {
  const result = planSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function plan(stories: Partial<ReturnType<typeof emptyStory>>[], extra: Partial<ReturnType<typeof emptyPlan>> = {}) {
  return {
    ...emptyPlan("TUTOR"),
    ...extra,
    stories: stories.map((story, index) => ({ ...emptyStory("TUTOR", index), title: "A story", ...story })),
  };
}

describe("the sprint-planning rules", () => {
  it("are in step with the service's (contracts/effort-estimation/estimate-request.schema.json)", () => {
    expect(MAX_STORIES).toBe(schema.properties.stories.maxItems);
    expect(schema.properties.stories.minItems).toBe(1);
    const story = schema.$defs.StoryInput.properties;
    expect(story.title.minLength).toBe(1);
    expect(story.story_points.anyOf[0].minimum).toBe(0);
    expect(story.blocker_count.minimum).toBe(0);
    expect(schema.$defs.SprintContext.properties.length_days.anyOf[0].exclusiveMinimum).toBe(0);
    expect(schema.$defs.SprintContext.properties.capacity_points.anyOf[0].exclusiveMinimum).toBe(0);
  });

  it("accept a plain backlog", () => {
    expect(problems(plan([{}, {}]))).toEqual([]);
  });

  it("need a title and an id that no other story uses", () => {
    expect(problems(plan([{ title: "  " }]))).toEqual(["stories.0.title: Enter the story's title."]);
    expect(problems(plan([{ story_id: "TUTOR-1" }, { story_id: "TUTOR-1" }]))).toEqual([
      "stories.1.story_id: Story 1 already uses this id.",
    ]);
  });

  it("check numbers: counts are whole, points and days zero or more, sprint length and capacity above zero", () => {
    expect(problems(plan([{ story_points: "-1", blocker_count: "1.5", dep_in_degree: "x", days_into_sprint: "-2" }]))).toEqual([
      "stories.0.story_points: Enter a number of 0 or more.",
      "stories.0.blocker_count: Enter a whole number of 0 or more.",
      "stories.0.dep_in_degree: Enter a whole number of 0 or more.",
      "stories.0.days_into_sprint: Enter a number of 0 or more.",
    ]);
    expect(problems(plan([{}], { length_days: "0", capacity_points: "-3" }))).toEqual([
      "length_days: Enter a number above 0.",
      "capacity_points: Enter a number above 0.",
    ]);
  });

  it("limit a backlog to 200 stories", () => {
    const many = plan(Array.from({ length: MAX_STORIES + 1 }, (_, index) => ({ story_id: `S-${index}` })));
    expect(problems(many)).toEqual([
      "stories: A backlog can have at most 200 stories. Split it and estimate the parts.",
    ]);
  });
});

describe("the request", () => {
  it("turns the form into the service's request", () => {
    const request = toRequest(
      plan(
        [
          {
            story_id: " TUTOR-1 ",
            description: " Details ",
            acceptance_criteria: "- Given a slot\n\n* When booked\nThen paid ",
            story_points: "3",
            blocker_count: "2",
            has_epic: "no",
            added_mid_sprint: true,
            days_into_sprint: "4",
          },
          { issue_type: "", priority: "Major" },
        ],
        { sprint_id: " TUTOR-S4 ", capacity_points: "30", model: "tfidf-rf" },
      ),
      "TUTOR",
    );
    expect(request).toMatchObject({
      project_id: "TUTOR",
      sprint_id: "TUTOR-S4",
      pinned_configuration: "tfidf-rf",
      sprint_context: { length_days: null, capacity_points: 30 },
    });
    expect(request.stories[0]).toMatchObject({
      story_id: "TUTOR-1",
      description: "Details",
      acceptance_criteria: ["Given a slot", "When booked", "Then paid"],
      story_points: 3,
      blocker_count: 2,
      dep_in_degree: 0,
      has_epic: false,
      days_into_sprint: 4,
    });
    expect(request.stories[1]).toMatchObject({ issue_type: null, priority: "Major", story_points: null, has_epic: null });
  });

  it("leaves the model to the project's setting unless one is chosen", () => {
    expect(toRequest(plan([{}], { model: PROJECT_MODEL }), "TUTOR").pinned_configuration).toBeNull();
    expect(toRequest(plan([{}]), "TUTOR").sprint_context).toBeNull();
  });

  it("numbers new stories after the ones taken", () => {
    expect(nextStoryId("TUTOR", [{ story_id: "TUTOR-1" }, { story_id: "TUTOR-3" }])).toBe("TUTOR-4");
    expect(nextStoryId("TUTOR", [{ story_id: "X" }])).toBe("TUTOR-2");
  });
});

describe("importing a backlog", () => {
  it("reads the contract's example request, keeping the pipeline's signals", () => {
    const result = parseBacklog(JSON.stringify(example));
    expect("backlog" in result).toBe(true);
    if (!("backlog" in result)) return;
    const { values } = result.backlog;
    expect(values.sprint_id).toBe(example.sprint_id);
    expect(values.stories).toHaveLength(example.stories.length);
    expect(values.stories[0].upstream).toEqual(example.stories[0].upstream);
    expect(planSchema.safeParse({ ...emptyPlan(example.project_id), ...values }).success).toBe(true);
    // and it goes back out as it came in
    const request = toRequest({ ...emptyPlan(example.project_id), ...values }, example.project_id);
    expect(request.stories[0]).toMatchObject({ story_id: example.stories[0].story_id, upstream: example.stories[0].upstream });
  });

  it("reads a bare list of stories, and marks synthetic backlogs", () => {
    const list = parseBacklog(JSON.stringify([{ story_id: "A-1", title: "One" }]));
    expect("backlog" in list && list.backlog.values.stories[0].title).toBe("One");
    const synthetic = parseBacklog(JSON.stringify({ _synthetic: "generated", stories: [{ story_id: "A-1", title: "One" }] }));
    expect("backlog" in synthetic && synthetic.backlog.synthetic).toBe(true);
  });

  it("says where a pasted backlog is wrong", () => {
    expect(parseBacklog("{ nope")).toEqual({ problems: [expect.stringMatching(/^This is not valid JSON/)] });
    const wrong = parseBacklog(JSON.stringify({ stories: [{ story_id: "A-1", title: "One", story_points: -2 }] }));
    expect("problems" in wrong && wrong.problems.some((problem) => problem.startsWith("stories[1].story_points"))).toBe(true);
  });
});
