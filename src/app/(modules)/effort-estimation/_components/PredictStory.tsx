"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleCheckIcon,
  GaugeIcon,
  LightbulbIcon,
  ListTodoIcon,
  PencilLineIcon,
  RulerIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { z } from "zod";

import { describeError, gatewayFetch } from "@/shared/api/gateway";
import { useSprints, useStories } from "@/shared/backlog/api";
import { IssueTypeIcon, PointsPill } from "@/shared/backlog/icons";
import { storyFormSchema, toStory } from "@/shared/backlog/schema";
import { ISSUE_TYPES, PRIORITIES, type Sprint, type Story, type UpstreamSignals } from "@/shared/backlog/types";
import { PageHeader } from "@/shared/components/PageHeader";
import { InsightsIllustration } from "@/shared/illustrations";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";

import { useEstimate, useModels, usePrediction } from "../_lib/api";
import { toStoryPrediction, usualSprint } from "../_lib/estimate";
import type { ModelsResponse, Prediction, PredictionDetail } from "../_lib/types";
import { PredictionDetailBody } from "./PredictionDetailView";

const newStory = storyFormSchema.omit({ story_id: true, title: true }).extend({ title: z.string() });

export const predictSchema = newStory
  .extend({
    kind: z.enum(["backlog", "new"]),
    storyId: z.string(),
    sprintId: z.string(),
    model: z.string(),
  })
  .superRefine((values, context) => {
    if (values.kind === "backlog" && !values.storyId) {
      context.addIssue({ code: "custom", path: ["storyId"], message: "Choose a story from the backlog." });
    }
    if (values.kind === "new" && !values.title.trim()) {
      context.addIssue({ code: "custom", path: ["title"], message: "Enter the story's title." });
    }
    if (values.kind === "new" && values.title.trim().length > 300) {
      context.addIssue({ code: "custom", path: ["title"], message: "Use at most 300 characters." });
    }
  });

type PredictValues = z.infer<typeof predictSchema>;
type FieldName = keyof PredictValues;
const ORDER: FieldName[] = ["storyId", "title", "description", "acceptance_criteria", "story_points", "epic", "blocked_by", "depends_on", "needed_by"];

const EMPTY: PredictValues = {
  kind: "backlog",
  storyId: "",
  sprintId: "",
  model: "",
  title: "",
  description: "",
  acceptance_criteria: "",
  issue_type: "Story",
  priority: "",
  story_points: "",
  epic: "",
  blocked_by: "",
  depends_on: "",
  needed_by: "",
};

/** The open sprints a story can be predicted in: the running one first, then the planned ones. */
function openSprints(sprints: Sprint[]): Sprint[] {
  return sprints.filter((sprint) => sprint.status !== "closed").sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : 0));
}

/** A story typed into the form, as the platform's story (never saved: its id marks it as tried out here). */
function typedStory(projectId: string, values: PredictValues): Story {
  const body = toStory({ ...values, story_id: "" });
  const now = new Date().toISOString();
  return {
    ...body,
    project_id: projectId,
    story_id: `NEW-${Date.now().toString(36).toUpperCase()}`,
    description: body.description ?? "",
    acceptance_criteria: body.acceptance_criteria ?? [],
    issue_type: body.issue_type ?? null,
    priority: body.priority ?? null,
    story_points: body.story_points ?? null,
    epic: body.epic ?? null,
    blocked_by: body.blocked_by ?? 0,
    depends_on: body.depends_on ?? 0,
    needed_by: body.needed_by ?? 0,
    status: "to_do",
    rank: 0,
    sprint_id: null,
    source: "manual",
    synthetic: false,
    upstream: null,
    started_at: null,
    resolved_at: null,
    reopened: false,
    created_at: now,
    updated_at: now,
  };
}

interface Made {
  prediction: Prediction;
  projectId: string;
  sprintId: string | null;
  title: string;
}

