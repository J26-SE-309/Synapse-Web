import { describe, expect, it } from "vitest";

import { ACTIVE, story } from "@/test/backlog-fixtures";

import { BACKLOG_SECTION, daysLeft, matches, NO_FILTERS, placeAt, planningSections, rankAfterStep, rankAtEnd, sectionOf } from "./planning";
import { rankBetween, type Sprint } from "./types";

const PLANNED: Sprint = { ...ACTIVE, sprint_id: "TUTOR-S5", name: "Sprint 5", status: "planned", created_at: "2026-09-12T10:00:00Z" };
const CLOSED: Sprint = { ...ACTIVE, sprint_id: "TUTOR-S3", name: "Sprint 3", status: "closed" };

describe("the backlog's planning view", () => {
  const stories = [
    story("TUTOR-1", { rank: 3 }),
    story("TUTOR-2", { rank: 1 }),
    story("TUTOR-3", { sprint_id: "TUTOR-S5", rank: 2 }),
    story("TUTOR-4", { sprint_id: null, rank: 2 }),
    story("TUTOR-5", { sprint_id: null, rank: 1, epic: "Booking", issue_type: "Bug" }),
    story("TUTOR-6", { sprint_id: "TUTOR-S3", status: "done" }),
  ];

  it("shows the active sprint, then planned ones, then the backlog, each in rank order (closed sprints stay out)", () => {
    const sections = planningSections(stories, [PLANNED, CLOSED, ACTIVE]);
    expect(sections.map((section) => section.id)).toEqual([sectionOf("TUTOR-S4"), sectionOf("TUTOR-S5"), BACKLOG_SECTION]);
    expect(sections.map((section) => section.stories.map((entry) => entry.story_id))).toEqual([
      ["TUTOR-2", "TUTOR-1"],
      ["TUTOR-3"],
      ["TUTOR-5", "TUTOR-4"],
    ]);
  });

  it("puts a dropped story between its new neighbours", () => {
    expect(rankBetween(undefined, undefined)).toBe(1);
    expect(rankBetween(undefined, 4)).toBe(3);
    expect(rankBetween(4, undefined)).toBe(5);
    expect(rankBetween(1, 2)).toBe(1.5);
    const list = [story("A-1", { rank: 1 }), story("A-2", { rank: 2 }), story("A-3", { rank: 4 })];
    expect(placeAt(list, 0)).toBe(0);
    expect(placeAt(list, 2)).toBe(3);
    expect(placeAt(list, 3)).toBe(5);
  });

  it("moves a story one place, or to either end, from its menu", () => {
    const list = [story("A-1", { rank: 1 }), story("A-2", { rank: 2 }), story("A-3", { rank: 3 })];
    expect(rankAfterStep(list, "A-3", -1)).toBe(1.5);
    expect(rankAfterStep(list, "A-1", 1)).toBe(2.5);
    expect(rankAfterStep(list, "A-1", -1)).toBeNull();
    expect(rankAtEnd(list, "A-3", "top")).toBe(0);
    expect(rankAtEnd(list, "A-1", "bottom")).toBe(4);
  });

  it("filters by text, type, priority and epic", () => {
    const bug = stories[4];
    expect(matches(bug, { ...NO_FILTERS, text: "booking" })).toBe(true);
    expect(matches(bug, { ...NO_FILTERS, type: "Bug", epic: "Booking" })).toBe(true);
    expect(matches(bug, { ...NO_FILTERS, type: "Story" })).toBe(false);
  });

  it("counts the days left in an active sprint", () => {
    const now = Date.parse("2026-09-26T09:00:00Z");
    expect(daysLeft(ACTIVE, now)).toBe(2);
    expect(daysLeft(PLANNED, now)).toBeNull();
  });
});
