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

export interface RequirementAnalysis {
  requirement_id: string;
  quality: QualityResult;
  ambiguity: {
    is_ambiguous: boolean;
    score: number;
    spans: unknown[];
  };
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
