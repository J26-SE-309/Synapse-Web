"use client";

import { ArrowRightIcon, PinIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { useSprints } from "@/shared/backlog/api";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useDeletePredictions, useModels, usePredictionPages, type PredictionFilters } from "../_lib/api";
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

/** The filter form's values: everything as typed (times as the datetime-local input gives them). */
type Draft = Record<keyof PredictionFilters, string>;

const EMPTY_DRAFT: Draft = { sprintId: "", storyId: "", from: "", to: "", risk: "", confidence: "", model: "", decision: "", outcome: "" };

function toFilters(draft: Draft): PredictionFilters {
  const time = (value: string) => (value ? new Date(value).toISOString() : undefined);
  const text = (value: string) => value.trim() || undefined;
  return {
    sprintId: text(draft.sprintId),
    storyId: text(draft.storyId),
    from: time(draft.from),
    to: time(draft.to),
    risk: (text(draft.risk) as PredictionFilters["risk"]) ?? undefined,
    confidence: (text(draft.confidence) as PredictionFilters["confidence"]) ?? undefined,
    model: text(draft.model),
    decision: (text(draft.decision) as PredictionFilters["decision"]) ?? undefined,
    outcome: (text(draft.outcome) as PredictionFilters["outcome"]) ?? undefined,
  };
}

