"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { describeError } from "@/shared/api/gateway";
import type { Project } from "@/shared/projects/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";

import { useCompare } from "../_lib/api";
import type { CompareResponse, ModelsResponse } from "../_lib/types";
import { ConfidenceIndicator, EffortValue, RiskBadge } from "./indicators";

export const MIN_COMPARED = 2;
export const MAX_COMPARED = 4;
export const MAX_COMPARE_STORIES = 5;

export const compareSchema = z.object({
  configurations: z
    .array(z.string())
    .min(MIN_COMPARED, `Choose at least ${MIN_COMPARED} models to compare.`)
    .max(MAX_COMPARED, `Choose at most ${MAX_COMPARED} models, so the table stays readable.`),
  stories: z
    .array(z.object({ title: z.string().trim().min(1, "Enter the story's title."), description: z.string() }))
    .min(1, "Add a story.")
    .max(MAX_COMPARE_STORIES, `Compare at most ${MAX_COMPARE_STORIES} stories at a time.`),
});

type CompareValues = z.infer<typeof compareSchema>;

/** FR12: the same stories through several pairs side by side, before choosing one. Nothing is recorded. */
export function CompareModels({ project, models }: { project: Project; models: ModelsResponse }) {
  const available = models.configurations.filter((model) => model.status === "available");
  const labels = Object.fromEntries(models.configurations.map((model) => [model.configuration_id, model.label]));
  const compare = useCompare();
  const [result, setResult] = useState<{ response: CompareResponse; titles: string[] } | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const form = useForm<CompareValues>({
    resolver: zodResolver(compareSchema),
    defaultValues: {
      configurations: available.slice(0, 2).map((model) => model.configuration_id),
      stories: [{ title: "", description: "" }],
    },
  });
  const stories = useFieldArray({ control: form.control, name: "stories" });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function run(values: CompareValues) {
    try {
      const response = await compare.mutateAsync({
        project_id: project.id,
        configurations: values.configurations,
        stories: values.stories.map((story, index) => ({
          story_id: `${project.id}-COMPARE-${index + 1}`,
          title: story.title.trim(),
          description: story.description.trim(),
        })),
      });
      setResult({ response, titles: values.stories.map((story) => story.title.trim()) });
    } catch (error) {
      form.setError("root", { message: describeError(error) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Compare side by side</h2>
        </CardTitle>
        <CardDescription>
          Run a few of your stories through {MIN_COMPARED} to {MAX_COMPARED} pairs to see how their answers differ. Comparisons
          are not recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(run)} className="space-y-6">
          <Controller
            control={form.control}
            name="configurations"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Models</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {available.map((model) => {
                    const checked = field.value.includes(model.configuration_id);
                    return (
                      <Field key={model.configuration_id} orientation="horizontal">
                        <Checkbox
                          id={`compare-${model.configuration_id}`}
                          checked={checked}
                          aria-invalid={fieldState.invalid}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next
                                ? [...field.value, model.configuration_id]
                                : field.value.filter((id) => id !== model.configuration_id),
                            )
                          }
                        />
                        <FieldLabel htmlFor={`compare-${model.configuration_id}`} className="font-normal">
                          {model.label}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </div>
                <FieldError errors={[fieldState.error]} />
              </FieldSet>
            )}
          />

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Stories</legend>
            {stories.fields.map((field, index) => {
              const error = errors.stories?.[index]?.title;
              return (
                <div key={field.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_auto]">
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={`compare-story-${index}-title`}>Title of story {index + 1}</FieldLabel>
                    <Input
                      id={`compare-story-${index}-title`}
                      aria-invalid={!!error}
                      aria-describedby={error ? `compare-story-${index}-error` : undefined}
                      {...form.register(`stories.${index}.title`)}
                    />
                    <FieldError id={`compare-story-${index}-error`} errors={[error]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`compare-story-${index}-description`}>
                      Description <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea id={`compare-story-${index}-description`} rows={1} {...form.register(`stories.${index}.description`)} />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="self-end"
                    disabled={stories.fields.length === 1}
                    onClick={() => stories.remove(index)}
                    aria-label={`Remove story ${index + 1}`}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={stories.fields.length >= MAX_COMPARE_STORIES}
              onClick={() => stories.append({ title: "", description: "" })}
            >
              <PlusIcon aria-hidden /> Add story
            </Button>
          </fieldset>

          {errors.root?.message ? (
            <Alert variant="destructive">
              <AlertTitle>The comparison did not run</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner aria-hidden /> : null}
            Compare
          </Button>
        </form>

        {result ? (
          <section aria-labelledby="compare-result" className="mt-8 space-y-3">
            <h3 id="compare-result" ref={resultRef} tabIndex={-1} className="font-semibold outline-none">
              How the pairs answered
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Story</TableHead>
                    {result.response.results.map((entry) => (
                      <TableHead key={entry.configuration_id}>{labels[entry.configuration_id] ?? entry.configuration_id}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.titles.map((title, index) => (
                    <TableRow key={`${title}-${index}`} className="align-top">
                      <TableCell className="max-w-64 min-w-40 font-medium whitespace-normal">{title}</TableCell>
                      {result.response.results.map((entry) => {
                        const prediction = entry.predictions[index];
                        return (
                          <TableCell key={entry.configuration_id}>
                            {prediction ? (
                              <div className="flex flex-col items-start gap-1.5">
                                <EffortValue
                                  value={prediction.predicted_story_points}
                                  range={prediction.prediction_interval}
                                  category={prediction.effort_category}
                                  coverage={prediction.interval_coverage}
                                />
                                <RiskBadge level={prediction.sprint_risk_level} />
                                <ConfidenceIndicator level={prediction.confidence_level} score={prediction.confidence_score} />
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
