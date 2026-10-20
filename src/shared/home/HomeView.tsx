"use client";

import {
  ArrowRightIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  FlagIcon,
  GaugeIcon,
  HourglassIcon,
  LayersIcon,
  ListTodoIcon,
  SparklesIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useSprints, useStories } from "@/shared/backlog/api";
import { formatDate, formatPoints } from "@/shared/backlog/badges";
import { daysLeft } from "@/shared/backlog/planning";
import { sprintStats } from "@/shared/backlog/sprint-stats";
import { storiesIn, totalPoints, type Sprint, type Story } from "@/shared/backlog/types";
import { EmptyState } from "@/shared/components/EmptyState";
import { PlatformStatus } from "@/shared/components/PlatformStatus";
import { usePlatformHealth } from "@/shared/hooks/usePlatformHealth";
import { ProjectIllustration, WelcomeIllustration } from "@/shared/illustrations";
import { cn } from "@/shared/lib/utils";
import { MODULES } from "@/shared/modules";
import { NAV_MODULES } from "@/shared/navigation";
import type { Project } from "@/shared/projects/api";
import { useProject } from "@/shared/projects/ProjectProvider";
import { ProjectSwitcher } from "@/shared/projects/ProjectSwitcher";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { Skeleton } from "@/shared/ui/skeleton";

