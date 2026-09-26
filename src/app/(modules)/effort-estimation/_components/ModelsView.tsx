"use client";

import { AwardIcon, PinIcon, SparklesIcon, TimerIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/shared/lib/utils";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useChooseModel, useModels, usePin } from "../_lib/api";
import { METRIC_LABELS, milliseconds, number, percent, when } from "../_lib/format";
import type { ModelsResponse, ModelSummary } from "../_lib/types";
import { CompareModels } from "./CompareModels";

const AUTOMATIC = "__automatic";
/** Pairs slower than this for a 50-story backlog are marked, so a product owner knows the cost of choosing one. */
const SLOW_SECONDS = 0.5;

const WEIGHT_LABELS: Record<string, string> = {
  effort_sa: "effort accuracy",
  risk_f1: "risk F1",
  calibration: "calibration",
  latency: "speed",
};

function statusText(model: ModelSummary): string | null {
  if (model.status === "planned") return "Not trained yet";
  if (model.status === "not installed") return "Not installed on this server";
  return null;
}

function Notes({ model, winner }: { model: ModelSummary; winner: string }) {
  const slow = (model.metrics.latency_p95 ?? 0) > SLOW_SECONDS;
  return (
    <span className="flex flex-wrap gap-1.5">
      {model.configuration_id === winner ? (
        <Badge variant="secondary">
          <AwardIcon aria-hidden /> Best overall
        </Badge>
      ) : null}
      {slow ? (
        <Badge variant="outline" className="text-warning">
          <TimerIcon aria-hidden /> Slower
        </Badge>
      ) : null}
      {model.eligible === false ? (
        <Badge variant="outline" className="text-danger">
          <TriangleAlertIcon aria-hidden /> Misses: {model.failed_requirements?.join(", ")}
        </Badge>
      ) : null}
    </span>
  );
}

function ModelChooser({ project, models }: { project: Project; models: ModelsResponse }) {
  const pin = usePin(project.id);
  const choose = useChooseModel(project.id);
  const current = pin.data?.configuration_id ?? AUTOMATIC;
  const [selected, setSelected] = useState<string | null>(null);
  const value = selected ?? current;
  const winner = models.configurations.find((model) => model.configuration_id === models.pooled_winner);
  const available = models.configurations.filter((model) => model.status === "available");

  async function save() {
    try {
      const pinned = await choose.mutateAsync(value === AUTOMATIC ? null : value);
      setSelected(null);
      toast.success(
        pinned.configuration_id
          ? `${project.name} now uses ${models.configurations.find((m) => m.configuration_id === pinned.configuration_id)?.label}`
          : `${project.name} is back on automatic selection`,
      );
    } catch (error) {
      toast.error("The model was not changed", { description: describeError(error) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Model for {project.name}</h2>
        </CardTitle>
        <CardDescription>
          Automatic uses the pair ranked best for this project (FR11). Choose one yourself to use it for every estimate
          of this project until you change it (FR12).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pin.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <RadioGroup value={value} onValueChange={setSelected} aria-label={`Model for ${project.name}`} className="gap-2">
            {[
              { id: AUTOMATIC, model: undefined as ModelSummary | undefined },
              ...available.map((model) => ({ id: model.configuration_id, model })),
            ].map(({ id, model }) => (
              <label
                key={id}
                htmlFor={`model-${id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40",
                  value === id && "border-primary/50 bg-accent/60",
                )}
              >
                <RadioGroupItem id={`model-${id}`} value={id} className="mt-0.5" />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {model ? model.label : (
                      <>
                        <SparklesIcon aria-hidden className="size-4 text-primary" /> Automatic (recommended)
                      </>
                    )}
                    {id === current ? <Badge variant="outline">In use</Badge> : null}
                    {model ? <Notes model={model} winner={models.pooled_winner} /> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {model
                      ? `${model.role}. Effort accuracy ${number(model.metrics.sa, 1)}%, risk F1 ${number(model.metrics.f1)}, ${milliseconds(model.metrics.latency_p95)} for 50 stories.`
                      : `Currently ${winner?.label ?? models.pooled_winner} overall; a project with its own ranking gets its own best pair.`}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pin.data?.configuration_id ? (
            <span className="inline-flex items-center gap-1">
              <PinIcon aria-hidden className="size-3.5" /> Chosen {when(pin.data.pinned_at)}
            </span>
          ) : (
            "Automatic selection"
          )}
        </p>
        <div className="flex gap-2">
          {selected !== null && selected !== current ? (
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          ) : null}
          <Button onClick={save} disabled={selected === null || selected === current || choose.isPending}>
            Save choice
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function Leaderboard({ models, pinned }: { models: ModelsResponse; pinned: string | null | undefined }) {
  const ranked = [...models.configurations].sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  const weights = Object.entries(models.weights)
    .map(([key, weight]) => `${percent(weight)} ${WEIGHT_LABELS[key] ?? key}`)
    .join(" + ");
  const columns = ["sa", "mae", "f1", "ece", "latency_p95"] as const;

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="leaderboard-heading" className="text-lg font-semibold">
          Leaderboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Every encoder + learner pair of the arena ({models.arena}), tested on the same held-out stories. The score is{" "}
          {weights}.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Pair</TableHead>
              <TableHead className="text-right">Score</TableHead>
              {columns.map((key) => (
                <TableHead key={key} className="text-right">
                  {METRIC_LABELS[key].label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((model, index) => {
              const status = statusText(model);
              return (
                <TableRow key={model.configuration_id} className={cn(status && "text-muted-foreground")}>
                  <TableCell className="tabular-nums">{model.composite == null ? "—" : index + 1}</TableCell>
                  <TableCell className="min-w-60 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {model.label}
                      {model.configuration_id === pinned ? (
                        <Badge variant="outline">
                          <PinIcon aria-hidden /> Your choice
                        </Badge>
                      ) : null}
                      <Notes model={model} winner={models.pooled_winner} />
                    </div>
                    <p className="text-xs text-muted-foreground">{status ?? model.role}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{number(model.composite, 3)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {model.metrics.sa == null ? "—" : `${number(model.metrics.sa, 1)}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{number(model.metrics.mae)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(model.metrics.f1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(model.metrics.ece, 3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{milliseconds(model.metrics.latency_p95)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {columns.map((key) => (
          <div key={key}>
            <dt className="inline font-medium text-foreground">{METRIC_LABELS[key].label}: </dt>
            <dd className="inline">{key === "latency_p95" ? "time to estimate a 50-story backlog, 95th percentile" : METRIC_LABELS[key].hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Models({ project }: { project: Project }) {
  const models = useModels();
  const pin = usePin(project.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Models"
        description="The Comparative Model Arena's encoder + learner pairs. Keep automatic selection, or choose the pair this project should use, and compare pairs side by side on your own stories."
      />
      {models.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : models.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The models could not be loaded</AlertTitle>
          <AlertDescription>{describeError(models.error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          <ModelChooser project={project} models={models.data} />
          <Leaderboard models={models.data} pinned={pin.data?.configuration_id} />
          <CompareModels project={project} models={models.data} />
        </>
      )}
    </div>
  );
}

export function ModelsView() {
  return <ProjectGate>{(project) => <Models key={project.id} project={project} />}</ProjectGate>;
}
