
import { gatewayFetch } from "@/shared/api/gateway";

/* ============================================================
   REQUIREMENT QUALITY
   ============================================================ */

export type QualityLabel =
  | "Good"
  | "Poor"
  | "Needs Clarification";

export interface QualityIssue {
  type: string;
  message: string;
  terms?: string[];
}

export interface QualityResult {
  label: QualityLabel;
  score: number;
  issues: QualityIssue[];
}

/* ============================================================
   UNCLEAR REFERENCES AND WORD MEANINGS
   ============================================================ */

export interface AmbiguitySpan {
  start: number;
  end: number;
  text: string;
}

export type ReferenceKind =
  | "pronoun"
  | "demonstrative"
  | "relative";

export interface AmbiguityCandidate {
  candidate: string;
  similarity: number;
  proximity: number;
  combined_score: number;
  rank: number;
  candidate_start: number;
}

export interface AmbiguityReference {
  reference: string;
  reference_kind: ReferenceKind;
  position: number;
  span: AmbiguitySpan;

  linguistic: {
    part_of_speech?: string;
    dependency?: string;
    head?: string;
    head_position?: number | null;
  };

  candidate_count: number;
  is_ambiguous: boolean;

  signals: {
    lexical: boolean;
    syntactic: boolean;
    semantic: boolean;
    anaphoric: boolean;
  };

  candidate_interpretations: AmbiguityCandidate[];

  similarity_gap: number;
  best_candidate: string | null;
  confidence: number;
  competition_score: number;
}

export interface LexicalSenseCandidate {
  sense: string;
  definition: string;
  similarity: number;
  combined_score: number;
}

export interface LexicalAmbiguity {
  term: string;
  span: AmbiguitySpan;
  candidate_senses: LexicalSenseCandidate[];
  candidate_count: number;
  top2_margin: number | null;
  normalized_entropy: number | null;
}

export interface AmbiguityResult {
  is_ambiguous: boolean;
  score: number;
  spans: AmbiguitySpan[];
  references: AmbiguityReference[];
  lexical_ambiguities: LexicalAmbiguity[];
}

/* ============================================================
   REQUIREMENT MEANING STABILITY
   ============================================================ */

export type StabilityLabel =
  | "stable"
  | "potentially_unstable"
  | "not_evaluated";

export interface StabilityResult {
  label: StabilityLabel;
  score: number | null;
}

/* ============================================================
   COMPLETE REQUIREMENT ANALYSIS RESPONSE
   ============================================================ */

export interface RequirementAnalysis {
  requirement_id: string;

  quality: QualityResult;

  ambiguity: AmbiguityResult;

  vagueness: {
    count: number;
    terms: AmbiguitySpan[];
  };

  stability: StabilityResult;

  confidence: number;
  explanation: string;
  model_version: string;
  analysed_at: string;
}

/* ============================================================
   REQUIREMENT ANALYSIS INPUT
   ============================================================ */

export interface AnalyzeRequirementInput {
  requirement_id: string;
  text: string;
  modified_text?: string;
}

/**
 * Analyze a requirement using the existing API Gateway.
 *
 * Supports quality checking, unclear references,
 * and comparison with modified wording.
 */
export function analyzeRequirement(
  input: AnalyzeRequirementInput,
): Promise<RequirementAnalysis> {
  return gatewayFetch<RequirementAnalysis>(
    "api/v1/requirement-quality/analyze",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/* ============================================================
   REQUIREMENT REGENERATION
   ============================================================ */

export interface LexicalMeaningSelection {
  term: string;
  start: number;
  end: number;
  definition: string;
}

export interface RequirementRegenerationInput {
  text: string;
  lexical_choices: LexicalMeaningSelection[];
}

export interface RequirementRegenerationOutput {
  regenerated_text: string;
}

/**
 * Rewrite the requirement using the meanings
 * explicitly selected by the user.
 */
export async function regenerateRequirement(
  input: RequirementRegenerationInput,
): Promise<RequirementRegenerationOutput> {
  const response = await fetch(
    "http://127.0.0.1:8001/api/v1/regenerate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    let message = "Requirement regeneration failed.";

    try {
      const error: { detail?: unknown } =
        await response.json();

      if (typeof error.detail === "string") {
        message = error.detail;
      }
    } catch {
      // Keep the default message if the response is not JSON.
    }

    throw new Error(message);
  }

 return (await response.json()) as RequirementRegenerationOutput;
}