function Hero() {
  return (
    <section
      aria-labelledby="home-title"
      className="relative overflow-hidden rounded-3xl border bg-card shadow-(--shadow-soft)"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(36rem 18rem at 85% 30%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%), radial-gradient(28rem 16rem at 10% 110%, color-mix(in oklch, var(--chart-2) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:p-10">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
            <SparklesIcon aria-hidden className="size-3.5" /> Agile requirements platform
          </p>
          <div className="space-y-3">
            <h1 id="home-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              From raw requirements to a sprint plan you can explain
            </h1>
            <p className="max-w-xl text-[0.9375rem]/relaxed text-muted-foreground">
              Synapse checks requirements for ambiguity, turns them into stories with acceptance criteria, links them to
              code and tests, and estimates effort and sprint risk, always with the reasons behind each number.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/backlog">
                <ListTodoIcon aria-hidden /> Open the backlog
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/effort-estimation/predict">
                <SparklesIcon aria-hidden /> Predict a story
              </Link>
            </Button>
          </div>
        </div>
        <WelcomeIllustration className="mx-auto hidden max-w-sm sm:block" />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "primary",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "primary" | "sky" | "violet" | "pink";
  children?: ReactNode;
}) {
  const tile = {
    primary: "bg-primary/12 text-primary",
    sky: "bg-chart-2/15 text-chart-2",
    violet: "bg-chart-3/15 text-chart-3",
    pink: "bg-chart-5/15 text-chart-5",
  }[tone];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-(--shadow-soft)">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tile)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      {children}
    </div>
  );
}

function ActiveSprintStat({ sprint, stories }: { sprint: Sprint; stories: Story[] }) {
  const stats = sprintStats(sprint, stories);
  const left = daysLeft(sprint);
  const share = stats.committed ? Math.round((stats.done / stats.committed) * 100) : 0;
  return (
    <Stat
      icon={HourglassIcon}
      label={sprint.name}
      value={left === 0 ? "Last day" : `${left} ${left === 1 ? "day" : "days"} left`}
      detail={`${formatDate(sprint.started_at)} – ${formatDate(sprint.planned_end)}`}
    >
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Points done</span>
          <span className="tabular-nums">
            {formatPoints(stats.done)} of {formatPoints(stats.committed)}
          </span>
        </div>
        <Progress value={share} aria-label={`${sprint.name}: points done`} />
      </div>
      <Link href={`/sprints/${encodeURIComponent(sprint.sprint_id)}`} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        Open the board <ArrowRightIcon aria-hidden className="size-3.5" />
      </Link>
    </Stat>
  );
}

function ProjectSnapshot({ project }: { project: Project }) {
  const stories = useStories(project.id);
  const sprints = useSprints(project.id);

  if (stories.isPending || sprints.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading the project">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (stories.isError || sprints.isError) return null;

  const all = stories.data;
  const list = sprints.data;
  const active = list.find((sprint) => sprint.status === "active");
  const closed = list.filter((sprint) => sprint.status === "closed");
  const backlog = all.filter((story) => story.sprint_id === null);
  const recent = closed.slice(0, 4).map((sprint) => sprintStats(sprint, storiesIn(sprint, all)));
  const velocity = recent.length ? recent.reduce((sum, stats) => sum + stats.done, 0) / recent.length : null;
  const committed = recent.reduce((sum, stats) => sum + stats.committed, 0);
  const delivered = committed ? Math.round((recent.reduce((sum, stats) => sum + stats.done, 0) / committed) * 100) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {active ? (
        <ActiveSprintStat sprint={active} stories={storiesIn(active, all)} />
      ) : (
        <Stat icon={FlagIcon} label="Sprint" value="None running" detail="Start a planned sprint from its page.">
          <Link href="/sprints" className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            See the sprints <ArrowRightIcon aria-hidden className="size-3.5" />
          </Link>
        </Stat>
      )}
      <Stat
        icon={LayersIcon}
        tone="sky"
        label="Backlog"
        value={`${backlog.length} ${backlog.length === 1 ? "story" : "stories"}`}
        detail={`${formatPoints(totalPoints(backlog))} points waiting to be planned`}
      >
        <Link href="/backlog" className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Plan the next sprint <ArrowRightIcon aria-hidden className="size-3.5" />
        </Link>
      </Stat>
      <Stat
        icon={TrendingUpIcon}
        tone="violet"
        label="Velocity"
        value={velocity === null ? "–" : `${formatPoints(Math.round(velocity * 10) / 10)} points`}
        detail={velocity === null ? "Close a sprint to see it." : `Completed per sprint, last ${recent.length} ${recent.length === 1 ? "sprint" : "sprints"}`}
      />
      <Stat
        icon={CheckCircle2Icon}
        tone="pink"
        label="Delivered"
        value={delivered === null ? "–" : `${delivered}%`}
        detail={
          delivered === null
            ? "Of the points committed, once sprints close."
            : `Of the points committed in ${closed.length} closed ${closed.length === 1 ? "sprint" : "sprints"}`
        }
      />
    </div>
  );
}

/** The four components in pipeline order, joined by a line: what each step adds. */
function Pipeline() {
  const health = usePlatformHealth();
  return (
    <section aria-labelledby="home-pipeline" className="space-y-4">
      <div className="space-y-1">
        <h2 id="home-pipeline" className="text-xl font-semibold tracking-tight">
          How a requirement becomes a plan
        </h2>
        <p className="text-sm text-muted-foreground">Four components, one after the other. Each is developed in its own repository.</p>
      </div>
      <ol className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <span aria-hidden className="absolute top-9 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-chart-2/50 via-primary/50 to-chart-5/50 xl:block" />
        {MODULES.map((entry, index) => {
          const Icon = NAV_MODULES[index].icon;
          const status = health.isPending ? "checking" : health.data?.components[entry.slug]?.status === "up" ? "running" : "not reachable";
          return (
            <li key={entry.slug} className="relative">
              <Link
                href={`/${entry.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-(--shadow-soft) transition-[box-shadow,translate,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-(--shadow-lift)"
              >
                <div className="flex items-center justify-between">
                  <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-sm shadow-primary/30">
                    <Icon aria-hidden className="size-[1.125rem]" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold tracking-tight">{entry.shortName}</h3>
                  <p className="text-sm/relaxed text-muted-foreground">{entry.description}</p>
                </div>
                <p className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        status === "running" ? "bg-success" : status === "checking" ? "bg-muted-foreground" : "bg-danger",
                      )}
                    />
                    <span className="capitalize">{status}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Open <ArrowRightIcon aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function HomeView() {
  const { project, projects } = useProject();

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <Hero />

      <section aria-labelledby="home-project" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="home-project" className="text-xl font-semibold tracking-tight">
              {project ? project.name : "Your project"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {project ? project.description || "Where the current sprint and the backlog stand." : "Everything in Synapse works on one project at a time."}
            </p>
          </div>
          {project ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/sprints">
                  <CalendarPlusIcon aria-hidden /> Sprints
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/effort-estimation">
                  <GaugeIcon aria-hidden /> Effort and risk
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        {project ? (
          <ProjectSnapshot key={project.id} project={project} />
        ) : projects.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (
          <EmptyState
            illustration={ProjectIllustration}
            title="Choose a project to get started"
            description="Pick one of your team's projects, or create a new one. The backlog, sprints and every component then work on it."
            actions={<ProjectSwitcher />}
            headingLevel="h3"
          />
        )}
      </section>

      <Pipeline />

      <section aria-labelledby="home-services" className="space-y-4">
        <div className="space-y-1">
          <h2 id="home-services" className="text-xl font-semibold tracking-tight">
            Services
          </h2>
          <p className="text-sm text-muted-foreground">The API gateway and the four components behind it.</p>
        </div>
        <PlatformStatus />
      </section>
    </div>
  );
}
