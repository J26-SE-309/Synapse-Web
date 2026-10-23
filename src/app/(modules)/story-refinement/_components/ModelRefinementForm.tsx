"use client";

import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { describeError, gatewayFetch } from "@/shared/api/gateway";
import { useProject } from "@/shared/projects/ProjectProvider";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

interface RefinementResponse {
  output: string;
}

function extractCriteria(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

export function ModelRefinementForm({ initialRequirementId }: { initialRequirementId?: string }) {
  const { projectId } = useProject();
  const [requirementId, setRequirementId] = useState(initialRequirementId ?? "");
  const [formProjectId, setFormProjectId] = useState(projectId ?? "");
  const [requirement, setRequirement] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criteria = useMemo(() => (output ? extractCriteria(output) : []), [output]);
  const warnings = useMemo(() => {
    if (!output) return [];
    const nextWarnings: string[] = [];
    if (!/^as\s+.+\s+i\s+want\s+.+/im.test(output)) {
      nextWarnings.push("The generated output does not contain a recognizable Agile user story.");
    }
    if (criteria.length < 5) {
      nextWarnings.push(`Only ${criteria.length} acceptance criteria could be identified; review the model output.`);
    }
    return nextWarnings;
  }, [criteria.length, output]);

  const qualityScores = {
    completeness: output ? (criteria.length >= 5 ? 1 : criteria.length / 5) : 0,
    clarity: output && /^as\s+.+\s+i\s+want\s+.+/im.test(output) ? 1 : 0,
    testability: output ? (criteria.length > 0 ? 1 : 0) : 0,
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOutput(null);
    setIsLoading(true);
    try {
      const result = await gatewayFetch<RefinementResponse | string>("api/v1/story-refinement/refine", {
        method: "POST",
        body: JSON.stringify({
          requirement_id: requirementId.trim(),
          project_id: formProjectId.trim() || undefined,
          validated_requirement: requirement.trim(),
        }),
      });
      setOutput(typeof result === "string" ? result : result.output);
    } catch (requestError) {
      setError(describeError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Refine a validated requirement</CardTitle>
          <CardDescription>Generate one Agile user story and acceptance criteria with the configured model.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium" htmlFor="model-requirement-id">
                Requirement ID
                <Input
                  id="model-requirement-id"
                  required
                  value={requirementId}
                  onChange={(event) => setRequirementId(event.target.value)}
                  placeholder="REQ-001"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium" htmlFor="model-project-id">
                Project ID
                <Input
                  id="model-project-id"
                  required
                  value={formProjectId}
                  onChange={(event) => setFormProjectId(event.target.value)}
                  placeholder="SYN"
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="model-validated-requirement">
              Validated requirement
              <Textarea
                id="model-validated-requirement"
                required
                rows={5}
                value={requirement}
                onChange={(event) => setRequirement(event.target.value)}
                placeholder="A student can book an available tutoring session."
              />
            </label>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SparklesIcon aria-hidden />}
              {isLoading ? "Refining..." : "Refine"}
            </Button>
            {isLoading && (
              <p className="text-sm text-muted-foreground" role="status">
                Generating a user story and acceptance criteria...
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Refinement failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {output && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Generated user story</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6" id="generated-model-output">{output}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Acceptance criteria</CardTitle>
              <CardDescription>Criteria detected in the generated response.</CardDescription>
            </CardHeader>
            <CardContent>
              {criteria.length > 0 ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {criteria.map((criterion, index) => <li key={`${index}-${criterion}`}>{criterion}</li>)}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No numbered or bulleted criteria were detected.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quality scores</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              {Object.entries(qualityScores).map(([label, score]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                  <p className="capitalize text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold">{Math.round(score * 100)}%</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Validation warnings</CardTitle></CardHeader>
            <CardContent>
              {warnings.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No validation warnings.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
