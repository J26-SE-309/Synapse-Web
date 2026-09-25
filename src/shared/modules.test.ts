import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getModule, MODULES } from "@/shared/modules";

describe("MODULES", () => {
  it("lists the four platform components in pipeline order", () => {
    expect(MODULES.map((entry) => entry.slug)).toEqual([
      "requirement-quality",
      "story-refinement",
      "traceability",
      "effort-estimation",
    ]);
  });

  it("gives every component its own API port", () => {
    const ports = MODULES.map((entry) => entry.apiPort);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("has a page for every component in its owned route folder", () => {
    for (const entry of MODULES) {
      expect(existsSync(join(process.cwd(), "src", "app", "(modules)", entry.slug, "page.tsx"))).toBe(true);
    }
  });
});

describe("getModule", () => {
  it("finds a component by slug", () => {
    expect(getModule("traceability").owner).toBe("dinuwa2500");
  });
});
