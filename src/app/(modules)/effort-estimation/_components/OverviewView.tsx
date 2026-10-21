"use client";

import {
  ArrowRightIcon,
  CheckCheckIcon,
  GaugeIcon,
  GraduationCapIcon,
  HistoryIcon,
  HourglassIcon,
  PinIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { StatTile } from "@/shared/components/StatTile";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { InsightsIllustration } from "@/shared/illustrations";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { SourceBadge } from "@/shared/projects/ProjectSwitcher";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

import { EFFORT_PAGES } from "../_nav";
import { useHistory, useModels, usePin } from "../_lib/api";
import { points, when } from "../_lib/format";
import { SummaryCards } from "./SummaryCards";

/** What each of the module's other pages is for, on its card. */
const PAGE_TEXT: Record<string, string> = {
  "/effort-estimation/predict": "One story's full prediction, from the backlog or typed in.",
  "/effort-estimation/models": "Keep the automatic choice or pick an encoder + learner pair, and compare them.",
  "/effort-estimation/history": "The closed sprints the models learn this team's pace from.",
  "/effort-estimation/predictions": "Every estimate, what was decided about it and how it turned out.",
};

const STEPS = [
  {
    icon: SparklesIcon,
    title: "Estimate",
    text: "Estimate a sprint from its page, or one story here. Each estimate gives the effort, the spillover risk, how sure the models are, why, and what to do.",
  },
  {
    icon: CheckCheckIcon,
    title: "Review",
    text: "Accept, adjust or reject each estimate. The decision is kept with it in the prediction log.",
  },
  {
    icon: GraduationCapIcon,
    title: "Learn",
    text: "When a sprint closes, each story's outcome is recorded against its prediction, and the sprint joins the team's history for the next estimates.",
  },
];

function Hero({ project }: { project: Project }) {
  const health = usePlatformHealth();
  const status = health.isPending ? "unknown" : health.data?.components["effort-estimation"]?.status ?? "down";
  return (
    <section aria-labelledby="effort-title" className="relative overflow-hidden rounded-3xl border bg-card shadow-(--shadow-soft)">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(32rem 16rem at 85% 30%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%), radial-gradient(24rem 14rem at 5% 110%, color-mix(in oklch, var(--chart-3) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
            <GaugeIcon aria-hidden className="size-3.5" /> Component 4
          </p>
          <div className="space-y-2">
            <h1 id="effort-title" className="text-3xl font-semibold tracking-tight">
              Effort &amp; Sprint Risk
            </h1>
            <p className="max-w-2xl text-[0.9375rem]/relaxed text-muted-foreground">
              Story effort and sprint risk with calibrated confidence, the reasons behind them and what to do about them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={status} />
            <span>
              {project.name} <span className="font-mono text-xs">({project.id})</span>
            </span>
            <SourceBadge project={project} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="lg">
              <Link href="/sprints">
                Estimate a sprint <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/effort-estimation/predict">
                <SparklesIcon aria-hidden /> Predict a story
              </Link>
            </Button>
          </div>
        </div>
        <InsightsIllustration className="mx-auto hidden w-60 lg:block" />
      </div>
    </section>
  );
}

function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      {children} <ArrowRightIcon aria-hidden className="size-3.5" />
    </Link>
  );
}

function ModelTile({ project }: { project: Project }) {
  const pin = usePin(project.id);
  const models = useModels();
  const pinned = pin.data?.configuration_id;
  const label = (id: string | null | undefined) =>
    models.data?.configurations.find((model) => model.configuration_id === id)?.label ?? id ?? "—";
  return (
    <StatTile
      icon={pinned ? PinIcon : SparklesIcon}
      label="Model"
      value={pin.isPending ? <Skeleton className="h-8 w-40" /> : pinned ? label(pinned) : "Automatic"}
      detail={
        pinned
          ? `Chosen ${when(pin.data?.pinned_at)}`
          : models.data
            ? `Chosen for each estimate; best overall now: ${label(models.data.pooled_winner)}`
            : "Chosen automatically for each estimate"
      }
    >
      <TileLink href="/effort-estimation/models">Choose or compare models</TileLink>
    </StatTile>
  );
}

function HistoryTile({ project }: { project: Project }) {
  const history = useHistory(project.id);
  const data = history.data;
  return (
    <StatTile
      icon={data?.cold_start ? HourglassIcon : HistoryIcon}
      tone="violet"
      label="Team pace"
      value={
        !data ? (
          history.isError ? "Not available" : <Skeleton className="h-8 w-40" />
        ) : data.cold_start ? (
          "Cold start"
        ) : (
          `${points(data.team_context.velocity_mean)} points per sprint`
        )
      }
      detail={
        !data
          ? null
          : data.cold_start
            ? `${data.sprints_needed} more closed ${data.sprints_needed === 1 ? "sprint" : "sprints"} needed before the team's history counts fully`
            : `From ${data.closed_sprints} closed sprints`
      }
    >
      <TileLink href="/effort-estimation/history">Sprints and import</TileLink>
    </StatTile>
  );
}

function Overview({ project }: { project: Project }) {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <Hero project={project} />

      <div className="grid gap-4 md:grid-cols-2">
        <ModelTile project={project} />
        <HistoryTile project={project} />
      </div>

      <section aria-labelledby="summary-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="summary-heading" className="text-xl font-semibold tracking-tight">
            Predictions so far
          </h2>
          <p className="text-sm text-muted-foreground">How risky the estimated stories are, what was decided, and how they turned out.</p>
        </div>
        <SummaryCards project={project} />
      </section>

      <section aria-labelledby="steps-heading" className="space-y-4">
        <h2 id="steps-heading" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="relative rounded-2xl border bg-card p-5 shadow-(--shadow-soft)">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-sm shadow-primary/30">
                  <Icon aria-hidden className="size-[1.125rem]" />
                </span>
                <p className="font-semibold tracking-tight">
                  <span className="sr-only">Step {index + 1}: </span>
                  {title}
                </p>
              </div>
              <p className="mt-3 text-sm/relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <nav aria-label="Effort & Sprint Risk pages" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EFFORT_PAGES.filter((page) => page.href !== "/effort-estimation").map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-(--shadow-soft) transition-[box-shadow,translate,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-(--shadow-lift)"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon aria-hidden className="size-[1.125rem]" />
              </span>
              <span className="flex items-center gap-1 font-semibold tracking-tight">
                {page.title}
                <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm text-muted-foreground">{PAGE_TEXT[page.href]}</span>
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
