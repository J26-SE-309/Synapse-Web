
import { gatewayFetch } from "@/shared/api/gateway";

export type QualityLabel = "Good" | "Poor" | "Needs Clarification";

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

export interface AmbiguitySpan {
  start: number;
  end: number;
  text: string;
}

export type ReferenceKind = "pronoun" | "demonstrative" | "relative";

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

  /**
   * Difference between the two highest semantic similarity scores.
   * A smaller gap means the candidates are semantically closer.
   */
  similarity_gap: number;

  /**
   * Highest-ranked candidate according to the combined
   * semantic + proximity ranking.
   */
  best_candidate: string | null;

  /**
   * Combined ranking score of the selected candidate.
   * This is not a calibrated probability.
   */
  confidence: number;

  /**
   * Competition between the top two combined-ranking candidates.
   * Higher values mean the candidates are closer in score.
   * This is not a calibrated ambiguity probability.
   */
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

  /**
   * Difference between the two highest EXP-04 cosine similarities.
   * Diagnostic evidence, not a calibrated ambiguity decision.
   */
  top2_margin: number | null;

  /**
   * Normalized entropy of the candidate-sense similarity distribution.
   * Diagnostic evidence, not an ambiguity probability.
   */
  normalized_entropy: number | null;
}

export interface AmbiguityResult {
  /**
   * Compatibility flag indicating that at least one reference
   * crossed the current competition heuristic.
   *
   * This is not the output of a trained binary ambiguity classifier.
   */
  is_ambiguous: boolean;

  /**
   * Fraction of detected references that crossed the competition
   * heuristic. This is not a calibrated probability.
   */
  score: number;

  spans: AmbiguitySpan[];
  references: AmbiguityReference[];

  /**
   * WordNet candidate senses ranked using EXP-04 embeddings.
   * These are lexical ambiguity diagnostics, not confirmed
   * ambiguous terms.
   */
  lexical_ambiguities: LexicalAmbiguity[];
}

export interface RequirementAnalysis {
  requirement_id: string;
  quality: QualityResult;
  ambiguity: AmbiguityResult;
  vagueness: {
    count: number;
    terms: string[];
  };
  stability: {
    label: string;
    score: number;
  };
  confidence: number;
  explanation: string;
  model_version: string;
  analysed_at: string;
}

export interface AnalyzeRequirementInput {
  requirement_id: string;
  text: string;
}

/**
 * Analyze a requirement using the existing Synapse API Gateway.
 *
 * This function remains unchanged.
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
   GEMINI-POWERED LEXICAL REQUIREMENT REGENERATION
   ============================================================ */

/**
 * One lexical meaning explicitly selected by the user.
 *
 * start and end refer to character positions in the original
 * requirement text.
 */
export interface LexicalMeaningSelection {
  term: string;
  start: number;
  end: number;
  definition: string;
}

/**
 * Request sent to the FastAPI regeneration endpoint.
 *
 * Multiple selected lexical meanings can be included in one
 * request.
 *
 * Words marked "No clarification needed" should be omitted
 * from lexical_choices.
 */
export interface RequirementRegenerationInput {
  text: string;
  lexical_choices: LexicalMeaningSelection[];
}

/**
 * Response returned by the Gemini regeneration endpoint.
 */
export interface RequirementRegenerationOutput {
  regenerated_text: string;
}

/**
 * Regenerate a requirement using all selected lexical meanings.
 *
 * The AI produces one rewritten requirement based on the
 * user's selected meanings.
 *
 * This endpoint currently connects directly to the local
 * Requirement Quality Analyzer backend on port 8001.
 *
 * Existing analysis requests continue through the gateway.
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
      const error: { detail?: unknown } = await response.json();

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
