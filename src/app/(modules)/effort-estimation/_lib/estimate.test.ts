import { describe, expect, it } from "vitest";

import { ACTIVE, story } from "@/test/backlog-fixtures";

import requestSchema from "../../../../../contracts/effort-estimation/estimate-request.schema.json";
import { storiesToEstimate, toEstimateRequest } from "./estimate";

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
