import { describe, expect, it } from "vitest";

import { ACTIVE, story } from "@/test/backlog-fixtures";

import requestSchema from "../../../../../contracts/effort-estimation/estimate-request.schema.json";
import { storiesToEstimate, toEstimateRequest, toStoryPrediction } from "./estimate";

describe("a platform sprint as an estimate request", () => {
  const stories = [
    story("TUTOR-1", { status: "in_progress", epic: "Booking", blocked_by: 1, depends_on: 2, needed_by: 3, priority: "Major" }),
    story("TUTOR-2"),
    story("TUTOR-3", { status: "done" }),
  ];

  it("leaves out the stories already done in an active sprint", () => {
    expect(storiesToEstimate(ACTIVE, stories).map((entry) => entry.story_id)).toEqual(["TUTOR-1", "TUTOR-2"]);
    expect(storiesToEstimate({ ...ACTIVE, status: "planned" }, stories)).toHaveLength(3);
  });

  it("says where each story stands in the sprint", () => {
    const request = toEstimateRequest(ACTIVE, storiesToEstimate(ACTIVE, stories), null);
    expect(request).toMatchObject({
      project_id: "TUTOR",
      sprint_id: "TUTOR-S4",
      pinned_configuration: null,
      sprint_context: { length_days: 14, capacity_points: 30 },
    });
    expect(request.stories[0]).toMatchObject({
      story_id: "TUTOR-1",
      in_progress: true,
      has_epic: true,
      blocker_count: 1,
      dep_out_degree: 2,
      dep_in_degree: 3,
      added_mid_sprint: false,
      days_into_sprint: 0,
    });
    expect(request.stories[1]).toMatchObject({ story_id: "TUTOR-2", has_epic: false, added_mid_sprint: true, days_into_sprint: 3 });
  });

  it("uses only fields the service knows (contracts/effort-estimation/estimate-request.schema.json)", () => {
    const request = toEstimateRequest(ACTIVE, stories, "tfidf-svm");
    const storyFields = Object.keys(requestSchema.$defs.StoryInput.properties);
    for (const entry of request.stories) for (const key of Object.keys(entry)) expect(storyFields).toContain(key);
    for (const key of Object.keys(request)) expect(Object.keys(requestSchema.properties)).toContain(key);
  });
});

describe("one story's prediction", () => {
  const signals = { ambiguity_score: 0.2, ac_completeness_score: 0.8, source: "platform" };
  const sprintStories = [
    story("TUTOR-1", { upstream: signals }),
    story("TUTOR-2"),
    story("TUTOR-3", { status: "done" }),
  ];
  const now = Date.parse("2026-09-19T09:00:00Z");

  it("sends the rest of the sprint as context but predicts only the story", () => {
    const request = toStoryPrediction({ projectId: "TUTOR", story: sprintStories[0], sprint: ACTIVE, sprintStories, pinnedConfiguration: null, now });
    expect(request.focus_story_ids).toEqual(["TUTOR-1"]);
    expect(request.stories.map((entry) => entry.story_id)).toEqual(["TUTOR-1", "TUTOR-2"]); // done work has no risk left
    expect(request.sprint_id).toBe("TUTOR-S4"); // in the sprint: its outcome is recorded at the close
    expect(request.stories[0].upstream).toEqual(signals);
    expect(request.stories[1]).not.toHaveProperty("upstream");
  });

  it("treats a story from outside the sprint as added to it now, without the sprint's id", () => {
    const outside = story("TUTOR-9", { sprint_id: null });
    const request = toStoryPrediction({ projectId: "TUTOR", story: outside, sprint: ACTIVE, sprintStories, pinnedConfiguration: "tfidf-rf", now });
    expect(request).toMatchObject({ sprint_id: null, pinned_configuration: "tfidf-rf", sprint_context: { length_days: 14, capacity_points: 30 } });
    expect(request.stories[0]).toMatchObject({ story_id: "TUTOR-9", added_mid_sprint: true, days_into_sprint: 5 });
    expect(request.stories).toHaveLength(3);
  });

  it("predicts a story on its own without a sprint", () => {
    const request = toStoryPrediction({ projectId: "TUTOR", story: story("TUTOR-9"), sprint: null, sprintStories: [], pinnedConfiguration: null });
    expect(request).toMatchObject({ sprint_id: null, focus_story_ids: ["TUTOR-9"] });
    expect(request.stories).toHaveLength(1);
    for (const key of Object.keys(request)) expect(Object.keys(requestSchema.properties)).toContain(key);
  });
});