function Log({ project, initialFilters }: { project: Project; initialFilters: PredictionFilters }) {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, sprintId: initialFilters.sprintId ?? "", storyId: initialFilters.storyId ?? "" });
  const [filters, setFilters] = useState<PredictionFilters>(initialFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"selected" | "all" | null>(null);
  const pages = usePredictionPages(project.id, filters);
  const models = useModels();
  const sprints = useSprints(project.id);
  const remove = useDeletePredictions(project.id);
  const labels = Object.fromEntries((models.data?.configurations ?? []).map((model) => [model.configuration_id, model.label]));
  const rows = pages.data?.pages.flatMap((page) => page.predictions) ?? [];
  const filtered = Object.values(filters).some(Boolean);
  const shown = rows.filter((row) => selected.has(row.prediction_id));
  const allShown = rows.length > 0 && shown.length === rows.length;

  const set = (name: keyof Draft) => (event: { target: { value: string } }) => setDraft({ ...draft, [name]: event.target.value });

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function confirmDelete() {
    const ids = confirming === "selected" ? shown.map((row) => row.prediction_id) : null;
    try {
      const result = await remove.mutateAsync(ids);
      toast.success(`Deleted ${result.deleted} ${result.deleted === 1 ? "prediction" : "predictions"}`);
      setSelected(new Set());
    } catch (error) {
      toast.error("The predictions were not deleted", { description: describeError(error) });
    } finally {
      setConfirming(null);
    }
  }

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
          className="space-y-3 rounded-xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSelected(new Set());
            setFilters(toFilters(draft));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="filter-sprint">Sprint</FieldLabel>
              <NativeSelect id="filter-sprint" className="w-full" value={draft.sprintId} onChange={set("sprintId")}>
                <NativeSelectOption value="">Any sprint</NativeSelectOption>
                {(sprints.data ?? []).map((sprint) => (
                  <NativeSelectOption key={sprint.sprint_id} value={sprint.sprint_id}>
                    {sprint.name} ({sprint.sprint_id})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-story">Story id</FieldLabel>
              <Input id="filter-story" className="font-mono" maxLength={200} placeholder={`${project.key ?? project.id}-12`} value={draft.storyId} onChange={set("storyId")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-from">From</FieldLabel>
              <Input id="filter-from" type="datetime-local" value={draft.from} onChange={set("from")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-to">To</FieldLabel>
              <Input id="filter-to" type="datetime-local" value={draft.to} onChange={set("to")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-risk">Risk</FieldLabel>
              <NativeSelect id="filter-risk" className="w-full" value={draft.risk} onChange={set("risk")}>
                <NativeSelectOption value="">Any risk</NativeSelectOption>
                <NativeSelectOption value="high">High</NativeSelectOption>
                <NativeSelectOption value="medium">Medium</NativeSelectOption>
                <NativeSelectOption value="low">Low</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-confidence">Confidence</FieldLabel>
              <NativeSelect id="filter-confidence" className="w-full" value={draft.confidence} onChange={set("confidence")}>
                <NativeSelectOption value="">Any confidence</NativeSelectOption>
                <NativeSelectOption value="high">High</NativeSelectOption>
                <NativeSelectOption value="medium">Medium</NativeSelectOption>
                <NativeSelectOption value="low">Low</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-model">Model</FieldLabel>
              <NativeSelect id="filter-model" className="w-full" value={draft.model} onChange={set("model")}>
                <NativeSelectOption value="">Any model</NativeSelectOption>
                {(models.data?.configurations ?? [])
                  .filter((model) => model.status === "available")
                  .map((model) => (
                    <NativeSelectOption key={model.configuration_id} value={model.configuration_id}>
                      {model.label}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-decision">Decision</FieldLabel>
              <NativeSelect id="filter-decision" className="w-full" value={draft.decision} onChange={set("decision")}>
                <NativeSelectOption value="">Any decision</NativeSelectOption>
                <NativeSelectOption value="none">Not reviewed yet</NativeSelectOption>
                <NativeSelectOption value="accept">Accepted</NativeSelectOption>
                <NativeSelectOption value="adjust">Adjusted</NativeSelectOption>
                <NativeSelectOption value="reject">Rejected</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-outcome">Outcome</FieldLabel>
              <NativeSelect id="filter-outcome" className="w-full" value={draft.outcome} onChange={set("outcome")}>
                <NativeSelectOption value="">Any outcome</NativeSelectOption>
                <NativeSelectOption value="pending">Not known yet</NativeSelectOption>
                <NativeSelectOption value="done">Done in the sprint</NativeSelectOption>
                <NativeSelectOption value="spilled">Spilled over</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              <SearchIcon aria-hidden /> Filter
            </Button>
            {filtered ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(EMPTY_DRAFT);
                  setFilters({});
                  setSelected(new Set());
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
                {filtered
                  ? "Try other filters."
                  : "Estimate a sprint from its page, under Sprints, or one story under Predict a story, and every estimate appears here."}
              </EmptyDescription>
            </EmptyHeader>
            {!filtered ? (
              <EmptyContent>
                <Button asChild>
                  <Link href="/sprints">Go to sprints</Link>
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={shown.length === 0} onClick={() => setConfirming("selected")}>
                <Trash2Icon aria-hidden /> Delete selected{shown.length ? ` (${shown.length})` : ""}
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirming("all")}>
                <Trash2Icon aria-hidden /> Delete all of this project&apos;s predictions
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allShown ? true : shown.length > 0 ? "indeterminate" : false}
                        onCheckedChange={(on) => setSelected(on === true ? new Set(rows.map((row) => row.prediction_id)) : new Set())}
                        aria-label="Select every prediction listed"
                      />
                    </TableHead>
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
                    <TableRow key={row.prediction_id} data-state={selected.has(row.prediction_id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.prediction_id)}
                          onCheckedChange={(on) => toggle(row.prediction_id, on === true)}
                          aria-label={`Select the prediction for ${row.story_id} made ${when(row.created_at)}`}
                        />
                      </TableCell>
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

      <AlertDialog open={confirming !== null} onOpenChange={(open) => (open ? null : setConfirming(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "all"
                ? `Delete every prediction of ${project.name}?`
                : `Delete ${shown.length} ${shown.length === 1 ? "prediction" : "predictions"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "all"
                ? "The whole prediction log of this project is removed, whatever the filters show, with every decision and outcome recorded on it. This cannot be undone."
                : "The selected predictions are removed with the decisions and outcomes recorded on them. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? <Spinner aria-hidden /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PredictionLogView({ initialFilters = {} }: { initialFilters?: PredictionFilters }) {
  return <ProjectGate>{(project) => <Log key={project.id} project={project} initialFilters={initialFilters} />}</ProjectGate>;
}
