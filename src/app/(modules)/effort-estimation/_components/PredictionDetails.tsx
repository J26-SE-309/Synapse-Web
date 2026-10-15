import { CircleCheckIcon, CircleDashedIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { ACTION_LABELS, FEATURE_GROUP_LABELS, FEATURE_SOURCE_LABELS, label, percent } from "../_lib/format";
import type { Prediction, Recommendation, RiskEffect } from "../_lib/types";
import { ReasonList, RiskBadge } from "./indicators";

/** "Risk once done: 66% → 48%, Medium" (or that the models expect little change). */
function Effect({ effect, from }: { effect: RiskEffect; from: number }) {
  const drop = from - effect.spillover_probability;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <span className="text-muted-foreground">Once done, the models expect:</span>
      <span className="font-medium tabular-nums">
        {percent(from)} → {percent(effect.spillover_probability)}
      </span>
      <RiskBadge level={effect.sprint_risk_level} />
      {drop < 0.005 ? <span className="text-muted-foreground">(little change on its own)</span> : null}
    </p>
  );
}

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
    return <p className="text-sm text-muted-foreground">{empty ?? "No changes suggested."}</p>;
  }
  return (
    <ul className="space-y-3">
      {recommendations.map((recommendation, index) => (
        <li key={`${recommendation.action}-${index}`} className="flex gap-2.5 text-sm">
          <LightbulbIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="font-medium">{label(ACTION_LABELS, recommendation.action)}</p>
            <p className="text-muted-foreground">{recommendation.message}</p>
            <p className="text-xs text-muted-foreground">Because of: {recommendation.triggered_by}</p>
            {recommendation.expected_effect && from !== undefined ? <Effect effect={recommendation.expected_effect} from={from} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Which feature groups the models had, and where each came from (FR17: reduced ones are flagged). */
export function FeatureGroupList({ prediction }: { prediction: Prediction }) {
  const degraded = new Set(prediction.degraded_feature_groups ?? []);
  const sources = prediction.feature_sources ?? {};
  const groups = Object.keys(sources).length > 0 ? Object.keys(sources) : prediction.feature_groups_used;
  return (
    <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {groups.map((group) => {
        const source = sources[group];
        const reduced = degraded.has(group) || source === "proxy" || source === "missing";
        const Icon = source === "missing" ? CircleDashedIcon : reduced ? TriangleAlertIcon : CircleCheckIcon;
        return (
          <li key={group} className="flex items-start gap-2">
            <Icon
              aria-hidden
              className={cn("mt-0.5 size-4 shrink-0", reduced ? "text-warning" : "text-success")}
            />
            <span>
              <span className="font-medium">{label(FEATURE_GROUP_LABELS, group)}</span>
              {source ? <span className="text-muted-foreground"> — {label(FEATURE_SOURCE_LABELS, source)}</span> : null}
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
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Main factors</h3>
        <ReasonList reasons={prediction.key_risk_reasons} />
        {prediction.explanation_method ? (
          <p className="text-xs text-muted-foreground">Explained with {prediction.explanation_method}.</p>
        ) : null}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Suggested actions</h3>
        <RecommendationList
          recommendations={prediction.recommendations}
          from={prediction.spillover_probability}
          empty={
            prediction.sprint_risk_level === "low"
              ? "None needed: the risk is low."
              : "None: the main factors are not something this story can change (such as its type or priority), or they give nothing to act on."
          }
        />
        {prediction.risk_if_all_done ? (
          <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">If you do all of these</p>
            <Effect effect={prediction.risk_if_all_done} from={prediction.spillover_probability} />
          </div>
        ) : null}
        {prediction.recommendations.some((recommendation) => recommendation.expected_effect) ? (
          <p className="text-xs text-muted-foreground">
            The models predicted the story again with each change made; estimate it again once the work is done to see the
            new risk.
          </p>
        ) : null}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          What the models had{reduced > 0 ? ` (${reduced} reduced)` : ""}
        </h3>
        <FeatureGroupList prediction={prediction} />
        <p className="text-xs break-all text-muted-foreground">Model version {prediction.model_version}</p>
      </section>
    </div>
  );
}
