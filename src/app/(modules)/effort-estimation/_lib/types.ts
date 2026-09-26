/**
 * The effort-estimation service's API, as contracts/effort-estimation/*.schema.json describe it (generated from
 * the service's Pydantic models). Only what the pages use is typed; the schemas are the reference.
 */

export type RiskLevel = "low" | "medium" | "high";
export type ConfidenceLevel = "high" | "medium" | "low";
export type EffortCategory = "small" | "medium" | "large" | "extra_large";
export type SelectionMode = "auto" | "pinned";
export type Decision = "accept" | "adjust" | "reject";
export type RecommendationAction =
  | "split_story"
  | "refine_requirement"
  | "add_acceptance_criteria"
  | "create_tests"
  | "resolve_dependency"
  | "reduce_sprint_scope";

// ------------------------------------------------------------------------------------------- requests

export interface StoryInput {
  story_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string[];
  issue_type?: string | null;
  priority?: string | null;
  story_points?: number | null;
  blocker_count?: number;
  dep_in_degree?: number;
  dep_out_degree?: number;
  linked_issue_count?: number | null;
  has_epic?: boolean | null;
  in_progress?: boolean;
  added_mid_sprint?: boolean;
  days_into_sprint?: number;
}

export interface SprintContextInput {
  length_days?: number | null;
  parallel_sprints?: number | null;
  wip?: number | null;
  capacity_points?: number | null;
}

export interface EstimateRequest {
  project_id: string;
  sprint_id?: string | null;
  stories: StoryInput[];
  sprint_context?: SprintContextInput | null;
  pinned_configuration?: string | null;
}

export interface CompareRequest extends EstimateRequest {
  configurations?: string[] | null;
}

// ------------------------------------------------------------------------------------------- predictions

export interface RiskReason {
  factor: string;
  direction: "increases" | "decreases";
  weight: number;
}

export interface Recommendation {
  action: RecommendationAction;
  message: string;
  triggered_by: string;
}

export interface ModelConfiguration {
  encoder: string;
  learner: string;
  formulation: "single_task" | "multi_task" | "chained";
}

export interface Prediction {
  story_id: string;
  project_id: string;
  predicted_story_points: number;
  effort_category: EffortCategory;
  prediction_interval: { lower: number; upper: number };
  sprint_risk_level: RiskLevel;
  spillover_probability: number;
  confidence_score: number;
  key_risk_reasons: RiskReason[];
  recommendations: Recommendation[];
  model_configuration: ModelConfiguration;
  selection_mode: SelectionMode;
  feature_groups_used: string[];
  model_version: string;
  generated_at: string;
  prediction_id?: string | null;
  interval_coverage?: number;
  at_risk?: boolean;
  confidence_level?: ConfidenceLevel;
  configuration_id?: string;
  selection_reason?: string;
  degraded_feature_groups?: string[];
  feature_sources?: Record<string, string>;
  explanation_method?: string;
}

export interface EstimateResponse {
  predictions: Prediction[];
  configuration_id?: string;
  selection_mode?: SelectionMode;
  selection_reason?: string;
}

export interface Quantiles {
  p10: number;
  p50: number;
  p90: number;
}

/** FR16: does the whole commitment fit the team's capacity? */
export interface SprintRisk {
  stories: number;
  runs: number;
  committed_points: Quantiles;
  capacity_points: Quantiles | null;
  overcommit_probability: number | null;
  sprint_risk_level: RiskLevel | null;
  expected_overflow_points: number | null;
  overflow_if_over_p50: number | null;
  expected_stories_at_risk: number;
  stories_at_risk_p90: number;
  recommendations: Recommendation[];
}

export interface SprintRiskResponse extends EstimateResponse {
  sprint: SprintRisk;
}

export interface CompareResponse {
  results: { configuration_id: string; predictions: Prediction[] }[];
}

// ------------------------------------------------------------------------------------------- models and pins

