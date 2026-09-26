import { CircleCheckIcon, CircleDashedIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { ACTION_LABELS, FEATURE_GROUP_LABELS, FEATURE_SOURCE_LABELS, label } from "../_lib/format";
import type { Prediction, Recommendation } from "../_lib/types";
import { ReasonList } from "./indicators";

export function RecommendationList({ recommendations, empty }: { recommendations: Recommendation[]; empty?: string }) {
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
        <RecommendationList recommendations={prediction.recommendations} />
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
