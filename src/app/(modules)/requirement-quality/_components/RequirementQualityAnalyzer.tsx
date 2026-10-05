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
      const label = terms.length === 1 ? "term" : "terms";

      return `Potentially vague ${label} detected: ${terms
        .map((term) => `"${term}"`)
        .join(", ")}.`;
    }

    return "The requirement contains wording that may be interpreted differently by different readers.";
  }

  if (type === "quality_defect") {
    return "Review the requirement for clearer and more measurable wording.";
  }

  return message;
}

function getQualityExplanation(result: RequirementAnalysis): string {
  const vagueIssue = result.quality.issues.find(
    (issue) => issue.type === "vague_terms",
  );

  if (vagueIssue) {
    return "The requirement contains wording that may be difficult to measure objectively. This can lead to different interpretations of what the system should provide.";
  }

  const missingInformationIssue = result.quality.issues.find(
    (issue) => issue.type === "missing_information",
  );

  if (missingInformationIssue) {
    const element = missingInformationIssue.message
      .replace("Missing structural element: ", "")
      .replace(/\.$/, "");

    return `The requirement is incomplete because it does not clearly define the ${element}.`;
  }

  if (result.quality.label === "Good") {
    return "The requirement clearly describes the expected behaviour and contains enough information to be understood, implemented, and verified.";
  }

  if (result.quality.label === "Poor") {
    return "The requirement may be difficult to implement or verify because its expected behaviour is not clearly defined.";
  }

  return "The requirement needs additional information before its expected behaviour can be understood clearly.";
}

function getAmbiguityExplanation(result: RequirementAnalysis): string {
  const pronoun = result.ambiguity.spans[0]?.text;

  if (pronoun) {
    return `The word "${pronoun}" could refer to more than one part of the requirement. A reader may therefore understand the requirement differently from what you intended. Replace "${pronoun}" with the specific component or entity you mean.`;
  }

  return "Part of this requirement could be interpreted in more than one way. Use more specific wording so that the intended meaning is clear to every reader.";
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
        <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          {/* Quality assessment */}
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

            <div className="mt-3 rounded-md bg-zinc-50 px-3 py-3">
              <p className="text-sm leading-5 text-zinc-700">
                {getQualityExplanation(result)}
              </p>
            </div>

            {result.quality.issues.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Quality concerns
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
            )}
          </div>

          {/* Ambiguity assessment */}
          <div className="border-t border-zinc-200 pt-5">
            <p className="text-sm font-medium text-zinc-500">
              Ambiguity assessment
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  result.ambiguity.is_ambiguous
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {result.ambiguity.is_ambiguous
                  ? "Potentially ambiguous"
                  : "No ambiguity detected"}
              </span>

              <span className="text-sm text-zinc-600">
                Score:
                <span className="ml-1 font-semibold text-zinc-900">
                  {formatScore(result.ambiguity.score)}
                </span>
              </span>
            </div>

            {result.ambiguity.spans.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-zinc-600">
                  Wording that may be unclear:
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {result.ambiguity.spans.map((span, index) => (
                    <span
                      key={`${span.start}-${span.end}-${index}`}
                      className="rounded-md bg-amber-50 px-2 py-1 text-sm font-medium text-amber-800"
                    >
                      &ldquo;{span.text}&rdquo;
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-md bg-zinc-50 px-3 py-3">
              <p className="text-sm leading-5 text-zinc-700">
                {result.ambiguity.is_ambiguous
                  ? getAmbiguityExplanation(result)
                  : "The wording is clear enough that no competing interpretation was identified."}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