export interface ModelSummary {
  configuration_id: string;
  label: string;
  role: string;
  configuration: ModelConfiguration;
  status: "available" | "not installed" | "planned";
  loaded: boolean;
  eligible?: boolean | null;
  failed_requirements?: string[];
  composite?: number | null;
  /** mae, sa (%), roc_auc, f1, ece, coverage_0.8, latency_p95 (seconds). */
  metrics: Record<string, number>;
}

export interface ModelsResponse {
  arena: string;
  pooled_winner: string;
  weights: Record<string, number>;
  configurations: ModelSummary[];
}

export interface Pin {
  project_id: string;
  configuration_id: string | null;
  pinned_at?: string | null;
}

// ------------------------------------------------------------------------------------------- feedback

export interface FeedbackInput {
  prediction_id: string;
  decision: Decision;
  target?: "estimate" | "risk" | "recommendation";
  recommendation_action?: RecommendationAction | null;
  adjusted_story_points?: number | null;
  reason?: string | null;
}

export interface Recorded {
  id: string;
  recorded: boolean;
}

// ------------------------------------------------------------------------------------------- sprint history

export interface TeamContext {
  velocity_mean?: number | null;
  velocity_variance?: number | null;
  closed_sprints?: number | null;
  mean_cycle_time_hours?: number | null;
  spillover_rate?: number | null;
  reopen_rate?: number | null;
}

export interface HistorySprint {
  sprint_id: string;
  name?: string | null;
  started_at: string;
  planned_end: string;
  closed_at?: string | null;
  stories: number;
  committed_points: number;
  completed_points?: number | null;
  spilled_over?: number | null;
}

export interface HistorySummary {
  project_id: string;
  as_of: string;
  sources: string[];
  closed_sprints: number;
  cold_start: boolean;
  sprints_needed: number;
  team_context: TeamContext;
  sprints: HistorySprint[];
}

export interface HistoryImport {
  project_id: string;
  source: string;
  sprints: number;
  stories: number;
  rows: number;
}

/** The import's 422 detail: nothing is imported while there are problems. */
export interface CsvProblems {
  message: string;
  problems: { row: number | null; column: string | null; problem: string }[];
}

// ------------------------------------------------------------------------------------------- reading back

export interface OutcomeBrief {
  completed_in_sprint: boolean;
  actual_story_points?: number | null;
  reopened?: boolean;
}

export interface PredictionBrief {
  prediction_id: string;
  created_at: string;
  story_id: string;
  sprint_id?: string | null;
  configuration_id: string;
  model_version: string;
  selection_mode: SelectionMode;
  predicted_story_points: number;
  prediction_interval: { lower: number; upper: number };
  effort_category: string;
  spillover_probability: number;
  sprint_risk_level: RiskLevel;
  confidence_score: number;
  confidence_level: string;
  feedback?: Decision | null;
  outcome?: OutcomeBrief | null;
}

export interface PredictionPage {
  project_id: string;
  predictions: PredictionBrief[];
  next_offset?: number | null;
}

export interface RecordedFeedback extends FeedbackInput {
  id: string;
  created_at: string;
}

export interface RecordedOutcome extends OutcomeBrief {
  id: string;
  prediction_id: string;
  created_at: string;
}

export interface PredictionDetail {
  prediction_id: string;
  project_id: string;
  sprint_id?: string | null;
  created_at: string;
  prediction: Prediction;
  features: Record<string, unknown>;
  feedback: RecordedFeedback[];
  outcomes: RecordedOutcome[];
}

export interface ProjectSummary {
  project_id: string;
  sprint_id?: string | null;
  predictions: number;
  stories: number;
  first_at?: string | null;
  last_at?: string | null;
  by_risk_level: Record<string, number>;
  by_configuration: Record<string, number>;
  pinned: number;
  feedback: Record<string, number>;
  outcomes: number;
  completed_share?: number | null;
  mean_spillover_probability?: number | null;
  effort_mae?: number | null;
}
