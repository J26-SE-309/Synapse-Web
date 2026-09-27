import { describe, expect, it } from "vitest";

import { breadcrumbs, isCurrent, NAV_MODULES, PLATFORM_PAGES } from "@/shared/navigation";

describe("navigation", () => {
  it("lists the four components in pipeline order, with their own pages", () => {
    expect(NAV_MODULES.map((entry) => entry.href)).toEqual([
      "/requirement-quality",
      "/story-refinement",
      "/traceability",
      "/effort-estimation",
    ]);
    const effort = NAV_MODULES.find((entry) => entry.slug === "effort-estimation");
    expect(effort?.pages.map((page) => page.href)).toContain("/effort-estimation/models");
  });

  it("puts the backlog and sprints with the platform, not inside a component", () => {
    expect(PLATFORM_PAGES.map((page) => page.href)).toEqual(["/", "/backlog", "/sprints"]);
    expect(NAV_MODULES.flatMap((entry) => entry.pages.map((page) => page.href))).not.toContain("/effort-estimation/plan");
  });

  it("says where a page is", () => {
    expect(breadcrumbs("/")).toEqual([{ title: "Overview", href: "/" }]);
    expect(breadcrumbs("/traceability").map((crumb) => crumb.title)).toEqual(["Traceability"]);
    expect(breadcrumbs("/effort-estimation").map((crumb) => crumb.title)).toEqual(["Effort & Sprint Risk"]);
    expect(breadcrumbs("/effort-estimation/models").map((crumb) => crumb.title)).toEqual(["Effort & Sprint Risk", "Models"]);
    expect(breadcrumbs("/backlog")).toEqual([{ title: "Backlog", href: "/backlog" }]);
    expect(breadcrumbs("/sprints/TUTOR-S4")).toEqual([
      { title: "Sprints", href: "/sprints" },
      { title: "TUTOR-S4", href: "/sprints/TUTOR-S4" },
    ]);
    expect(breadcrumbs("/effort-estimation/predictions/abc").map((crumb) => crumb.title)).toEqual([
      "Effort & Sprint Risk",
      "Prediction log",
    ]);
    expect(breadcrumbs("/somewhere-else")).toEqual([]);
  });

  it("marks the current page, not a page whose path merely starts the same", () => {
    expect(isCurrent("/effort-estimation/models", "/effort-estimation")).toBe(true);
    expect(isCurrent("/effort-estimation/models", "/effort-estimation", true)).toBe(false);
    expect(isCurrent("/sprints/TUTOR-S4", "/sprints")).toBe(true);
    expect(isCurrent("/effort-estimation-old", "/effort-estimation")).toBe(false);
  });
});
