"use client";

import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { describeError, gatewayFetch } from "@/shared/api/gateway";
import { useProject } from "@/shared/projects/ProjectProvider";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
}

interface RefinementResponse {
  requirement_id: string;
  user_story: string;
  acceptance_criteria: AcceptanceCriterion[];
  quality_scores: Record<string, number | Record<string, boolean>>;
  unsupported_assumptions: string[];
  model_metadata: Record<string, string>;
}

interface ModelStatus {
  available: boolean;
  message: string;
}

export function ModelRefinementForm({ initialRequirementId }: { initialRequirementId?: string }) {
  const { projectId } = useProject();
  const [requirementId, setRequirementId] = useState(initialRequirementId ?? "");
  const [formProjectId, setFormProjectId] = useState(projectId ?? "");
  const [requirement, setRequirement] = useState("");
  const [result, setResult] = useState<RefinementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    void gatewayFetch<ModelStatus & { status: string }>("api/v1/story-refinement/models/status")
      .then(setModelStatus)
      .catch(() => setModelStatus({ available: false, message: "Model unavailable — check backend and model configuration." }));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedRequirement = requirement.trim();
    if (!trimmedRequirement) {
      setError("Enter a validated requirement before refining.");
      return;
    }
    setError(null);
    setResult(null);
    setIsLoading(true);
    try {
      const response = await gatewayFetch<RefinementResponse>("api/v1/story-refinement/refine", {
        method: "POST",
        body: JSON.stringify({
          requirement_id: requirementId.trim(),
          project_id: formProjectId.trim() || undefined,
          validated_requirement: trimmedRequirement,
        }),
      });
      setResult(response);
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
                <Input id="model-requirement-id" required value={requirementId} onChange={(event) => setRequirementId(event.target.value)} placeholder="REQ-001" />
              </label>
              <label className="space-y-1.5 text-sm font-medium" htmlFor="model-project-id">
                Project ID <span className="font-normal text-muted-foreground">(optional)</span>
                <Input id="model-project-id" value={formProjectId} onChange={(event) => setFormProjectId(event.target.value)} placeholder="SYN" />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="model-validated-requirement">
              Validated requirement
              <Textarea id="model-validated-requirement" required rows={5} value={requirement} onChange={(event) => setRequirement(event.target.value)} placeholder="A student can book an available tutoring session." />
            </label>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SparklesIcon aria-hidden />}
              {isLoading ? "Refining..." : "Refine"}
            </Button>
            {isLoading && <p className="text-sm text-muted-foreground" role="status">Generating a user story and acceptance criteria...</p>}
          </form>
        </CardContent>
      </Card>

      {modelStatus && !modelStatus.available && <Alert><AlertTitle>Model unavailable</AlertTitle><AlertDescription>{modelStatus.message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertTitle>Refinement failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Generated user story</CardTitle></CardHeader><CardContent><p className="text-sm leading-6" id="generated-model-output">{result.user_story}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Acceptance criteria</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-2 pl-5 text-sm">{result.acceptance_criteria.map((criterion) => <li key={criterion.id}><strong>Given</strong> {criterion.given}; <strong>when</strong> {criterion.when}; <strong>then</strong> {criterion.then}</li>)}</ol></CardContent></Card>
          <Card><CardHeader><CardTitle>Quality assessment</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-3">{Object.entries(result.quality_scores).filter(([, value]) => typeof value === "number").map(([label, score]) => <div key={label} className="rounded-lg bg-muted/50 p-3"><p className="capitalize text-muted-foreground">{label}</p><p className="text-lg font-semibold">{Math.round(Number(score) * 100)}%</p></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Unsupported-assumption warnings</CardTitle></CardHeader><CardContent>{result.unsupported_assumptions.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{result.unsupported_assumptions.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="text-sm text-muted-foreground">No unsupported assumptions reported.</p>}</CardContent></Card>
        </div>
      )}
    </div>
  );
}
