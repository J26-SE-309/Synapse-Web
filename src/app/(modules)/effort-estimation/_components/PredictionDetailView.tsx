"use client";

import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useModels, usePrediction } from "../_lib/api";
import { DECISION_LABELS, percent, points, when } from "../_lib/format";
import { FeedbackControls } from "./FeedbackControls";
import { ConfidenceIndicator, EffortValue, RiskBadge, SelectionBadge } from "./indicators";
import { PredictionDetails } from "./PredictionDetails";

function featureValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}

/** One prediction as it was sent, what the models saw (FR21), and what was decided and happened (FR19). */
export function PredictionDetailView({ predictionId }: { predictionId: string }) {
  const detail = usePrediction(predictionId);
  const models = useModels();

  if (detail.isPending) return <Skeleton className="mx-auto h-96 max-w-6xl" />;
  if (detail.isError) {
    const missing = detail.error instanceof GatewayError && detail.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>{missing ? "There is no such prediction" : "The prediction could not be loaded"}</AlertTitle>
          <AlertDescription>{missing ? `No prediction has the id ${predictionId}.` : describeError(detail.error)}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/effort-estimation/predictions">
            <ArrowLeftIcon aria-hidden /> Prediction log
          </Link>
        </Button>
      </div>
    );
  }

  const data = detail.data;
  const prediction = data.prediction;
  const label =
    models.data?.configurations.find((model) => model.configuration_id === prediction.configuration_id)?.label ??
    prediction.configuration_id;
  const latest = data.feedback.at(-1);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/effort-estimation/predictions">
          <ArrowLeftIcon aria-hidden /> Prediction log
        </Link>
      </Button>
      <PageHeader
        title={<span className="font-mono">{prediction.story_id}</span>}
        description={`Estimated ${when(data.created_at)} for ${data.project_id}${data.sprint_id ? `, sprint ${data.sprint_id}` : ""}.`}
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            By <strong className="text-foreground">{label}</strong>
          </span>
          <SelectionBadge mode={prediction.selection_mode} />
        </p>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Effort</p>
            <EffortValue
              value={prediction.predicted_story_points}
              range={prediction.prediction_interval}
              category={prediction.effort_category}
              coverage={prediction.interval_coverage}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sprint risk</p>
            <RiskBadge level={prediction.sprint_risk_level} />
            <p className="text-xs text-muted-foreground">{percent(prediction.spillover_probability)} chance to spill over</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <ConfidenceIndicator level={prediction.confidence_level} score={prediction.confidence_score} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Your decision</p>
            <FeedbackControls
              projectId={data.project_id}
              predictionId={data.prediction_id}
              storyTitle={prediction.story_id}
              predicted={prediction.predicted_story_points}
              initial={latest ? { decision: latest.decision, points: latest.adjusted_story_points } : null}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Why</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PredictionDetails prediction={prediction} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Decisions</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.feedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody has reviewed this estimate yet.</p>
            ) : (
              <ol className="space-y-3">
                {[...data.feedback].reverse().map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium">
                      {DECISION_LABELS[entry.decision]}
                      {entry.decision === "adjust" && entry.adjusted_story_points != null ? ` to ${points(entry.adjusted_story_points)} points` : ""}
                    </p>
                    {entry.reason ? <p className="text-muted-foreground">“{entry.reason}”</p> : null}
                    <p className="text-xs text-muted-foreground">{when(entry.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Outcome</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.outcomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Recorded when the sprint closes.</p>
            ) : (
              <ol className="space-y-3">
                {[...data.outcomes].reverse().map((outcome) => (
                  <li key={outcome.id} className="text-sm">
                    <p className="font-medium">
                      {outcome.completed_in_sprint ? "Done in the sprint" : "Spilled over"}
                      {outcome.actual_story_points != null ? `, ${points(outcome.actual_story_points)} points` : ""}
                      {outcome.reopened ? ", reopened" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{when(outcome.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Collapsible>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <h2>What the models saw</h2>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  Show or hide the {Object.keys(data.features).length} values
                </Button>
              </CollapsibleTrigger>
            </CardTitle>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div
                tabIndex={0}
                role="region"
                aria-label="Feature values"
                className="max-h-96 overflow-auto rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.features).map(([name, value]) => (
                      <TableRow key={name}>
                        <TableCell className="font-mono text-xs">{name}</TableCell>
                        <TableCell className="font-mono text-xs">{featureValue(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs break-all text-muted-foreground">Model version {prediction.model_version}</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
