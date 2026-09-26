import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { checkCsv, checkFile, headerColumns, HISTORY_COLUMNS, templateCsv } from "./csv";

const example = readFileSync(resolve(__dirname, "../../../../../contracts/effort-estimation/examples/sprint-history.csv"), "utf8");

describe("sprint-history CSV checks", () => {
  it("know the import's columns (contracts/effort-estimation/examples/sprint-history.csv)", () => {
    expect(headerColumns(example)).toEqual([...HISTORY_COLUMNS]);
    expect(checkCsv(example)).toEqual([]);
    expect(headerColumns(templateCsv())).toEqual([...HISTORY_COLUMNS]);
  });

  it("read a header with a byte-order mark, quotes and spaces", () => {
    expect(headerColumns('﻿"sprint_id", story_id ,"a,b"\r\nx,y,z')).toEqual(["sprint_id", "story_id", "a,b"]);
  });

  it("catch the usual mistakes before uploading", () => {
    expect(checkCsv("sprint_id,title\nS1,x")).toEqual([
      "The story_id column is missing; every row needs one.",
      "Unknown column: title.",
    ]);
    expect(checkCsv("story_id,story_id\nA,B")).toEqual(["Columns given twice: story_id."]);
    expect(checkCsv("story_id\n")).toEqual(["The file has a header but no rows."]);
  });

  it("check the file itself", () => {
    expect(checkFile({ name: "history.xlsx", size: 10 })).toBe("Choose a .csv file.");
    expect(checkFile({ name: "history.csv", size: 0 })).toBe("The file is empty.");
    expect(checkFile({ name: "HISTORY.CSV", size: 26 * 1024 * 1024 })).toBe("The file is larger than 25 MB.");
    expect(checkFile({ name: "history.csv", size: 100 })).toBeNull();
  });
});
