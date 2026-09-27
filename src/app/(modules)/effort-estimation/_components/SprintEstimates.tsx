"use client";

import { ArrowRightIcon, FlaskConicalIcon, GaugeIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { describeError } from "@/shared/api/gateway";
import type { SprintPanelProps } from "@/shared/sprint-panels";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/shared/ui/native-select";
import { Spinner } from "@/shared/ui/spinner";

import { useModels, usePin, useSprintRisk } from "../_lib/api";
import { storiesToEstimate, toEstimateRequest } from "../_lib/estimate";
import type { ModelsResponse, SprintRiskResponse } from "../_lib/types";
import { SelectionBadge } from "./indicators";
import { SprintRiskCard } from "./SprintRiskCard";
import { StoryResults } from "./StoryResults";

const PROJECT_MODEL = "project";

function modelLabel(models: ModelsResponse | undefined, id: string | null | undefined): string {
  if (!id) return "Automatic";
  return models?.configurations.find((entry) => entry.configuration_id === id)?.label ?? id;
}

/**
 * This component on a sprint's page: effort and spillover risk for the sprint's stories, and the risk of
 * committing to them (/risk). The estimates are a second opinion the team accepts, adjusts or rejects.
 */
export function SprintEstimates({ project, sprint, stories }: SprintPanelProps) {
  const models = useModels();
  const pin = usePin(project.id);
  const risk = useSprintRisk(project.id);
  const [model, setModel] = useState(PROJECT_MODEL);
  const [result, setResult] = useState<{ response: SprintRiskResponse; titles: Record<string, string> } | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const ids = useId();
  const covered = storiesToEstimate(sprint, stories);
  const left = stories.length - covered.length;
  const synthetic = covered.some((story) => story.synthetic);

  const available = (models.data?.configurations ?? []).filter((entry) => entry.status === "available");
  const projectSetting = pin.data?.configuration_id
    ? `Project setting: ${modelLabel(models.data, pin.data.configuration_id)}`
    : "Project setting: Automatic (recommended)";

  // New results take the focus, so keyboard and screen-reader users land on them.
  useEffect(() => {
    if (result) resultsRef.current?.focus();
  }, [result]);

  async function estimate() {
    try {
      const response = await risk.mutateAsync(
        toEstimateRequest(sprint, covered, model === PROJECT_MODEL ? null : model),
      );
      setResult({ response, titles: Object.fromEntries(covered.map((story) => [story.story_id, story.title])) });
    } catch {
      setResult(null); // the error shows below
    }
  }

  const log = `/effort-estimation/predictions?sprint=${encodeURIComponent(sprint.sprint_id)}`;

  return (
    <section aria-labelledby={`${ids}-heading`} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id={`${ids}-heading`} className="flex items-center gap-2">
              <GaugeIcon aria-hidden className="size-5 text-primary" /> Effort and sprint risk
            </h2>
          </CardTitle>
          <CardDescription>
            {sprint.status === "closed"
              ? "This sprint is closed: each story's outcome has been recorded against its estimate."
              : "A second opinion on this sprint before and while the team works on it: points for each story, the chance it spills over, and the risk of committing to all of them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sprint.status === "closed" ? (
            <Button asChild variant="outline">
              <Link href={log}>
                Estimates and outcomes in the prediction log <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          ) : covered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every story in this sprint is done: there is nothing left to estimate.</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Field className="sm:max-w-80">
                <FieldLabel htmlFor={`${ids}-model`}>Model</FieldLabel>
                <NativeSelect
                  id={`${ids}-model`}
                  className="w-full"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  aria-describedby={`${ids}-model-help`}
                >
                  <NativeSelectOption value={PROJECT_MODEL}>{projectSetting}</NativeSelectOption>
                  {available.length > 0 ? (
                    <NativeSelectOptGroup label="Just for this estimate">
                      {available.map((entry) => (
                        <NativeSelectOption key={entry.configuration_id} value={entry.configuration_id}>
                          {entry.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : null}
                </NativeSelect>
                <FieldDescription id={`${ids}-model-help`}>
                  Compare them on the <Link href="/effort-estimation/models">Models</Link> page.
                </FieldDescription>
              </Field>
              <div className="flex flex-col gap-1 sm:pb-6">
                <Button onClick={estimate} disabled={risk.isPending}>
                  {risk.isPending ? <Spinner aria-hidden /> : null}
                  Estimate {covered.length} {covered.length === 1 ? "story" : "stories"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground sm:pb-8" aria-live="polite">
                {risk.isPending ? "Estimating…" : left > 0 ? `${left} done ${left === 1 ? "story is" : "stories are"} left out.` : null}
              </p>
            </div>
          )}
          {sprint.status !== "closed" ? (
            <p className="text-sm">
              <Link href={log}>Earlier estimates for this sprint</Link>
            </p>
          ) : null}
          {risk.isError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>The sprint was not estimated</AlertTitle>
              <AlertDescription>{describeError(risk.error)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <section aria-labelledby={`${ids}-results`} className="space-y-4">
          <div className="space-y-1">
            <h3 id={`${ids}-results`} ref={resultsRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              Results
            </h3>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                Answered by <strong className="text-foreground">{modelLabel(models.data, result.response.configuration_id)}</strong>
              </span>
              <SelectionBadge mode={result.response.selection_mode ?? "auto"} />
              {result.response.selection_reason ? <span>({result.response.selection_reason})</span> : null}
            </p>
          </div>
          {synthetic ? (
            <Alert>
              <FlaskConicalIcon aria-hidden />
              <AlertTitle>Results for synthetic stories</AlertTitle>
              <AlertDescription>
                Some of these stories are made up. Use the results to try the platform, not as evidence about a team;
                the decisions you record are still stored.
              </AlertDescription>
            </Alert>
          ) : null}
          {result.response.predictions.some((prediction) => (prediction.degraded_feature_groups ?? []).length > 0) ? (
            <Alert>
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>Some signals were estimated</AlertTitle>
              <AlertDescription>
                Requirement-quality, acceptance-criteria or traceability signals were not supplied for some stories, so the
                service estimated them from the text. Open a story&apos;s details to see which.
              </AlertDescription>
            </Alert>
          ) : null}
          <SprintRiskCard sprint={result.response.sprint} />
          <StoryResults projectId={project.id} predictions={result.response.predictions} titles={result.titles} />
        </section>
      ) : null}
    </section>
  );
}
