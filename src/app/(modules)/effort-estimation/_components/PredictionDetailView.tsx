"use client";

import {
  ArrowLeftIcon,
  GaugeIcon,
  RulerIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useModels, usePrediction } from "../_lib/api";
import { DECISION_LABELS, EFFORT_LABELS, hours, interval, label as labelFor, number, percent, points, when } from "../_lib/format";
import type { ConfidenceBreakdown, PredictionDetail } from "../_lib/types";
import { FeedbackControls } from "./FeedbackControls";
import { ReasonList, RiskBadge, SelectionBadge } from "./indicators";
import { AllDone, FeatureGroupList, noActionsText, RecommendationList } from "./PredictionDetails";
import { ConfidenceRing, EffortRange, RiskGauge, ShareBar } from "./visuals";

function featureValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}

/** A feature's value as a number, or null when the models did not have it. */
function numeric(features: Record<string, unknown>, name: string): number | null {
  const value = features[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-border/60 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A small heading over one of the prediction's numbers. */
function Label({ icon: Icon, className, children }: { icon: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium text-muted-foreground", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Icon aria-hidden className="size-4" />
      </span>
      {children}
    </p>
  );
}

/** Decisions or outcomes, newest first, on a line. */
function Timeline({ entries }: { entries: { id: string | number; title: string; detail: string | null; at: string }[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative text-sm">
          <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
          <p className="font-medium">{entry.title}</p>
          {entry.detail ? <p className="text-muted-foreground">{entry.detail}</p> : null}
          <p className="text-xs text-muted-foreground">{when(entry.at)}</p>
        </li>
      ))}
    </ol>
  );
}

/** The sprint and the team as the models saw them when they made this prediction (from the recorded features). */
export function PredictionContext({ detail }: { detail: PredictionDetail }) {
  const features = detail.features;
  if (Object.keys(features).length === 0) return <Skeleton className="h-32" />;
  const others = numeric(features, "sprint_committed_points");
  const own = numeric(features, "story_points");
  const velocity = numeric(features, "team_velocity_rolling");
  const closed = numeric(features, "history_sprints");
  const load = velocity && velocity > 0 && others !== null ? (others + (own ?? 0)) / velocity : null;
  const unknown = <span className="font-normal text-muted-foreground">not known</span>;
  const shown = (name: string, format: (value: number) => string) => {
    const value = numeric(features, name);
    return value === null ? unknown : format(value);
  };
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {load !== null ? (
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Sprint load</span>
            <span className={cn("tabular-nums", load > 1.1 ? "font-medium text-warning" : "text-muted-foreground")}>
              {percent(load)} of the team&apos;s velocity
            </span>
          </div>
          <div aria-hidden className="relative h-2 rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", load > 1.1 ? "bg-warning" : "bg-gradient-to-r from-primary to-chart-3")}
              style={{ width: `${Math.min(load / 1.5, 1) * 100}%` }}
            />
            <span className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/50" style={{ left: `${(1 / 1.5) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">The line marks 100%: the points the team usually finishes in a sprint.</p>
        </div>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">The sprint</h3>
        <Facts
          rows={[
            ["Sprint", detail.sprint_id ?? <span className="font-normal text-muted-foreground">none recorded</span>],
            ["Length", shown("sprint_length_days", (value) => `${number(value, 0)} days`)],
            ["Other committed work", others !== null ? `${points(others)} points` : unknown],
            ["Sprint load", load !== null ? `${percent(load)} of the team's velocity` : unknown],
            ["Added after the start", features.added_mid_sprint ? "yes" : "no"],
            ["Team's own estimate", own !== null ? `${points(own)} points` : unknown],
          ]}
        />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">The team</h3>
        <Facts
          rows={[
            ["Closed sprints on record", closed !== null ? number(closed, 0) : unknown],
            ["Velocity (last 3 sprints)", velocity !== null ? `${points(velocity)} points` : unknown],
            ["Stories spilled over", shown("historical_spillover_rate", percent)],
            ["Stories reopened", shown("reopen_rate", percent)],
            ["Mean cycle time", shown("mean_cycle_time_hours", hours)],
          ]}
        />
      </section>
    </div>
  );
}

const PENALTY_LABELS: Record<ConfidenceBreakdown["penalties"][number]["reason"], string> = {
  cold_start: "Little team history",
  unseen_project: "A project the models never saw",
  missing_group: "Missing inputs",
};

