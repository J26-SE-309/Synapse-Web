/**
 * Checks on a sprint-history CSV before it is uploaded. The service checks every row again (dates, numbers,
 * the same story twice, ...) and imports nothing while there are problems; these catch the common mistakes
 * (wrong file, wrong columns) without sending anything.
 */

/** The import's columns, in the order of contracts/effort-estimation/examples/sprint-history.csv. */
export const HISTORY_COLUMNS = [
  "sprint_id",
  "sprint_name",
  "sprint_started_at",
  "sprint_planned_end",
  "sprint_closed_at",
  "story_id",
  "issue_type",
  "committed_at",
  "left_at",
  "points_at_commit",
  "points_at_close",
  "done_in_sprint",
  "spilled_over",
  "reopened",
  "started_at",
  "resolved_at",
  "hours_in_progress",
] as const;

export const MAX_CSV_BYTES = 25 * 1024 * 1024;
export const MAX_CSV_ROWS = 200_000; // the service's own limit

/** The header's column names: the first line, split on commas outside quotes. */
export function headerColumns(text: string): string[] {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const columns: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      columns.push(current.trim());
      current = "";
    } else current += char;
  }
  columns.push(current.trim());
  return columns.filter((column) => column !== "");
}

export function checkFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Choose a .csv file.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_CSV_BYTES) return "The file is larger than 25 MB.";
  return null;
}

/** Problems with the file's header and size, or none. */
export function checkCsv(text: string): string[] {
  const problems: string[] = [];
  const columns = headerColumns(text);
  if (columns.length === 0) return ["The file has no header row."];
  if (!columns.includes("story_id")) problems.push("The story_id column is missing; every row needs one.");
  const unknown = columns.filter((column) => !(HISTORY_COLUMNS as readonly string[]).includes(column));
  if (unknown.length > 0) problems.push(`Unknown ${unknown.length === 1 ? "column" : "columns"}: ${unknown.join(", ")}.`);
  const duplicated = columns.filter((column, index) => columns.indexOf(column) !== index);
  if (duplicated.length > 0) problems.push(`Columns given twice: ${[...new Set(duplicated)].join(", ")}.`);
  const rows = text.split(/\r?\n/).filter((line) => line.trim() !== "").length - 1;
  if (rows < 1) problems.push("The file has a header but no rows.");
  if (rows > MAX_CSV_ROWS) problems.push(`The file has more than ${MAX_CSV_ROWS.toLocaleString()} rows.`);
  return problems;
}

export function templateCsv(): string {
  return `${HISTORY_COLUMNS.join(",")}\n`;
}
