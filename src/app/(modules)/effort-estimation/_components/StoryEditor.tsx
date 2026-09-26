"use client";

import { ChevronDownIcon, CircleAlertIcon, PlugZapIcon, Trash2Icon } from "lucide-react";
import { Controller, useFormContext, useWatch, type FieldError as HookFieldError } from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Textarea } from "@/shared/ui/textarea";

import { ISSUE_TYPES, PRIORITIES, type PlanValues } from "../_lib/backlog";

type StoryField = keyof PlanValues["stories"][number];

/** Options for a select, keeping a value that came from an imported backlog even if it isn't a usual one. */
function options(usual: readonly string[], current: string) {
  return current && !usual.includes(current) ? [...usual, current] : usual;
}

export function StoryEditor({
  index,
  expanded,
  onToggle,
  onRemove,
  canRemove,
}: {
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { register, control, formState } = useFormContext<PlanValues>();
  const story = useWatch({ control, name: `stories.${index}` });
  const errors = formState.errors.stories?.[index];
  const problems = errors ? Object.keys(errors).filter((key) => key !== "ref" && key !== "root").length : 0;
  const id = (field: StoryField) => `story-${index}-${field}`;
  const error = (field: StoryField) => (errors as Record<string, HookFieldError | undefined> | undefined)?.[field];

  /** Label, input props and error wiring for one field of this story. */
  const wire = (field: StoryField, help?: boolean) => ({
    id: id(field),
    "aria-invalid": !!error(field),
    "aria-describedby":
      [help ? `${id(field)}-help` : null, error(field) ? `${id(field)}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const fieldError = (field: StoryField) => <FieldError id={`${id(field)}-error`} errors={[error(field)]} />;
  const number = { type: "number", inputMode: "decimal" as const, min: 0, step: "any" };
  const whole = { type: "number", inputMode: "numeric" as const, min: 0, step: 1 };

  return (
    <li className={cn("rounded-xl border bg-card", problems > 0 && "border-destructive/60")}>
      <div className="flex items-center gap-2 p-2 pl-3">
        <Badge variant="secondary" className="tabular-nums">
          {index + 1}
        </Badge>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={expanded ? `story-${index}-fields` : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
        >
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-medium", !story?.title && "text-muted-foreground italic")}>
              {story?.title || "Untitled story"}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {story?.story_id}
              {story?.story_points ? ` · ${story.story_points} points` : ""}
            </span>
          </span>
          {story?.upstream ? (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
              <PlugZapIcon aria-hidden className="size-3.5" /> Pipeline signals
            </span>
          ) : null}
          {problems > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <CircleAlertIcon aria-hidden className="size-3.5" />
              {problems} {problems === 1 ? "problem" : "problems"}
            </span>
          ) : null}
          <ChevronDownIcon aria-hidden className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")} />
          <span className="sr-only">{expanded ? "Collapse" : "Edit"} story {index + 1}</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Remove story ${index + 1}`}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>

      {expanded ? (
        <div id={`story-${index}-fields`} className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field data-invalid={!!error("title")} className="sm:col-span-2 lg:col-span-4">
            <FieldLabel htmlFor={id("title")}>Title</FieldLabel>
            <Input
              {...wire("title")}
              placeholder="As a student I want to book a session so that I get help"
              {...register(`stories.${index}.title`)}
            />
            {fieldError("title")}
          </Field>

          <Field data-invalid={!!error("story_id")}>
            <FieldLabel htmlFor={id("story_id")}>Story id</FieldLabel>
            <Input {...wire("story_id")} className="font-mono" {...register(`stories.${index}.story_id`)} />
            {fieldError("story_id")}
          </Field>

          <Field>
            <FieldLabel htmlFor={id("issue_type")}>Type</FieldLabel>
            <NativeSelect id={id("issue_type")} className="w-full" {...register(`stories.${index}.issue_type`)}>
              <NativeSelectOption value="">Not set</NativeSelectOption>
              {options(ISSUE_TYPES, story?.issue_type ?? "").map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor={id("priority")}>Priority</FieldLabel>
            <NativeSelect id={id("priority")} className="w-full" {...register(`stories.${index}.priority`)}>
              <NativeSelectOption value="">Not set</NativeSelectOption>
              {options(PRIORITIES, story?.priority ?? "").map((priority) => (
                <NativeSelectOption key={priority} value={priority}>
                  {priority}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field data-invalid={!!error("story_points")}>
            <FieldLabel htmlFor={id("story_points")}>
              Team&apos;s estimate <span className="font-normal text-muted-foreground">(points, optional)</span>
            </FieldLabel>
            <Input {...wire("story_points")} {...number} {...register(`stories.${index}.story_points`)} />
            {fieldError("story_points")}
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={id("description")}>
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea id={id("description")} rows={3} {...register(`stories.${index}.description`)} />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={id("acceptance_criteria")}>
              Acceptance criteria <span className="font-normal text-muted-foreground">(one per line)</span>
            </FieldLabel>
            <Textarea
              id={id("acceptance_criteria")}
              rows={3}
              placeholder={"Given … when … then …"}
              {...register(`stories.${index}.acceptance_criteria`)}
            />
          </Field>

          <Field data-invalid={!!error("blocker_count")}>
            <FieldLabel htmlFor={id("blocker_count")}>Blocked by (open issues)</FieldLabel>
            <Input {...wire("blocker_count")} {...whole} placeholder="0" {...register(`stories.${index}.blocker_count`)} />
            {fieldError("blocker_count")}
          </Field>

          <Field data-invalid={!!error("dep_out_degree")}>
            <FieldLabel htmlFor={id("dep_out_degree")}>Depends on (issues)</FieldLabel>
            <Input {...wire("dep_out_degree")} {...whole} placeholder="0" {...register(`stories.${index}.dep_out_degree`)} />
            {fieldError("dep_out_degree")}
          </Field>

          <Field data-invalid={!!error("dep_in_degree")}>
            <FieldLabel htmlFor={id("dep_in_degree")}>Needed by (issues)</FieldLabel>
            <Input {...wire("dep_in_degree")} {...whole} placeholder="0" {...register(`stories.${index}.dep_in_degree`)} />
            {fieldError("dep_in_degree")}
          </Field>

          <Field>
            <FieldLabel htmlFor={id("has_epic")}>Part of an epic</FieldLabel>
            <NativeSelect id={id("has_epic")} className="w-full" {...register(`stories.${index}.has_epic`)}>
              <NativeSelectOption value="unknown">Unknown</NativeSelectOption>
              <NativeSelectOption value="yes">Yes</NativeSelectOption>
              <NativeSelectOption value="no">No</NativeSelectOption>
            </NativeSelect>
          </Field>

          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4 lg:flex-row lg:items-start lg:gap-8">
            <Controller
              control={control}
              name={`stories.${index}.in_progress`}
              render={({ field }) => (
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={id("in_progress")}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                  <FieldLabel htmlFor={id("in_progress")} className="font-normal">
                    Work has already started
                  </FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={control}
              name={`stories.${index}.added_mid_sprint`}
              render={({ field }) => (
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={id("added_mid_sprint")}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                  <FieldLabel htmlFor={id("added_mid_sprint")} className="font-normal">
                    Added after the sprint started
                  </FieldLabel>
                </Field>
              )}
            />
            {story?.added_mid_sprint ? (
              <Field data-invalid={!!error("days_into_sprint")} className="lg:max-w-56">
                <FieldLabel htmlFor={id("days_into_sprint")}>Days into the sprint</FieldLabel>
                <Input {...wire("days_into_sprint", true)} {...number} {...register(`stories.${index}.days_into_sprint`)} />
                <FieldDescription id={`${id("days_into_sprint")}-help`}>When it was added, after the start.</FieldDescription>
                {fieldError("days_into_sprint")}
              </Field>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