/** How the confidence score came about: S x (E + R) / 2, and what lowered the data support S. */
export function ConfidenceExplained({ score, breakdown }: { score: number; breakdown?: ConfidenceBreakdown | null }) {
  if (!breakdown) {
    return (
      <p className="text-sm text-muted-foreground">
        This prediction was recorded before the service kept the parts of its confidence score.
      </p>
    );
  }
  return (
    <div className="space-y-5 text-sm">
      <p className="rounded-xl bg-muted/50 px-4 py-3">
        <span className="font-semibold">{percent(score)}</span>
        <span className="text-muted-foreground">
          {" "}
          = data support {percent(breakdown.data_support)} × (effort certainty {percent(breakdown.effort_certainty)} + risk
          certainty {percent(breakdown.risk_certainty)}) ÷ 2. High from 60%, Medium from 35%.
        </span>
      </p>
      <div className="space-y-4">
        <ShareBar label="Data support" value={breakdown.data_support} hint="How much the models had to go on: inputs and team history." />
        <ShareBar
          label="Effort certainty"
          value={breakdown.effort_certainty}
          hint="How much narrower this story's points range is than past estimates'."
        />
        <ShareBar label="Risk certainty" value={breakdown.risk_certainty} hint="How far the spillover chance is from a coin flip (50%)." />
      </div>
      <section className="space-y-2">
        <h3 className="font-semibold">What lowered the data support</h3>
        {breakdown.penalties.length === 0 ? (
          <p className="text-muted-foreground">Nothing: the models had everything they use.</p>
        ) : (
          <ul className="space-y-2">
            {breakdown.penalties.map((penalty) => (
              <li key={penalty.reason} className="flex items-start gap-3">
                <span className="shrink-0 rounded-md bg-warning-soft px-2 py-0.5 font-mono text-xs font-medium text-warning tabular-nums">
                  ×{number(penalty.factor)}
                </span>
                <span>
                  <span className="font-medium">{PENALTY_LABELS[penalty.reason]}</span>
                  <span className="text-muted-foreground">: {penalty.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Everything about one prediction: the answer, why, what to do, the context it used, how sure it is, what was
 * decided and what happened (FR19), and the values the models saw (FR21). recorded: false while the service is
 * still writing it to the log (decisions can be made once it is there).
 */
export function PredictionDetailBody({
  data,
  label,
  recorded = true,
}: {
  data: PredictionDetail;
  label: string;
  recorded?: boolean;
}) {
  const prediction = data.prediction;
  const latest = data.feedback.at(-1);
  const own = numeric(data.features, "story_points");
  const penalties = prediction.confidence_breakdown?.penalties ?? [];
  const reduced = (prediction.degraded_feature_groups ?? []).length;
  return (
    <div className="space-y-6">
      <section aria-labelledby="prediction-verdict" className="overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft)">
        <h2 id="prediction-verdict" className="sr-only">
          The prediction
        </h2>
        <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="space-y-4 p-6">
            <Label icon={RulerIcon}>Effort</Label>
            <div className="space-y-1">
              <p className="text-4xl font-semibold tracking-tight tabular-nums">
                {points(prediction.predicted_story_points)} <span className="text-base font-normal text-muted-foreground">points</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {labelFor(EFFORT_LABELS, prediction.effort_category)} story · likely {interval(prediction.prediction_interval)} points
              </p>
            </div>
            <EffortRange
              value={prediction.predicted_story_points}
              range={prediction.prediction_interval}
              own={own}
              coverage={prediction.interval_coverage}
            />
            <p className="text-xs text-muted-foreground">
              The band holds the real points of {percent(prediction.interval_coverage ?? 0.8)} of past stories
              {own !== null ? `; the line is the team's own estimate (${points(own)})` : ""}.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <Label icon={GaugeIcon} className="self-start">
              Sprint risk
            </Label>
            <RiskGauge probability={prediction.spillover_probability} level={prediction.sprint_risk_level} />
            <RiskBadge level={prediction.sprint_risk_level} />
          </div>
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <Label icon={ShieldCheckIcon} className="self-start">
              Confidence
            </Label>
            <ConfidenceRing score={prediction.confidence_score} level={prediction.confidence_level} />
            <p className="max-w-60 text-xs text-muted-foreground">
              {!prediction.confidence_breakdown
                ? "How sure the models are, from 0 to 100%."
                : penalties.length === 0
                  ? "Nothing lowered it: the models had everything they use."
                  : `Lowered by: ${penalties.map((penalty) => PENALTY_LABELS[penalty.reason].toLowerCase()).join(", ")}.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t bg-muted/30 px-6 py-4">
          <p className="text-sm font-medium">Your decision</p>
          {recorded ? (
            <FeedbackControls
              projectId={data.project_id}
              predictionId={data.prediction_id}
              storyTitle={prediction.story_id}
              predicted={prediction.predicted_story_points}
              initial={latest ? { decision: latest.decision, points: latest.adjusted_story_points } : null}
            />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden /> Saving to the prediction log…
            </p>
          )}
          <p className="text-xs text-muted-foreground sm:ml-auto">
            By <span className="font-medium text-foreground">{label}</span>
            {prediction.selection_reason ? ` (${prediction.selection_reason})` : ""}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Why</h2>
            </CardTitle>
            <CardDescription>The factors that moved the spillover chance most, and by how much.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReasonList reasons={prediction.key_risk_reasons} />
            {prediction.explanation_method ? (
              <p className="text-xs text-muted-foreground">Explained with {prediction.explanation_method}.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>What to do</h2>
            </CardTitle>
            <CardDescription>Changes to the story or the sprint that the models expect to lower the risk, most effective first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RecommendationList recommendations={prediction.recommendations} from={prediction.spillover_probability} empty={noActionsText(prediction)} />
            <AllDone prediction={prediction} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>What the models had{reduced > 0 ? ` (${reduced} reduced)` : ""}</h2>
          </CardTitle>
          <CardDescription>The groups of inputs behind this prediction, and where each came from.</CardDescription>
        </CardHeader>
        <CardContent>
          <FeatureGroupList prediction={prediction} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>What it was predicted with</h2>
            </CardTitle>
            <CardDescription>The sprint and the team as the models saw them.</CardDescription>
          </CardHeader>
          <CardContent>
            <PredictionContext detail={data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>How sure the models are</h2>
            </CardTitle>
            <CardDescription>How the confidence score is made up.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfidenceExplained score={prediction.confidence_score} breakdown={prediction.confidence_breakdown} />
          </CardContent>
        </Card>
      </div>

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
              <Timeline
                entries={[...data.feedback].reverse().map((entry) => ({
                  id: entry.id,
                  title: `${DECISION_LABELS[entry.decision]}${
                    entry.decision === "adjust" && entry.adjusted_story_points != null ? ` to ${points(entry.adjusted_story_points)} points` : ""
                  }`,
                  detail: entry.reason ? `“${entry.reason}”` : null,
                  at: entry.created_at,
                }))}
              />
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
              <p className="text-sm text-muted-foreground">
                {data.sprint_id
                  ? "Recorded when the sprint closes."
                  : "The story was not in a sprint when this was predicted, so no outcome is recorded for it."}
              </p>
            ) : (
              <Timeline
                entries={[...data.outcomes].reverse().map((outcome) => ({
                  id: outcome.id,
                  title: `${outcome.completed_in_sprint ? "Done in the sprint" : "Spilled over"}${
                    outcome.actual_story_points != null ? `, ${points(outcome.actual_story_points)} points` : ""
                  }${outcome.reopened ? ", reopened" : ""}`,
                  detail: null,
                  at: outcome.created_at,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Collapsible>
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <h2>What the models saw</h2>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" disabled={Object.keys(data.features).length === 0}>
                  Show or hide the {Object.keys(data.features).length} values
                </Button>
              </CollapsibleTrigger>
            </CardTitle>
            <CardDescription>Every input value, as recorded with the prediction.</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div
                tabIndex={0}
                role="region"
                aria-label="Feature values"
                className="max-h-96 overflow-auto rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
    prediction.configuration_id ??
    "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/effort-estimation/predictions">
          <ArrowLeftIcon aria-hidden /> Prediction log
        </Link>
      </Button>
      <PageHeader
        icon={ScrollTextIcon}
        eyebrow="Prediction"
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
      <PredictionDetailBody data={data} label={label} />
    </div>
  );
}
