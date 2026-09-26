"use client";

import { ArrowRightIcon, PinIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useModels, usePredictionPages, type PredictionFilters } from "../_lib/api";
import { DECISION_LABELS, interval, points, when } from "../_lib/format";
import type { OutcomeBrief } from "../_lib/types";
import { ConfidenceIndicator, RiskBadge } from "./indicators";
import { SummaryCards } from "./SummaryCards";

function Outcome({ outcome }: { outcome: OutcomeBrief | null | undefined }) {
  if (!outcome) return <span className="text-muted-foreground">Not known yet</span>;
  return (
    <span>
      {outcome.completed_in_sprint ? "Done in the sprint" : "Spilled over"}
      {outcome.actual_story_points != null ? `, ${points(outcome.actual_story_points)} pts` : ""}
      {outcome.reopened ? ", reopened" : ""}
    </span>
  );
}

function Log({ project }: { project: Project }) {
  const [draft, setDraft] = useState<PredictionFilters>({});
  const [filters, setFilters] = useState<PredictionFilters>({});
  const pages = usePredictionPages(project.id, filters);
  const models = useModels();
  const labels = Object.fromEntries((models.data?.configurations ?? []).map((model) => [model.configuration_id, model.label]));
  const rows = pages.data?.pages.flatMap((page) => page.predictions) ?? [];
  const filtered = !!(filters.sprintId || filters.storyId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Prediction log"
        description="Every estimate made for this project, which model made it (FR21), what was decided about it, and what happened in the sprint (FR19)."
      />

      <SummaryCards project={project} />

      <section aria-labelledby="log-heading" className="space-y-3">
        <h2 id="log-heading" className="text-lg font-semibold">
          Predictions <span className="text-sm font-normal text-muted-foreground">(newest first)</span>
        </h2>
        <form
          role="search"
          aria-label="Filter the predictions"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ sprintId: draft.sprintId?.trim() || undefined, storyId: draft.storyId?.trim() || undefined });
          }}
        >
          <Field className="sm:max-w-56">
            <FieldLabel htmlFor="filter-sprint">Sprint id</FieldLabel>
            <Input
              id="filter-sprint"
              className="font-mono"
              maxLength={100}
              value={draft.sprintId ?? ""}
              onChange={(event) => setDraft({ ...draft, sprintId: event.target.value })}
            />
          </Field>
          <Field className="sm:max-w-56">
            <FieldLabel htmlFor="filter-story">Story id</FieldLabel>
            <Input
              id="filter-story"
              className="font-mono"
              maxLength={200}
              value={draft.storyId ?? ""}
              onChange={(event) => setDraft({ ...draft, storyId: event.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              <SearchIcon aria-hidden /> Filter
            </Button>
            {filtered ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft({});
                  setFilters({});
                }}
              >
                <XIcon aria-hidden /> Clear
              </Button>
            ) : null}
          </div>
        </form>

        {pages.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : pages.isError ? (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>The predictions could not be loaded</AlertTitle>
            <AlertDescription>{describeError(pages.error)}</AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{filtered ? "No prediction matches" : "No predictions yet"}</EmptyTitle>
              <EmptyDescription>
                {filtered ? "Try another sprint or story id." : "Estimates made on the sprint planning page appear here."}
              </EmptyDescription>
            </EmptyHeader>
            {!filtered ? (
              <EmptyContent>
                <Button asChild>
                  <Link href="/effort-estimation/plan">Plan a sprint</Link>
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Story</TableHead>
                    <TableHead>Effort</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.prediction_id}>
                      <TableCell className="text-sm">{when(row.created_at)}</TableCell>
                      <TableCell>
                        <p className="font-mono text-xs">{row.story_id}</p>
                        {row.sprint_id ? <p className="font-mono text-xs text-muted-foreground">{row.sprint_id}</p> : null}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {points(row.predicted_story_points)}{" "}
                        <span className="text-xs text-muted-foreground">({interval(row.prediction_interval)})</span>
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={row.sprint_risk_level} suffix="" />
                      </TableCell>
                      <TableCell>
                        <ConfidenceIndicator level={row.confidence_level} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          {row.selection_mode === "pinned" ? (
                            <>
                              <PinIcon aria-hidden className="size-3.5" />
                              <span className="sr-only">Chosen by you: </span>
                            </>
                          ) : null}
                          {labels[row.configuration_id] ?? row.configuration_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{row.feedback ? DECISION_LABELS[row.feedback] : "—"}</TableCell>
                      <TableCell className="text-sm">
                        <Outcome outcome={row.outcome} />
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/effort-estimation/predictions/${row.prediction_id}`}>
                            Open <span className="sr-only">the prediction for {row.story_id}</span>
                            <ArrowRightIcon aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pages.hasNextPage ? (
              <Button variant="outline" onClick={() => pages.fetchNextPage()} disabled={pages.isFetchingNextPage}>
                {pages.isFetchingNextPage ? <Spinner aria-hidden /> : null}
                Show more
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export function PredictionLogView() {
  return <ProjectGate>{(project) => <Log key={project.id} project={project} />}</ProjectGate>;
}
