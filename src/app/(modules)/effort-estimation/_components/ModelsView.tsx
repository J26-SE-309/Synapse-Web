"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  AwardIcon,
  CheckIcon,
  PinIcon,
  SparklesIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "lucide-react";
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
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useChooseModel, useModels, usePin } from "../_lib/api";
import { METRIC_LABELS, milliseconds, number, percent, when } from "../_lib/format";
import type { ModelsResponse, ModelSummary } from "../_lib/types";
import { CompareModels } from "./CompareModels";

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

const ENCODERS: Record<string, string> = {
  tfidf: "TF-IDF",
  fasttext: "FastText",
  sbert: "SBERT",
  distilbert: "DistilBERT",
  several: "Several",
};

const LEARNERS: Record<string, string> = {
  lightgbm: "LightGBM",
  random_forest: "Random forest",
  svm: "SVR / SVM",
  xgboost: "XGBoost",
  catboost: "CatBoost",
  mlp: "Multi-task MLP",
  stack: "Stack",
  distilbert: "Fine-tuned",
};

/**
 * How one pair compares with the others on a metric, as a bar from 15% (the worst of the pairs) to 100% (the best).
 * Speed spans milliseconds to seconds, so it is compared on a log scale.
 */
export function relativeScore(value: number | undefined, values: number[], higherIsBetter: boolean, log = false): number | null {
  if (value == null || values.length === 0) return null;
  const scale = (entry: number) => (log ? Math.log10(Math.max(entry, 1e-6)) : entry);
  const scaled = values.map(scale);
  const lowest = Math.min(...scaled);
  const highest = Math.max(...scaled);
  if (highest === lowest) return 1;
  const share = (scale(value) - lowest) / (highest - lowest);
  return 0.15 + 0.85 * (higherIsBetter ? share : 1 - share);
}

