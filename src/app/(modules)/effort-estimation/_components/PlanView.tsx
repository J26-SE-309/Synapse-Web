"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConicalIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useFieldArray, useForm, type FieldErrors } from "react-hook-form";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { SourceBadge } from "@/shared/projects/ProjectSwitcher";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/shared/ui/native-select";
import { Spinner } from "@/shared/ui/spinner";

import example from "../../../../../contracts/effort-estimation/examples/estimate-request.json";
import { useModels, usePin, useSprintRisk } from "../_lib/api";
import {
  emptyPlan,
  emptyStory,
  MAX_STORIES,
  nextStoryId,
  parseBacklog,
  planSchema,
  PROJECT_MODEL,
  toRequest,
  type ImportedBacklog,
  type PlanValues,
} from "../_lib/backlog";
import type { ModelsResponse, SprintRiskResponse } from "../_lib/types";
import { ImportBacklogDialog } from "./ImportBacklogDialog";
import { SelectionBadge } from "./indicators";
import { SprintRiskCard } from "./SprintRiskCard";
import { StoryEditor } from "./StoryEditor";
import { StoryResults } from "./StoryResults";

const TOP_FIELDS = { sprint_id: "Sprint id", length_days: "Sprint length", capacity_points: "Planned capacity" } as const;
const STORY_FIELDS: Record<string, string> = {
  story_id: "Story id",
  title: "Title",
  story_points: "Team's estimate",
  blocker_count: "Blocked by",
  dep_in_degree: "Needed by",
  dep_out_degree: "Depends on",
  days_into_sprint: "Days into the sprint",
};

interface Problem {
  key: string;
  text: string;
  story?: number;
  field: string;
}

/** Every problem in the form, in reading order, for the summary at the top (GOV.UK's error summary pattern). */
function listProblems(errors: FieldErrors<PlanValues>): Problem[] {
  const problems: Problem[] = [];
  for (const [field, name] of Object.entries(TOP_FIELDS)) {
    const message = errors[field as keyof typeof TOP_FIELDS]?.message;
    if (message) problems.push({ key: field, text: `${name}: ${message}`, field });
  }
  const stories = errors.stories;
  if (stories?.message) problems.push({ key: "stories", text: stories.message, field: "stories" });
  if (stories?.root?.message) problems.push({ key: "stories-root", text: stories.root.message, field: "stories" });
  if (Array.isArray(stories)) {
    stories.forEach((storyErrors, index) => {
      if (!storyErrors) return;
      for (const [field, name] of Object.entries(STORY_FIELDS)) {
        const message = (storyErrors as Record<string, { message?: string } | undefined>)[field]?.message;
        if (message) problems.push({ key: `${index}-${field}`, text: `Story ${index + 1}, ${name}: ${message}`, story: index, field });
      }
    });
  }
  return problems;
}

function modelLabel(models: ModelsResponse | undefined, id: string | null | undefined): string {
  if (!id) return "Automatic";
  return models?.configurations.find((entry) => entry.configuration_id === id)?.label ?? id;
}

