"use client";

import { ArrowRightIcon, HourglassIcon, PinIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { SourceBadge } from "@/shared/projects/ProjectSwitcher";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

import { EFFORT_PAGES } from "../_nav";
import { useHistory, useModels, usePin } from "../_lib/api";
import { points, when } from "../_lib/format";
import { SummaryCards } from "./SummaryCards";

function ModelCard({ project }: { project: Project }) {
  const pin = usePin(project.id);
  const models = useModels();
  const pinned = pin.data?.configuration_id;
  const label = (id: string | null | undefined) =>
    models.data?.configurations.find((model) => model.configuration_id === id)?.label ?? id ?? "—";

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3>Model</h3>
        </CardTitle>
        <CardDescription>{pinned ? `Chosen ${when(pin.data?.pinned_at)}` : "Chosen automatically for each estimate"}</CardDescription>
      </CardHeader>
      <CardContent>
        {pin.isPending ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          <p className="flex items-center gap-2 text-lg font-semibold">
            {pinned ? <PinIcon aria-hidden className="size-4 text-primary" /> : <SparklesIcon aria-hidden className="size-4 text-primary" />}
            {pinned ? label(pinned) : "Automatic"}
          </p>
        )}
        {!pinned && models.data ? (
          <p className="mt-1 text-sm text-muted-foreground">Best overall now: {label(models.data.pooled_winner)}</p>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button asChild variant="link" className="h-auto px-0">
          <Link href="/effort-estimation/models">
            Choose or compare models <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function HistoryCard({ project }: { project: Project }) {
  const history = useHistory(project.id);
  const data = history.data;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3>Team history</h3>
        </CardTitle>
        <CardDescription>
          {data ? `${data.closed_sprints} closed sprints` : history.isError ? "Not available" : "Loading…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-6 w-40" />
        ) : data.cold_start ? (
          <p className="flex items-center gap-2 text-sm">
            <HourglassIcon aria-hidden className="size-4 text-warning" />
            Cold start: {data.sprints_needed} more closed {data.sprints_needed === 1 ? "sprint" : "sprints"} needed
          </p>
        ) : (
          <p className="text-lg font-semibold tabular-nums">
            {points(data.team_context.velocity_mean)} <span className="text-sm font-normal text-muted-foreground">points per sprint</span>
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="link" className="h-auto px-0">
          <Link href="/effort-estimation/history">
            Sprints and import <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function Overview({ project }: { project: Project }) {
  const health = usePlatformHealth();
  const status = health.isPending ? "unknown" : health.data?.components["effort-estimation"]?.status ?? "down";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Effort & Sprint Risk"
        description="Story effort and sprint risk with calibrated confidence, the reasons behind them and what to do about them."
        actions={
          <Button asChild>
            <Link href="/sprints">
              Estimate a sprint <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <StatusBadge status={status} />
          <span>
            {project.name} <span className="font-mono text-xs">({project.id})</span>
          </span>
          <SourceBadge project={project} />
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard project={project} />
        <HistoryCard project={project} />
      </div>

      <section aria-labelledby="summary-heading" className="space-y-3">
        <h2 id="summary-heading" className="text-lg font-semibold">
          Predictions so far
        </h2>
        <SummaryCards project={project} />
      </section>

      <nav aria-label="Effort & Sprint Risk pages" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EFFORT_PAGES.filter((page) => page.href !== "/effort-estimation").map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Icon aria-hidden className="size-5 text-primary" />
              {page.title}
              <ArrowRightIcon aria-hidden className="ml-auto size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function OverviewView() {
  return <ProjectGate>{(project) => <Overview key={project.id} project={project} />}</ProjectGate>;
}
