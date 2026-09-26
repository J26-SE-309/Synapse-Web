import type { ConfidenceLevel, Decision, EffortCategory, RecommendationAction, RiskLevel } from "./types";

/** Words for what the service returns as codes: planning language, not model internals (FR14). */

export const RISK_LABELS: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = { high: "High", medium: "Medium", low: "Low" };

export const EFFORT_LABELS: Record<EffortCategory, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  extra_large: "Extra large",
};

export const ACTION_LABELS: Record<RecommendationAction, string> = {
  split_story: "Split the story",
  refine_requirement: "Refine the requirement",
  add_acceptance_criteria: "Add acceptance criteria",
  create_tests: "Create the missing tests",
  resolve_dependency: "Resolve the dependencies",
  reduce_sprint_scope: "Reduce the sprint's scope",
};

export const DECISION_LABELS: Record<Decision, string> = { accept: "Accepted", adjust: "Adjusted", reject: "Rejected" };

export const FEATURE_GROUP_LABELS: Record<string, string> = {
  textual: "Story text",
  requirement_quality: "Requirement quality",
  dependency: "Dependencies",
  traceability: "Traceability",
  acceptance_criteria: "Acceptance criteria",
  historical_sprint: "Team history",
  sprint_context: "Sprint context",
  metadata: "Story details",
};

export const FEATURE_SOURCE_LABELS: Record<string, string> = {
  component: "from the upstream component",
  request: "from the backlog",
  history: "from the team's sprint history",
  text: "from the story text",
  proxy: "estimated from the text (upstream component not available)",
  missing: "not available",
};

export const METRIC_LABELS: Record<string, { label: string; hint: string }> = {
  sa: { label: "Effort accuracy (SA)", hint: "Standardised accuracy: how much better than guessing, higher is better" },
  mae: { label: "Effort error (MAE)", hint: "Mean absolute error in story points, lower is better" },
  f1: { label: "Risk F1", hint: "How well spillover is caught, higher is better" },
  roc_auc: { label: "Risk AUC", hint: "How well at-risk stories are ranked first, higher is better" },
  ece: { label: "Calibration error (ECE)", hint: "How far probabilities are from what happens, lower is better" },
  "coverage_0.8": { label: "Interval coverage", hint: "Share of stories whose points fall in the 80% interval" },
  latency_p95: { label: "Speed (p95)", hint: "Time to answer a story, 95th percentile" },
};

export function label<T extends string>(labels: Record<T, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return (labels as Record<string, string>)[key] ?? key.replaceAll("_", " ");
}

const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function points(value: number | null | undefined): string {
  return value == null ? "—" : decimal.format(value);
}

export function number(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return digits === 2 ? precise.format(value) : new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

export function percent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export function interval(range: { lower: number; upper: number } | null | undefined): string {
  return range ? `${points(range.lower)}–${points(range.upper)}` : "—";
}

export function milliseconds(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${decimal.format(seconds)} s`;
}

/** The service stores some times without a zone; they are UTC. */
export function parseTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function when(value: string | null | undefined): string {
  return value ? dateTime.format(parseTime(value)) : "—";
}

export function day(value: string | null | undefined): string {
  return value ? dateOnly.format(parseTime(value)) : "—";
}

export function hours(value: number | null | undefined): string {
  if (value == null) return "—";
  return value >= 48 ? `${decimal.format(value / 24)} days` : `${decimal.format(value)} h`;
}
