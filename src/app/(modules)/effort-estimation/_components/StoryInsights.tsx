"use client";

import { ArrowRightIcon, GaugeIcon } from "lucide-react";
import Link from "next/link";

import type { StoryInsightProps } from "@/shared/module-slots";
import { Skeleton } from "@/shared/ui/skeleton";

import { useLatestSprintEstimates, useLatestStoryEstimate } from "../_lib/api";
import { DECISION_LABELS, interval, percent, points, when } from "../_lib/format";
import { ConfidenceIndicator, RiskBadge } from "./indicators";

/** On a story's card in a sprint: the spillover risk of its latest estimate for that sprint, in a word. */
export function StoryRiskBadge({ project, story }: StoryInsightProps) {
  const estimates = useLatestSprintEstimates(project.id, story.sprint_id);
  const latest = estimates.data?.get(story.story_id);
  if (!latest) return null;
  return (
    <span title={`Estimated ${points(latest.predicted_story_points)} points; ${percent(latest.spillover_probability)} chance to spill over`}>
      <RiskBadge level={latest.sprint_risk_level} className="px-1.5 py-0" />
    </span>
  );
}

/** In a story's details: its latest effort and risk estimate, with what was decided about it. */
export function StoryEstimate({ project, story }: StoryInsightProps) {
  const latest = useLatestStoryEstimate(project.id, story.story_id);
  return (
    <section aria-labelledby={`estimate-${story.story_id}`} className="space-y-2 rounded-lg border p-3">
      <h3 id={`estimate-${story.story_id}`} className="flex items-center gap-1.5 text-sm font-medium">
        <GaugeIcon aria-hidden className="size-4 text-primary" /> Effort and risk
      </h3>
      {latest.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : !latest.data ? (
        <p className="text-sm text-muted-foreground">Not estimated yet. Estimate its sprint from the sprint&apos;s page.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Effort</dt>
              <dd className="font-medium">
                {points(latest.data.predicted_story_points)} points{" "}
                <span className="font-normal text-muted-foreground">({interval(latest.data.prediction_interval)})</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Spillover</dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                <RiskBadge level={latest.data.sprint_risk_level} /> {percent(latest.data.spillover_probability)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confidence</dt>
              <dd>
                <ConfidenceIndicator level={latest.data.confidence_level} score={latest.data.confidence_score} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Decision</dt>
              <dd>{latest.data.feedback ? DECISION_LABELS[latest.data.feedback] : "Not reviewed"}</dd>
            </div>
          </dl>
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {when(latest.data.created_at)}
              {latest.data.sprint_id ? ` · ${latest.data.sprint_id}` : ""}
            </span>
            <Link href={`/effort-estimation/predictions/${encodeURIComponent(latest.data.prediction_id)}`} className="inline-flex items-center gap-1">
              Why this estimate <ArrowRightIcon aria-hidden className="size-3" />
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
