import { describe, expect, it } from "vitest";

import contract from "../../../contracts/common/project-create.schema.json";
import {
  normaliseProjectId,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_ID_MAX,
  PROJECT_ID_MIN,
  PROJECT_ID_PATTERN,
  PROJECT_NAME_MAX,
  projectCreateSchema,
  suggestProjectId,
} from "@/shared/projects/schema";

const valid = { name: "Tutoring app", id: "TUTOR", description: "" };

function problems(values: Record<string, string>, existing: string[] = []) {
  const result = projectCreateSchema(existing).safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("the new-project rules", () => {
  it("are the gateway's own (contracts/common/project-create.schema.json)", () => {
    expect(PROJECT_ID_PATTERN.source).toBe(contract.properties.id.pattern);
    expect(PROJECT_ID_MIN).toBe(contract.properties.id.minLength);
    expect(PROJECT_ID_MAX).toBe(contract.properties.id.maxLength);
    expect(PROJECT_NAME_MAX).toBe(contract.properties.name.maxLength);
    expect(PROJECT_DESCRIPTION_MAX).toBe(contract.properties.description.maxLength);
  });

  it("accept short capital keys", () => {
    for (const id of ["TUTOR", "SYN-STEADY", "A1", "TEAM-2-WEB"]) expect(problems({ id })).toEqual([]);
  });

  it.each([
    ["", "Enter a project key."],
    ["T", "Use at least 2 characters."],
    ["A".repeat(33), "Use at most 32 characters."],
    ["tutor", "Use capital letters (A–Z), digits and hyphens only."],
    ["MY APP", "Use capital letters (A–Z), digits and hyphens only."],
    ["1ST", "Start with a capital letter."],
    ["-SYN", "Start with a capital letter."],
    ["SYN--X", "Put a letter or digit on both sides of every hyphen."],
    ["SYN-", "Put a letter or digit on both sides of every hyphen."],
  ])("explain what is wrong with the key %j", (id, message) => {
    expect(problems({ id })).toContain(message);
  });

  it("catch a key that is already used before anything is sent", () => {
    expect(problems({ id: "TUTOR" }, ["TUTOR"])).toEqual(["A project with this key already exists."]);
  });

  it("need a name and keep names and descriptions within the limits", () => {
    expect(problems({ name: "   " })).toEqual(["Enter a name for the project."]);
    expect(problems({ name: "x".repeat(81) })).toEqual(["Use at most 80 characters."]);
    expect(problems({ description: "x".repeat(501) })).toEqual(["Use at most 500 characters."]);
  });
});

describe("project keys", () => {
  it("are suggested from the name", () => {
    expect(suggestProjectId("Tutoring app")).toBe("TUTORING-APP");
    expect(suggestProjectId("  Café  booking!! ")).toBe("CAFE-BOOKING");
    expect(suggestProjectId("2026 web project")).toBe("WEB-PROJECT");
    expect(suggestProjectId("a very long project name that keeps going and going")).toBe("A-VERY-LONG-PROJECT-NAME-THAT");
    expect(suggestProjectId("!!!")).toBe("");
  });

  it("are typed in capitals with hyphens for spaces", () => {
    expect(normaliseProjectId("my app_two")).toBe("MY-APP-TWO");
  });
});