function Meter({ label, value, score }: { label: string; value: string; score: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        {score !== null ? <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} /> : null}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  rank,
  all,
  winner,
  inUse,
  busy,
  onUse,
}: {
  model: ModelSummary;
  rank: number | null;
  all: ModelSummary[];
  winner: string;
  inUse: boolean;
  busy: boolean;
  onUse: () => void;
}) {
  const status = statusText(model);
  const scored = all.filter((entry) => entry.metrics.sa != null);
  const values = (key: string) => scored.map((entry) => entry.metrics[key]).filter((entry) => entry != null);
  const available = model.status === "available";
  return (
    <Card
      size="sm"
      className={cn("relative gap-3 transition-shadow", inUse ? "ring-2 ring-primary" : "hover:shadow-md", !available && "opacity-75")}
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <h3 className="leading-snug">{model.label}</h3>
          {rank !== null ? (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums" title="Rank on the leaderboard">
              #{rank}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">{status ?? model.role}</span>
          <span className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="font-normal">
              {ENCODERS[model.configuration.encoder] ?? model.configuration.encoder}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {LEARNERS[model.configuration.learner] ?? model.configuration.learner}
            </Badge>
            <Notes model={model} winner={winner} />
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        <Meter
          label="Effort accuracy"
          value={model.metrics.sa == null ? "—" : `${number(model.metrics.sa, 1)}%`}
          score={relativeScore(model.metrics.sa, values("sa"), true)}
        />
        <Meter label="Risk F1" value={number(model.metrics.f1)} score={relativeScore(model.metrics.f1, values("f1"), true)} />
        <Meter
          label="Calibration error"
          value={number(model.metrics.ece, 3)}
          score={relativeScore(model.metrics.ece, values("ece"), false)}
        />
        <Meter
          label="Speed (50 stories)"
          value={milliseconds(model.metrics.latency_p95)}
          score={relativeScore(model.metrics.latency_p95, values("latency_p95"), false, true)}
        />
      </CardContent>
      <CardFooter className="mt-auto">
        {inUse ? (
          <p className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-sm font-medium text-primary">
            <CheckIcon aria-hidden className="size-4" /> In use for this project
          </p>
        ) : (
          <Button variant="outline" className="w-full" disabled={!available || busy} onClick={onUse}>
            {available ? "Use this model" : status}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function ModelCards({ project, models }: { project: Project; models: ModelsResponse }) {
  const pin = usePin(project.id);
  const choose = useChooseModel(project.id);
  const current = pin.data?.configuration_id ?? null;
  const winner = models.configurations.find((model) => model.configuration_id === models.pooled_winner);
  const ranked = [...models.configurations].sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  const ranks = new Map(ranked.filter((model) => model.composite != null).map((model, index) => [model.configuration_id, index + 1]));
  const order = [...models.configurations].sort(
    (a, b) =>
      Number(b.status === "available") - Number(a.status === "available") ||
      (ranks.get(a.configuration_id) ?? 99) - (ranks.get(b.configuration_id) ?? 99),
  );

  async function use(configurationId: string | null) {
    try {
      const pinned = await choose.mutateAsync(configurationId);
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
    <section aria-labelledby="choose-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="choose-heading" className="text-lg font-semibold">
          Model for {project.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Automatic uses the pair ranked best for this project (FR11). Choose one yourself to use it for every estimate of
          this project until you change it (FR12). The bars compare each pair with the others.
        </p>
        <p className="text-sm" aria-live="polite">
          {pin.isPending ? (
            "Loading…"
          ) : current ? (
            <span className="inline-flex items-center gap-1">
              <PinIcon aria-hidden className="size-3.5" /> In use: {models.configurations.find((m) => m.configuration_id === current)?.label ?? current}, chosen {when(pin.data?.pinned_at)}
            </span>
          ) : (
            `In use: automatic selection (${winner?.label ?? models.pooled_winner} overall).`
          )}
        </p>
      </div>
      {pin.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card size="sm" className={cn("relative gap-3 bg-gradient-to-br from-primary/10 to-transparent", current === null && "ring-2 ring-primary")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon aria-hidden className="size-4 text-primary" />
                <h3>Automatic</h3>
                <Badge variant="secondary">Recommended</Badge>
              </CardTitle>
              <CardDescription>
                Uses the pair that suits this project: its own best pair once it has enough closed sprints, otherwise the
                best overall. Now: <strong className="text-foreground">{winner?.label ?? models.pooled_winner}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Pairs that miss a requirement (for example the 2-second limit) are never picked automatically.
            </CardContent>
            <CardFooter className="mt-auto">
              {current === null ? (
                <p className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-sm font-medium text-primary">
                  <CheckIcon aria-hidden className="size-4" /> In use for this project
                </p>
              ) : (
                <Button className="w-full" disabled={choose.isPending} onClick={() => use(null)}>
                  Use automatic selection
                </Button>
              )}
            </CardFooter>
          </Card>
          {order.map((model) => (
            <ModelCard
              key={model.configuration_id}
              model={model}
              rank={ranks.get(model.configuration_id) ?? null}
              all={models.configurations}
              winner={models.pooled_winner}
              inUse={current === model.configuration_id}
              busy={choose.isPending}
              onUse={() => use(model.configuration_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type SortKey = "composite" | "sa" | "mae" | "f1" | "ece" | "latency_p95";
/** Which way is better for each column: the first click sorts best first. */
const BETTER_HIGH: Record<SortKey, boolean> = { composite: true, sa: true, mae: false, f1: true, ece: false, latency_p95: false };

/** A leaderboard column header that sorts by that column: best first on the first click, then the other way. */
function SortHeader({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortKey;
  label: string;
  sort: { key: SortKey; bestFirst: boolean };
  onSort: (next: { key: SortKey; bestFirst: boolean }) => void;
}) {
  const active = sort.key === column;
  const ascending = BETTER_HIGH[column] ? !sort.bestFirst : sort.bestFirst;
  return (
    <TableHead className="text-right" aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded hover:text-foreground"
        onClick={() => onSort({ key: column, bestFirst: active ? !sort.bestFirst : true })}
      >
        {label}
        {active ? (
          sort.bestFirst ? <ArrowDownIcon aria-hidden className="size-3.5" /> : <ArrowUpIcon aria-hidden className="size-3.5" />
        ) : (
          <ArrowUpDownIcon aria-hidden className="size-3.5 opacity-40" />
        )}
        <span className="sr-only">{active ? (sort.bestFirst ? ", best first" : ", worst first") : ", sort"}</span>
      </button>
    </TableHead>
  );
}

function Leaderboard({ models, pinned }: { models: ModelsResponse; pinned: string | null | undefined }) {
  const [sort, setSort] = useState<{ key: SortKey; bestFirst: boolean }>({ key: "composite", bestFirst: true });
  const ranked = [...models.configurations].sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  const ranks = new Map(ranked.filter((model) => model.composite != null).map((model, index) => [model.configuration_id, index + 1]));
  const value = (model: ModelSummary, key: SortKey) => (key === "composite" ? model.composite : model.metrics[key]) ?? null;
  const sorted = [...models.configurations].sort((a, b) => {
    const [x, y] = [value(a, sort.key), value(b, sort.key)];
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    const ascending = BETTER_HIGH[sort.key] ? !sort.bestFirst : sort.bestFirst;
    return ascending ? x - y : y - x;
  });
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
          {weights}. Sort by any column.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <caption className="sr-only">Leaderboard, sorted by {sort.key === "composite" ? "score" : METRIC_LABELS[sort.key].label}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Pair</TableHead>
              <SortHeader column="composite" label="Score" sort={sort} onSort={setSort} />
              {columns.map((key) => (
                <SortHeader key={key} column={key} label={METRIC_LABELS[key].label} sort={sort} onSort={setSort} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((model) => {
              const status = statusText(model);
              return (
                <TableRow key={model.configuration_id} className={cn(status && "text-muted-foreground")}>
                  <TableCell className="tabular-nums">{ranks.get(model.configuration_id) ?? "—"}</TableCell>
                  <TableCell className="min-w-60 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {model.label}
                      {model.configuration_id === pinned ? (
                        <Badge variant="outline">
                          <PinIcon aria-hidden /> Your choice
                        </Badge>
                      ) : null}
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
        description="The Comparative Model Arena's encoder + learner pairs: keep automatic selection or choose one for this project, see how they rank, and compare them on your own stories."
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
          <ModelCards project={project} models={models.data} />
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
