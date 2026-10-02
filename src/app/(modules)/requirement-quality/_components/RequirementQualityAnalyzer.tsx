"use client";

import { FormEvent, useState } from "react";

import {
  analyzeRequirement,
  type RequirementAnalysis,
  type QualityLabel,
} from "../_lib/api";

const LABEL_STYLES: Record<QualityLabel, string> = {
  Good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Poor: "border-red-200 bg-red-50 text-red-800",
  "Needs Clarification": "border-amber-200 bg-amber-50 text-amber-800",
};

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function getIssueTitle(type: string): string {
  if (type === "missing_information") {
    return "Missing information";
  }

  if (type === "vague_terms") {
    return "Vague wording";
  }

  if (type === "quality_defect") {
    return "Quality concern";
  }

  return "Quality issue";
}

function getIssueMessage(
  type: string,
  message: string,
  terms?: string[],
): string {
  if (type === "missing_information") {
    const element = message
      .replace("Missing structural element: ", "")
      .replace(/\.$/, "");

    return `The requirement does not clearly specify the ${element}.`;
  }

  if (type === "vague_terms") {
    if (terms && terms.length > 0) {
      return `Potentially vague terms detected: ${terms
        .map((term) => `"${term}"`)
        .join(", ")}.`;
    }

    return message;
  }

  if (type === "quality_defect") {
    return "The requirement was classified as potentially defective. Consider reviewing it for clearer and more measurable wording.";
  }

  return message;
}

function getExplanation(result: RequirementAnalysis): string {
  const vagueIssue = result.quality.issues.find(
    (issue) => issue.type === "vague_terms",
  );

  if (vagueIssue) {
    const terms = vagueIssue.terms ?? [];

    if (terms.length > 0) {
      return `The requirement uses vague wording such as ${terms
        .map((term) => `"${term}"`)
        .join(
          ", ",
        )}. These terms are difficult to verify objectively, so they should be replaced with specific and measurable criteria.`;
    }

    return "The requirement contains vague wording that should be replaced with specific and measurable criteria.";
  }

  if (result.quality.label === "Good") {
    return "The requirement is structurally complete and was assessed as acceptable.";
  }

  if (result.quality.label === "Poor") {
    return "The requirement may contain quality issues and should be reviewed for clearer and more measurable wording.";
  }

  return "The requirement needs additional information to make its structure clearer and more complete.";
}

export function RequirementQualityAnalyzer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<RequirementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requirement = text.trim();

    if (!requirement) {
      setError("Please enter a requirement before analyzing it.");
      setResult(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysis = await analyzeRequirement({
        requirement_id: `REQ-${Date.now()}`,
        text: requirement,
      });

      setResult(analysis);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to analyze the requirement.";

      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="requirement-text"
              className="block text-sm font-medium text-zinc-900"
            >
              Requirement
            </label>

            <p className="text-sm text-zinc-500">
              Enter a raw software requirement to assess its quality.
            </p>
          </div>

          <textarea
            id="requirement-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Example: The system shall display the user dashboard within 2 seconds."
            rows={6}
            disabled={isAnalyzing}
            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              Uses contextual classification and structural completeness
              checks.
            </p>

            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze requirement"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <section
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-medium">Analysis failed</p>
          <p className="mt-1">{error}</p>
        </section>
      )}

      {result && (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Quality assessment
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${LABEL_STYLES[result.quality.label]}`}
              >
                {result.quality.label}
              </span>

              <span className="text-sm text-zinc-600">
                Score:
                <span className="ml-1 font-semibold text-zinc-900">
                  {formatScore(result.quality.score)}
                </span>
              </span>
            </div>
          </div>

          {result.quality.issues.length > 0 ? (
            <div className="border-t border-zinc-200 pt-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                Issues
              </h2>

              <ul className="mt-3 space-y-3">
                {result.quality.issues.map((issue, index) => (
                  <li
                    key={`${issue.type}-${index}`}
                    className="rounded-md bg-zinc-50 px-3 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {getIssueTitle(issue.type)}
                    </p>

                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {getIssueMessage(
                        issue.type,
                        issue.message,
                        issue.terms,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border-t border-zinc-200 pt-4">
              <p className="text-sm text-emerald-700">
                No quality issues were detected.
              </p>
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Explanation
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {getExplanation(result)}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
