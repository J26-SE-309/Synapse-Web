import { AlertTriangleIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";

import type {
  InvestAssessment,
  QualityEvaluation as QualityEvaluationData,
  ReviewStatus,
  UnsupportedAssumption,
  UserStory,
  ValidatedRequirement,
} from "../_lib/types";

type StatusValue = ReviewStatus | "Changes Requested" | "Validated" | "Validated with notes" | "Ready" | "Pass" | "Fail" | "Not Assessed" | "Recommended" | "Needs Improvement" | "Optimized" | "Human Verified" | "Warning" | "Missing" | "Needs Human Decision";

export function StatusBadge({ status }: { status: StatusValue }) {
  const tone = status === "Approved" || status === "Validated" || status === "Ready" || status === "Pass" || status === "Human Verified"
    ? "bg-success-soft text-success"
    : status === "Recommended" || status === "Optimized"
      ? "bg-primary/10 text-primary"
    : status === "Rejected" || status === "Needs Improvement" || status === "Missing" || status === "Fail"
      ? "bg-destructive/10 text-destructive"
      : "bg-warning/15 text-warning";
  return <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium ${tone}`}>{status}</span>;
}

export function QualityScore({
  label,
  score,
  overall = false,
  rationale,
}: {
  label: string;
  score: number;
  overall?: boolean;
  rationale?: string;
}) {
  const percentage = Math.round(score * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={overall ? "font-semibold" : "font-medium"}>{label}</span>
        <span className={`font-mono tabular-nums ${overall ? "text-base font-semibold" : "text-xs"}`}>{percentage}%</span>
      </div>
      <Progress value={percentage} aria-label={`${label} score`} />
      {rationale ? <p className="text-xs leading-relaxed text-muted-foreground">{rationale}</p> : null}
    </div>
  );
}

export function RequirementCard({ requirement, headingId }: { requirement: ValidatedRequirement; headingId?: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{requirement.id}</p>
            <CardTitle id={headingId} className="mt-1 text-base">{requirement.title}</CardTitle>
          </div>
          <StatusBadge status={requirement.validationStatus} />
        </div>
        <CardDescription className="text-sm leading-relaxed text-foreground">{requirement.text}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Component 1 Quality Score</p>
          <p className="font-mono text-lg font-semibold tabular-nums">{requirement.qualityScore === undefined ? "Not supplied" : `${Math.round(requirement.qualityScore * 100)}%`}</p>
        </div>
        <p className="text-xs text-muted-foreground">{requirement.source} · {requirement.validatedAt}</p>
      </CardContent>
    </Card>
  );
}

export function UserStoryCard({
  story,
  title = "User Story",
  actions,
}: {
  story: UserStory;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{story.requirementId} · {story.storyId}</p>
          <h3 className="mt-1 text-sm font-semibold">{title}</h3>
        </div>
        {actions}
      </div>
      <blockquote className="border-l-2 border-primary pl-4 text-sm font-medium leading-relaxed">{story.text}</blockquote>
    </article>
  );
}

export function QualityEvaluation({ scores }: { scores: QualityEvaluationData }) {
  return (
    <section aria-label="Quality Evaluation" className="space-y-3">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Quality Evaluation</h3>
      <div className="space-y-3">
        {scores.map((dimension) => <QualityScore key={dimension.key} label={dimension.label} score={dimension.score} rationale={dimension.rationale} />)}
      </div>
    </section>
  );
}

export function INVESTChecklist({ criteria }: { criteria: InvestAssessment[] }) {
  const counts = criteria.reduce<Record<InvestAssessment["status"], number>>((result, item) => {
    result[item.status] += 1;
    return result;
  }, { Pass: 0, Warning: 0, Fail: 0, "Not Assessed": 0 });
  const summary = counts.Fail
    ? `${counts.Fail} principle(s) need improvement. Address the recommendations before treating the story as ready.`
    : counts.Warning || counts["Not Assessed"]
      ? `${counts.Pass} pass, ${counts.Warning} warning, ${counts["Not Assessed"]} not assessed. Team and Product Owner judgement is still required.`
      : "All six prototype checks pass. Confirm the assessment with the delivery team before approval.";
  return (
    <section aria-label="INVEST Checklist" className="space-y-3">
      <div><h3 className="text-xs font-semibold uppercase text-muted-foreground">INVEST Checklist</h3><p className="mt-1 text-sm text-muted-foreground" role="status">{summary}</p></div>
      <div className="space-y-3">
        {criteria.map((criterion) => (
          <article key={criterion.name} className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${criterion.status === "Pass" ? "bg-success" : criterion.status === "Fail" ? "bg-destructive" : "bg-warning"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{criterion.name}</p><StatusBadge status={criterion.status} /></div>
              <p className="text-xs leading-relaxed text-muted-foreground">{criterion.rationale}</p>
              <p className="mt-2 text-xs"><span className="font-semibold">Recommended improvement: </span>{criterion.recommendation}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AssumptionList({ assumptions }: { assumptions: UnsupportedAssumption[] }) {
  return (
    <section aria-label="Unsupported Assumptions" className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><AlertTriangleIcon aria-hidden className="size-4 text-warning" /> Unsupported Assumptions</h3>
        {assumptions.length ? (
          <ul className="space-y-2">{assumptions.map((item) => <li key={item.assumption} className="rounded-sm bg-warning/10 p-3 text-xs"><p className="font-medium">“{item.assumption}”</p><p className="mt-1 text-muted-foreground">{item.why}</p></li>)}</ul>
        ) : <p className="text-xs text-success">No unsupported assumptions detected in the current mock assessment.</p>}
    </section>
  );
}