import { ArrowRightIcon, CircleCheckIcon, CircleDashedIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { ACTION_LABELS, FEATURE_GROUP_LABELS, FEATURE_SOURCE_LABELS, label, percent } from "../_lib/format";
import type { Prediction, Recommendation, RiskEffect } from "../_lib/types";
import { ReasonList, RiskBadge } from "./indicators";

/** "Once done: 66% → 48%, Medium risk" (or that the models expect little change). */
function Effect({ effect, from }: { effect: RiskEffect; from: number }) {
  const drop = from - effect.spillover_probability;
  return (
    <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full bg-muted/70 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">Once done:</span>
      <span className="inline-flex items-center gap-1 font-medium tabular-nums">
        {percent(from)} <ArrowRightIcon aria-label="becomes" className="size-3" /> {percent(effect.spillover_probability)}
      </span>
      <RiskBadge level={effect.sprint_risk_level} variant="subtle" />
      {drop < 0.005 ? <span className="text-muted-foreground">(little change on its own)</span> : null}
    </p>
  );
}

/** The changes suggested for a story or a sprint, most effective first, each with what it is expected to do. */
export function RecommendationList({
  recommendations,
  empty,
  from,
}: {
  recommendations: Recommendation[];
  empty?: string;
  /** The story's spillover probability now, to show what each action is expected to change. */
  from?: number;
}) {
  if (recommendations.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">{empty ?? "No changes suggested."}</p>;
  }
  const effects = from !== undefined && recommendations.some((recommendation) => recommendation.expected_effect);
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {recommendations.map((recommendation, index) => (
          <li key={`${recommendation.action}-${index}`} className="flex gap-3 rounded-xl border bg-background/40 p-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5 text-sm">
              <p className="font-medium">{label(ACTION_LABELS, recommendation.action)}</p>
              <p className="text-muted-foreground">{recommendation.message}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">Because of: {recommendation.triggered_by}</span>
                {recommendation.expected_effect && from !== undefined ? <Effect effect={recommendation.expected_effect} from={from} /> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {effects ? (
        <p className="text-xs text-muted-foreground">
          The models predicted the story again with each change made; estimate it again once the work is done to see the
          new risk.
        </p>
      ) : null}
    </div>
  );
}

/** The risk once every suggested action is done, as one highlighted line. */
export function AllDone({ prediction }: { prediction: Prediction }) {
  if (!prediction.risk_if_all_done) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gradient-to-r from-primary/12 to-chart-3/8 p-4 ring-1 ring-primary/20">
      <SparklesIcon aria-hidden className="size-5 shrink-0 text-primary" />
      <p className="text-sm font-medium">If you do all of these</p>
      <Effect effect={prediction.risk_if_all_done} from={prediction.spillover_probability} />
    </div>
  );
}

export function noActionsText(prediction: Prediction): string {
  return prediction.sprint_risk_level === "low"
    ? "None needed: the risk is low."
    : "None: the main factors are not something this story can change (such as its type or priority), or they give nothing to act on.";
}

/** Which feature groups the models had, and where each came from (FR17: reduced ones are flagged). */
export function FeatureGroupList({ prediction }: { prediction: Prediction }) {
  const degraded = new Set(prediction.degraded_feature_groups ?? []);
  const sources = prediction.feature_sources ?? {};
  const groups = Object.keys(sources).length > 0 ? Object.keys(sources) : prediction.feature_groups_used;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const source = sources[group];
        const reduced = degraded.has(group) || source === "proxy" || source === "missing";
        const Icon = source === "missing" ? CircleDashedIcon : reduced ? TriangleAlertIcon : CircleCheckIcon;
        return (
          <li key={group} className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm", reduced && "border-warning/40 bg-warning-soft/40")}>
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", reduced ? "text-warning" : "text-success")} />
            <span className="min-w-0">
              <span className="block font-medium">{label(FEATURE_GROUP_LABELS, group)}</span>
              {source ? <span className="block text-xs text-muted-foreground">{label(FEATURE_SOURCE_LABELS, source)}</span> : null}
              {reduced ? <span className="sr-only"> (reduced)</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Why the models said what they said, what to do about it, and what they had to go on. */
export function PredictionDetails({ prediction }: { prediction: Prediction }) {
  const reduced = (prediction.degraded_feature_groups ?? []).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Main factors</h3>
          <ReasonList reasons={prediction.key_risk_reasons} />
          {prediction.explanation_method ? (
            <p className="text-xs text-muted-foreground">Explained with {prediction.explanation_method}.</p>
          ) : null}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Suggested actions</h3>
          <RecommendationList recommendations={prediction.recommendations} from={prediction.spillover_probability} empty={noActionsText(prediction)} />
          <AllDone prediction={prediction} />
        </section>
      </div>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">What the models had{reduced > 0 ? ` (${reduced} reduced)` : ""}</h3>
        <FeatureGroupList prediction={prediction} />
        <p className="text-xs break-all text-muted-foreground">Model version {prediction.model_version}</p>
      </section>
    </div>
  );
}
