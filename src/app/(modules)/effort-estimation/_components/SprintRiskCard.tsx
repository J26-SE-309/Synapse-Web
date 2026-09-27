import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { number, percent, points } from "../_lib/format";
import type { SprintRisk } from "../_lib/types";
import { RiskBadge } from "./indicators";
import { RecommendationList } from "./PredictionDetails";

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
      {detail ? <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd> : null}
    </div>
  );
}

/** FR16: whether the whole commitment fits the team's capacity, simulated from every story's interval. */
export function SprintRiskCard({ sprint }: { sprint: SprintRisk }) {
  const capacity = sprint.capacity_points;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Sprint risk</h3>
        </CardTitle>
        <CardDescription>
          The whole commitment against the team&apos;s capacity, from {sprint.runs.toLocaleString()} simulated sprints.
        </CardDescription>
        <CardAction>
          <RiskBadge level={sprint.sprint_risk_level} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure
            label="Chance of over-committing"
            value={sprint.overcommit_probability == null ? "—" : percent(sprint.overcommit_probability)}
          />
          <Figure
            label="Committed points"
            value={points(sprint.committed_points.p50)}
            detail={`likely ${points(sprint.committed_points.p10)}–${points(sprint.committed_points.p90)}`}
          />
          <Figure
            label="Capacity"
            value={capacity ? points(capacity.p50) : "Unknown"}
            detail={capacity ? `likely ${points(capacity.p10)}–${points(capacity.p90)}` : undefined}
          />
          <Figure
            label="Stories likely to spill over"
            value={number(sprint.expected_stories_at_risk, 1)}
            detail={`up to ${sprint.stories_at_risk_p90} of ${sprint.stories}`}
          />
        </dl>

        {capacity == null ? (
          <Alert>
            <InfoIcon aria-hidden />
            <AlertTitle>Over-commitment can&apos;t be judged yet</AlertTitle>
            <AlertDescription>
              Enter the sprint&apos;s planned capacity above, or add the team&apos;s sprint history, so the committed points
              can be compared with what the team delivers.
            </AlertDescription>
          </Alert>
        ) : sprint.expected_overflow_points != null && sprint.expected_overflow_points >= 0.5 ? (
          <p className="text-sm text-muted-foreground">
            If the sprint runs over, expect about <strong className="text-foreground">{points(sprint.expected_overflow_points)} points</strong>{" "}
            not to fit.
          </p>
        ) : null}

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">For the sprint</h4>
          <RecommendationList recommendations={sprint.recommendations} empty="No sprint-wide changes suggested." />
        </section>
      </CardContent>
    </Card>
  );
}
