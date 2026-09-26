import { describe, expect, it } from "vitest";

import { breadcrumbs, isCurrent, NAV_MODULES } from "@/shared/navigation";

describe("navigation", () => {
  it("lists the four components in pipeline order, with their own pages", () => {
    expect(NAV_MODULES.map((entry) => entry.href)).toEqual([
      "/requirement-quality",
      "/story-refinement",
      "/traceability",
      "/effort-estimation",
    ]);
    const effort = NAV_MODULES.find((entry) => entry.slug === "effort-estimation");
    expect(effort?.pages.map((page) => page.href)).toContain("/effort-estimation/plan");
  });

  it("says where a page is", () => {
    expect(breadcrumbs("/")).toEqual([{ title: "Overview", href: "/" }]);
    expect(breadcrumbs("/traceability").map((crumb) => crumb.title)).toEqual(["Traceability"]);
    expect(breadcrumbs("/effort-estimation").map((crumb) => crumb.title)).toEqual(["Effort & Sprint Risk"]);
    expect(breadcrumbs("/effort-estimation/plan").map((crumb) => crumb.title)).toEqual(["Effort & Sprint Risk", "Sprint planning"]);
    expect(breadcrumbs("/effort-estimation/predictions/abc").map((crumb) => crumb.title)).toEqual([
      "Effort & Sprint Risk",
      "Prediction log",
    ]);
    expect(breadcrumbs("/somewhere-else")).toEqual([]);
  });

  it("marks the current page, not a page whose path merely starts the same", () => {
    expect(isCurrent("/effort-estimation/plan", "/effort-estimation")).toBe(true);
    expect(isCurrent("/effort-estimation/plan", "/effort-estimation", true)).toBe(false);
    expect(isCurrent("/effort-estimation-old", "/effort-estimation")).toBe(false);
  });
});