function Planner({ project }: { project: Project }) {
  const models = useModels();
  const pin = usePin(project.id);
  const risk = useSprintRisk(project.id);
  const form = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: emptyPlan(project.id),
    mode: "onTouched",
    shouldFocusError: false,
  });
  const stories = useFieldArray({ control: form.control, name: "stories" });
  // Stories are open for editing unless closed; a pasted backlog starts with every story closed.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openByDefault, setOpenByDefault] = useState(true);
  const isOpen = (id: string) => open[id] ?? openByDefault;
  const added = useRef(false);
  const [synthetic, setSynthetic] = useState(false);
  const [result, setResult] = useState<{ response: SprintRiskResponse; titles: Record<string, string>; synthetic: boolean } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const { errors, isSubmitting, submitCount } = form.formState;
  const problems = useMemo(() => (submitCount > 0 ? listProblems(errors) : []), [errors, submitCount]);

  const available = (models.data?.configurations ?? []).filter((entry) => entry.status === "available");
  const unavailable = (models.data?.configurations ?? []).filter((entry) => entry.status !== "available");
  const projectSetting = pin.data?.configuration_id
    ? `Project setting: ${modelLabel(models.data, pin.data.configuration_id)}`
    : "Project setting: Automatic (recommended)";

  function expand(indexes: number[]) {
    setOpen((current) => {
      const next = { ...current };
      for (const index of indexes) {
        const field = stories.fields[index];
        if (field) next[field.id] = true;
      }
      return next;
    });
  }

  // New results take the focus, so keyboard and screen-reader users land on them.
  useEffect(() => {
    if (result) resultsRef.current?.focus();
  }, [result]);

  // A story just added opens, with the cursor in its title.
  useEffect(() => {
    if (!added.current) return;
    added.current = false;
    const last = stories.fields.length - 1;
    setOpen((current) => ({ ...current, [stories.fields[last].id]: true }));
    window.requestAnimationFrame(() => form.setFocus(`stories.${last}.title`));
  }, [stories.fields, form]);

  function goTo(problem: Problem) {
    if (problem.story !== undefined) expand([problem.story]);
    const id = problem.story !== undefined ? `story-${problem.story}-${problem.field}` : problem.field;
    // The story opens first, then its field takes the focus.
    window.setTimeout(() => document.getElementById(id)?.focus(), 0);
  }

  function load(backlog: ImportedBacklog) {
    form.reset({ ...form.getValues(), ...backlog.values });
    setSynthetic(backlog.synthetic);
    setOpen({});
    setOpenByDefault(false);
    setResult(null);
  }

  function loadExample() {
    const parsed = parseBacklog(JSON.stringify(example));
    if ("backlog" in parsed) {
      const own = parsed.backlog.values.sprint_id.startsWith(`${project.id}-`);
      load({ synthetic: true, values: { ...parsed.backlog.values, sprint_id: own ? parsed.backlog.values.sprint_id : "" } });
    }
  }

  async function estimate(values: PlanValues) {
    form.clearErrors("root");
    try {
      const response = await risk.mutateAsync(toRequest(values, project.id));
      const titles = Object.fromEntries(values.stories.map((story) => [story.story_id.trim(), story.title.trim()]));
      setResult({ response, titles, synthetic });
    } catch (error) {
      if (error instanceof GatewayError && error.status === 422 && error.problems.length > 0) {
        // The service found something the browser's checks didn't: show it on the field it names.
        for (const problem of error.problems) {
          const [, where, index, field] = problem.loc;
          if (where === "stories" && typeof index === "number" && typeof field === "string") {
            form.setError(`stories.${index}.${field}` as never, { message: problem.msg });
            expand([index]);
          }
        }
      }
      form.setError("root", { message: describeError(error) });
    }
  }

  function invalid(found: FieldErrors<PlanValues>) {
    const withErrors = Array.isArray(found.stories)
      ? found.stories.flatMap((entry, index) => (entry ? [index] : []))
      : [];
    expand(withErrors);
  }

  // After a submit with problems, the summary takes the focus so they are read out first.
  const failed = problems.length > 0 || !!errors.root?.message;
  useEffect(() => {
    if (failed) summaryRef.current?.focus();
  }, [failed, submitCount]);

  const count = stories.fields.length;
  const anyOpen = stories.fields.some((field) => isOpen(field.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sprint planning"
        description="Estimate effort and sprint risk for a backlog before the team commits to it. The estimates are a second opinion: accept, adjust or reject each one."
        actions={
          <>
            <Button variant="ghost" onClick={loadExample}>
              <FlaskConicalIcon aria-hidden /> Example backlog
            </Button>
            <ImportBacklogDialog onImport={load} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <span>
            {project.name} <span className="font-mono text-xs">({project.id})</span>
          </span>
          <SourceBadge project={project} />
        </div>
      </PageHeader>

      {synthetic ? (
        <Alert>
          <FlaskConicalIcon aria-hidden />
          <AlertTitle>Synthetic example backlog</AlertTitle>
          <AlertDescription>
            These stories were generated for development and demonstrations. Use the results to try the page, not as
            evidence about a team.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormProvider {...form}>
        <form noValidate onSubmit={form.handleSubmit(estimate, invalid)} className="space-y-6">
          {problems.length > 0 || errors.root?.message ? (
            <div ref={summaryRef} tabIndex={-1} className="outline-none">
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle>
                  {problems.length > 0
                    ? `There ${problems.length === 1 ? "is 1 problem" : `are ${problems.length} problems`} with the backlog`
                    : "The backlog was not estimated"}
                </AlertTitle>
                <AlertDescription>
                  {errors.root?.message ? <p>{errors.root.message}</p> : null}
                  {problems.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-4">
                      {problems.map((problem) => (
                        <li key={problem.key}>
                          <button type="button" className="text-left underline underline-offset-2" onClick={() => goTo(problem)}>
                            {problem.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Sprint</h2>
              </CardTitle>
              <CardDescription>All optional. Leave a box empty to use what the team&apos;s history says.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field data-invalid={!!errors.sprint_id}>
                <FieldLabel htmlFor="sprint_id">Sprint id</FieldLabel>
                <Input
                  id="sprint_id"
                  className="font-mono"
                  placeholder={`${project.id}-S1`}
                  aria-invalid={!!errors.sprint_id}
                  aria-describedby="sprint_id-help sprint_id-error"
                  {...form.register("sprint_id")}
                />
                <FieldDescription id="sprint_id-help">With it, outcomes are recorded when the sprint closes.</FieldDescription>
                <FieldError id="sprint_id-error" errors={[errors.sprint_id]} />
              </Field>
              <Field data-invalid={!!errors.length_days}>
                <FieldLabel htmlFor="length_days">Sprint length (days)</FieldLabel>
                <Input
                  id="length_days"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="14"
                  aria-invalid={!!errors.length_days}
                  aria-describedby="length_days-error"
                  {...form.register("length_days")}
                />
                <FieldError id="length_days-error" errors={[errors.length_days]} />
              </Field>
              <Field data-invalid={!!errors.capacity_points}>
                <FieldLabel htmlFor="capacity_points">Planned capacity (points)</FieldLabel>
                <Input
                  id="capacity_points"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-invalid={!!errors.capacity_points}
                  aria-describedby="capacity_points-help capacity_points-error"
                  {...form.register("capacity_points")}
                />
                <FieldDescription id="capacity_points-help">Empty: the team&apos;s recent velocity.</FieldDescription>
                <FieldError id="capacity_points-error" errors={[errors.capacity_points]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="model">Model</FieldLabel>
                <NativeSelect id="model" className="w-full" aria-describedby="model-help" {...form.register("model")}>
                  <NativeSelectOption value={PROJECT_MODEL}>{projectSetting}</NativeSelectOption>
                  {available.length > 0 ? (
                    <NativeSelectOptGroup label="Just for this estimate">
                      {available.map((entry) => (
                        <NativeSelectOption key={entry.configuration_id} value={entry.configuration_id}>
                          {entry.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : null}
                  {unavailable.length > 0 ? (
                    <NativeSelectOptGroup label="Not available">
                      {unavailable.map((entry) => (
                        <NativeSelectOption key={entry.configuration_id} value={entry.configuration_id} disabled>
                          {entry.label} ({entry.status})
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ) : null}
                </NativeSelect>
                <FieldDescription id="model-help">
                  Compare them on the <Link href="/effort-estimation/models">Models</Link> page.
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <section aria-labelledby="backlog-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="backlog-heading" className="text-lg font-semibold">
                Backlog <span className="text-sm font-normal text-muted-foreground">({count} of at most {MAX_STORIES} stories)</span>
              </h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen({});
                    setOpenByDefault(!anyOpen);
                  }}
                >
                  {anyOpen ? "Collapse all" : "Expand all"}
                </Button>
              </div>
            </div>
            <ol className="space-y-2">
              {stories.fields.map((field, index) => (
                <StoryEditor
                  key={field.id}
                  index={index}
                  expanded={isOpen(field.id)}
                  canRemove={count > 1}
                  onToggle={() => setOpen((current) => ({ ...current, [field.id]: !isOpen(field.id) }))}
                  onRemove={() => stories.remove(index)}
                />
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              disabled={count >= MAX_STORIES}
              onClick={() => {
                const story = { ...emptyStory(project.id, count), story_id: nextStoryId(project.id, form.getValues("stories")) };
                added.current = true;
                stories.append(story, { shouldFocus: false });
              }}
            >
              <PlusIcon aria-hidden /> Add story
            </Button>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isSubmitting ? "Estimating…" : `${count} ${count === 1 ? "story" : "stories"} ready`}
            </p>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner aria-hidden /> : null}
              Estimate the sprint
            </Button>
          </div>
        </form>
      </FormProvider>

      {result ? (
        <section aria-labelledby="results-heading" className="space-y-4">
          <div className="space-y-1">
            <h2 id="results-heading" ref={resultsRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              Results
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                Answered by <strong className="text-foreground">{modelLabel(models.data, result.response.configuration_id)}</strong>
              </span>
              <SelectionBadge mode={result.response.selection_mode ?? "auto"} />
              {result.response.selection_reason ? <span>({result.response.selection_reason})</span> : null}
            </p>
          </div>
          {result.synthetic ? (
            <Alert>
              <FlaskConicalIcon aria-hidden />
              <AlertTitle>Results for a synthetic backlog</AlertTitle>
              <AlertDescription>Not evidence about a real team; the decisions you record here are still stored.</AlertDescription>
            </Alert>
          ) : null}
          {result.response.predictions.some((prediction) => (prediction.degraded_feature_groups ?? []).length > 0) ? (
            <Alert>
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>Some signals were estimated</AlertTitle>
              <AlertDescription>
                Requirement-quality, acceptance-criteria or traceability signals were not supplied for some stories, so the
                service estimated them from the text. Open a story&apos;s details to see which.
              </AlertDescription>
            </Alert>
          ) : null}
          <SprintRiskCard sprint={result.response.sprint} />
          <StoryResults projectId={project.id} predictions={result.response.predictions} titles={result.titles} />
        </section>
      ) : null}
    </div>
  );
}

export function PlanView() {
  return <ProjectGate>{(project) => <Planner key={project.id} project={project} />}</ProjectGate>;
}