/** The prediction just made, filled in from the log once the service has recorded it. */
function PredictionResult({ made, label }: { made: Made; label: string }) {
  const id = made.prediction.prediction_id ?? "";
  const detail = usePrediction(id, { waitForRecord: true });
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [id]);
  const data: PredictionDetail = detail.data ?? {
    prediction_id: id,
    project_id: made.projectId,
    sprint_id: made.sprintId,
    created_at: made.prediction.generated_at,
    prediction: made.prediction,
    features: {},
    feedback: [],
    outcomes: [],
  };
  return (
    <section aria-labelledby="predict-result" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="predict-result" ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
            The prediction for <span className="font-mono">{made.prediction.story_id}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{made.title}</p>
        </div>
        {detail.data ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/effort-estimation/predictions/${encodeURIComponent(id)}`}>
              <ScrollTextIcon aria-hidden /> Open in the prediction log
            </Link>
          </Button>
        ) : null}
      </div>
      {detail.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The prediction was made, but the log could not be read</AlertTitle>
          <AlertDescription>
            {describeError(detail.error)} The answer below is complete; what the models saw appears once the log is reachable.
          </AlertDescription>
        </Alert>
      ) : null}
      <PredictionDetailBody data={data} label={label} recorded={!!detail.data} />
    </section>
  );
}

/** Beside the form: what a prediction holds, so the page explains itself before the first one. */
function WhatYouGet() {
  const items: [LucideIcon, string, string][] = [
    [RulerIcon, "Effort", "Story points with the range they likely fall in"],
    [GaugeIcon, "Sprint risk", "The chance the story spills over, and why"],
    [ShieldCheckIcon, "Confidence", "How sure the models are, and what lowered it"],
    [LightbulbIcon, "What to do", "Changes that lower the risk, with their expected effect"],
  ];
  return (
    <aside aria-labelledby="predict-what" className="space-y-4 rounded-2xl border bg-card p-5 shadow-(--shadow-soft)">
      <InsightsIllustration className="mx-auto w-44" />
      <h2 id="predict-what" className="font-semibold tracking-tight">
        What you get
      </h2>
      <ul className="space-y-3">
        {items.map(([Icon, title, text]) => (
          <li key={title} className="flex gap-3 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Icon aria-hidden className="size-4" />
            </span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function PredictForm({ project, models }: { project: Project; models: ModelsResponse }) {
  const stories = useStories(project.id);
  const sprints = useSprints(project.id);
  const estimate = useEstimate(project.id);
  const [made, setMade] = useState<Made | null>(null);
  const available = models.configurations.filter((model) => model.status === "available");
  const labels = Object.fromEntries(models.configurations.map((model) => [model.configuration_id, model.label]));
  const form = useForm<PredictValues>({ resolver: zodResolver(predictSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { errors, isSubmitting } = form.formState;
  const [kind, storyId] = useWatch({ control: form.control, name: ["kind", "storyId"] });

  const open = openSprints(sprints.data ?? []);
  const candidates = (stories.data ?? []).filter((story) => story.status !== "done");

  // Start with a story of the running sprint, in that sprint.
  useEffect(() => {
    if (!stories.data || !sprints.data || form.getValues("storyId")) return;
    const active = sprints.data.find((sprint) => sprint.status === "active");
    const first = candidates.find((story) => active && story.sprint_id === active.sprint_id) ?? candidates[0];
    if (first) form.setValue("storyId", first.story_id);
    if (active) form.setValue("sprintId", active.sprint_id);
  }, [stories.data, sprints.data]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseStory(id: string) {
    form.setValue("storyId", id, { shouldValidate: true });
    const story = candidates.find((entry) => entry.story_id === id);
    if (story?.sprint_id && open.some((sprint) => sprint.sprint_id === story.sprint_id)) form.setValue("sprintId", story.sprint_id);
  }

  async function predict(values: PredictValues) {
    const all = stories.data ?? [];
    const story = values.kind === "backlog" ? all.find((entry) => entry.story_id === values.storyId) : typedStory(project.id, values);
    if (!story) {
      form.setError("storyId", { message: "That story is no longer in the backlog." });
      return;
    }
    const sprint = open.find((entry) => entry.sprint_id === values.sprintId) ?? null;
    try {
      if (values.kind === "new") {
        // What Components 1-3 would report about it, as for a saved story (nothing is saved).
        story.upstream = await gatewayFetch<UpstreamSignals>(
          `api/v1/projects/${encodeURIComponent(project.id)}/stories/signals`,
          { method: "POST", body: JSON.stringify(toStory({ ...values, story_id: "" })) },
        );
      }
      const request = toStoryPrediction({
        projectId: project.id,
        story,
        sprint,
        sprintStories: sprint ? all.filter((entry) => entry.sprint_id === sprint.sprint_id) : [],
        pinnedConfiguration: values.model || null,
        nextSprint: usualSprint(sprints.data ?? []),
      });
      const response = await estimate.mutateAsync(request);
      const prediction = response.predictions[0];
      setMade({ prediction, projectId: project.id, sprintId: request.sprint_id ?? null, title: story.title });
    } catch (error) {
      form.setError("root", { message: describeError(error) });
    }
  }

  function invalid(found: FieldErrors<PredictValues>) {
    const first = ORDER.find((name) => found[name]);
    if (first) form.setFocus(first);
  }

  const wire = (name: FieldName) => ({
    id: `predict-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `predict-${name}-error` : undefined,
  });
  const fieldError = (name: FieldName) => <FieldError id={`predict-${name}-error`} errors={[errors[name]]} />;
  const whole = { type: "number", inputMode: "numeric" as const, min: 0, step: 1, placeholder: "0" };
  const chosen = candidates.find((story) => story.story_id === storyId);

  if (stories.isPending || sprints.isPending) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>The story</h2>
            </CardTitle>
            <CardDescription>
              The prediction is made as for a sprint estimate and kept in the prediction log. With a sprint, its other stories
              count as the sprint&apos;s committed work, and the team&apos;s history is used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={form.handleSubmit(predict, invalid)} className="space-y-6">
              <FieldSet>
                <FieldLegend variant="label">Which story</FieldLegend>
                <RadioGroup
                  value={kind}
                  onValueChange={(value) => form.setValue("kind", value as PredictValues["kind"])}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {(
                    [
                      ["backlog", ListTodoIcon, "A story from the backlog", "One of the project's open stories, with everything known about it."],
                      ["new", PencilLineIcon, "A new story (not saved)", "Type a story to see how it would go before adding it."],
                    ] as const
                  ).map(([value, Icon, title, description]) => (
                    <FieldLabel key={value} htmlFor={`predict-kind-${value}`} className="rounded-xl! *:data-[slot=field]:p-4">
                      <Field orientation="horizontal" className="items-start">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                          <Icon aria-hidden className="size-[1.125rem]" />
                        </span>
                        <FieldContent>
                          <FieldTitle id={`predict-kind-${value}-title`}>{title}</FieldTitle>
                          <FieldDescription id={`predict-kind-${value}-text`}>{description}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          id={`predict-kind-${value}`}
                          value={value}
                          aria-labelledby={`predict-kind-${value}-title`}
                          aria-describedby={`predict-kind-${value}-text`}
                          className="mt-0.5"
                        />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>

              {kind === "backlog" ? (
                <Field data-invalid={!!errors.storyId}>
                  <FieldLabel htmlFor="predict-storyId">Story</FieldLabel>
                  <NativeSelect
                    {...wire("storyId")}
                    className="w-full"
                    value={storyId}
                    onChange={(event) => chooseStory(event.target.value)}
                  >
                    <NativeSelectOption value="">Choose a story</NativeSelectOption>
                    {candidates.map((story) => (
                      <NativeSelectOption key={story.story_id} value={story.story_id}>
                        {story.story_id} · {story.title.length > 90 ? `${story.title.slice(0, 89)}…` : story.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {chosen ? (
                    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
                      <IssueTypeIcon type={chosen.issue_type} size="lg" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium">{chosen.title}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">{chosen.story_id}</span>
                          <span>{chosen.issue_type ?? "No type"}</span>
                          <span>
                            {chosen.acceptance_criteria.length} acceptance {chosen.acceptance_criteria.length === 1 ? "criterion" : "criteria"}
                          </span>
                          {chosen.upstream ? (
                            <span className="inline-flex items-center gap-1">
                              <CircleCheckIcon aria-hidden className="size-3.5 text-success" />
                              Component signals{chosen.upstream.source === "platform" ? " from the backlog" : ""}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <PointsPill points={chosen.story_points} size="lg" />
                    </div>
                  ) : candidates.length === 0 ? (
                    <FieldDescription>The backlog has no open stories: try a new story instead.</FieldDescription>
                  ) : null}
                  {fieldError("storyId")}
                </Field>
              ) : (
                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field data-invalid={!!errors.title} className="sm:col-span-2 lg:col-span-4">
                    <FieldLabel htmlFor="predict-title">Title</FieldLabel>
                    <Input {...wire("title")} autoComplete="off" placeholder="As a user I want … so that …" {...form.register("title")} />
                    {fieldError("title")}
                  </Field>
                  <Field data-invalid={!!errors.description} className="sm:col-span-2">
                    <FieldLabel htmlFor="predict-description">
                      Description <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea {...wire("description")} rows={4} {...form.register("description")} />
                    {fieldError("description")}
                  </Field>
                  <Field data-invalid={!!errors.acceptance_criteria} className="sm:col-span-2">
                    <FieldLabel htmlFor="predict-acceptance_criteria">
                      Acceptance criteria <span className="font-normal text-muted-foreground">(one per line)</span>
                    </FieldLabel>
                    <Textarea {...wire("acceptance_criteria")} rows={4} placeholder="Given … when … then …" {...form.register("acceptance_criteria")} />
                    {fieldError("acceptance_criteria")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="predict-issue_type">Type</FieldLabel>
                    <NativeSelect id="predict-issue_type" className="w-full" {...form.register("issue_type")}>
                      <NativeSelectOption value="">Not set</NativeSelectOption>
                      {ISSUE_TYPES.map((type) => (
                        <NativeSelectOption key={type} value={type}>
                          {type}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="predict-priority">Priority</FieldLabel>
                    <NativeSelect id="predict-priority" className="w-full" {...form.register("priority")}>
                      <NativeSelectOption value="">Not set</NativeSelectOption>
                      {PRIORITIES.map((priority) => (
                        <NativeSelectOption key={priority} value={priority}>
                          {priority}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field data-invalid={!!errors.story_points}>
                    <FieldLabel htmlFor="predict-story_points">
                      Story points <span className="font-normal text-muted-foreground">(team&apos;s estimate)</span>
                    </FieldLabel>
                    <Input {...wire("story_points")} type="number" inputMode="decimal" min={0} step="any" {...form.register("story_points")} />
                    {fieldError("story_points")}
                  </Field>
                  <Field data-invalid={!!errors.epic}>
                    <FieldLabel htmlFor="predict-epic">
                      Epic <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Input {...wire("epic")} autoComplete="off" {...form.register("epic")} />
                    {fieldError("epic")}
                  </Field>
                  <Field data-invalid={!!errors.blocked_by}>
                    <FieldLabel htmlFor="predict-blocked_by">Blocked by (open issues)</FieldLabel>
                    <Input {...wire("blocked_by")} {...whole} {...form.register("blocked_by")} />
                    {fieldError("blocked_by")}
                  </Field>
                  <Field data-invalid={!!errors.depends_on}>
                    <FieldLabel htmlFor="predict-depends_on">Depends on (issues)</FieldLabel>
                    <Input {...wire("depends_on")} {...whole} {...form.register("depends_on")} />
                    {fieldError("depends_on")}
                  </Field>
                  <Field data-invalid={!!errors.needed_by}>
                    <FieldLabel htmlFor="predict-needed_by">Needed by (issues)</FieldLabel>
                    <Input {...wire("needed_by")} {...whole} {...form.register("needed_by")} />
                    {fieldError("needed_by")}
                  </Field>
                </FieldGroup>
              )}

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="predict-sprintId">Sprint</FieldLabel>
                  <NativeSelect id="predict-sprintId" className="w-full" {...form.register("sprintId")}>
                    <NativeSelectOption value="">The next sprint (not planned yet)</NativeSelectOption>
                    {open.map((sprint) => (
                      <NativeSelectOption key={sprint.sprint_id} value={sprint.sprint_id}>
                        {sprint.name} ({sprint.status === "active" ? "running" : "planned"})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    A story not in the sprint is predicted as if added to it now; only a story really in the sprint gets its outcome
                    recorded at the close. The next sprint is taken to be as long as the latest one.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="predict-model">Model</FieldLabel>
                  <NativeSelect id="predict-model" className="w-full" {...form.register("model")}>
                    <NativeSelectOption value="">The project&apos;s setting (automatic unless one is chosen)</NativeSelectOption>
                    {available.map((model) => (
                      <NativeSelectOption key={model.configuration_id} value={model.configuration_id}>
                        {model.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>

              {errors.root?.message ? (
                <Alert variant="destructive">
                  <AlertTitle>The prediction was not made</AlertTitle>
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t pt-5">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner aria-hidden /> : <SparklesIcon aria-hidden />}
                  {isSubmitting ? "Predicting…" : "Predict"}
                </Button>
                <p className="text-xs text-muted-foreground">Kept in the prediction log, where it can be reviewed later.</p>
              </div>
            </form>
          </CardContent>
        </Card>
        <WhatYouGet />
      </div>

      {made ? (
        <PredictionResult
          key={made.prediction.prediction_id}
          made={made}
          label={labels[made.prediction.configuration_id ?? ""] ?? made.prediction.configuration_id ?? ""}
        />
      ) : null}
    </div>
  );
}

function Predict({ project }: { project: Project }) {
  const models = useModels();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={SparklesIcon}
        eyebrow="Effort & Sprint Risk"
        title="Predict a story"
        description="One story's full prediction: effort, sprint risk, confidence, why, what to do, and what the models saw."
      />
      {models.isPending ? (
        <Skeleton className="h-96" />
      ) : models.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The models could not be loaded</AlertTitle>
          <AlertDescription>{describeError(models.error)}</AlertDescription>
        </Alert>
      ) : (
        <PredictForm project={project} models={models.data} />
      )}
    </div>
  );
}

export function PredictStoryView() {
  return <ProjectGate>{(project) => <Predict key={project.id} project={project} />}</ProjectGate>;
}
