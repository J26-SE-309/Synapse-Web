"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";

import { useCreateStory, useUpdateStory } from "./api";
import { EMPTY_STORY, storyFormSchema, toFormValues, toStory, type StoryFormValues } from "./schema";
import { ISSUE_TYPES, PRIORITIES, type Story } from "./types";

type FieldName = keyof StoryFormValues;
const FIELDS = Object.keys(EMPTY_STORY) as FieldName[];

/**
 * Create a story, or edit one (story given). With sprintId, a new story goes straight into that sprint.
 */
export function StoryFormDialog({
  projectId,
  story,
  sprintId,
  open,
  onOpenChange,
}: {
  projectId: string;
  story?: Story;
  sprintId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: story ? toFormValues(story) : EMPTY_STORY,
    mode: "onTouched",
  });
  const create = useCreateStory(projectId);
  const update = useUpdateStory(projectId);
  const { errors, isSubmitting } = form.formState;
  const editing = !!story;

  useEffect(() => {
    if (open) form.reset(story ? toFormValues(story) : EMPTY_STORY);
  }, [open, story, form]);

  async function submit(values: StoryFormValues) {
    const body = toStory(values);
    try {
      if (story) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { story_id, ...changes } = body;
        await update.mutateAsync({ storyId: story.story_id, update: changes });
        toast.success(`Saved ${story.story_id}`);
      } else {
        const created = await create.mutateAsync(body);
        if (sprintId) await update.mutateAsync({ storyId: created.story_id, update: { sprint_id: sprintId } });
        toast.success(`Added ${created.story_id}`, { description: sprintId ? `In ${sprintId}` : "In the backlog" });
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof GatewayError && error.status === 409) {
        form.setError("story_id", { message: "A story with this id already exists." }, { shouldFocus: true });
        return;
      }
      if (error instanceof GatewayError && error.status === 422) {
        let placed = false;
        for (const problem of error.problems) {
          const field = FIELDS.find((name) => name === problem.loc[1]);
          if (field) {
            form.setError(field, { message: problem.msg });
            placed = true;
          }
        }
        if (placed) return;
      }
      form.setError("root", { message: describeError(error) });
    }
  }

  function invalid(found: FieldErrors<StoryFormValues>) {
    const first = FIELDS.find((name) => found[name]);
    if (first) form.setFocus(first);
  }

  const wire = (name: FieldName, help = false) => ({
    id: `story-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby":
      [help ? `story-${name}-help` : null, errors[name] ? `story-${name}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const fieldError = (name: FieldName) => <FieldError id={`story-${name}-error`} errors={[errors[name]]} />;
  const whole = { type: "number", inputMode: "numeric" as const, min: 0, step: 1, placeholder: "0" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form noValidate onSubmit={form.handleSubmit(submit, invalid)} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${story.story_id}` : "New story"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes are saved to the platform's backlog; an active sprint is updated for every component."
                : sprintId
                  ? `The story is added to the backlog and put into ${sprintId}.`
                  : "The story goes into the project's backlog, ready for a sprint."}
            </DialogDescription>
          </DialogHeader>

          {errors.root?.message ? (
            <Alert variant="destructive">
              <AlertTitle>The story was not saved</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field data-invalid={!!errors.title} className="sm:col-span-2 lg:col-span-4">
              <FieldLabel htmlFor="story-title">Title</FieldLabel>
              <Input
                {...wire("title")}
                autoComplete="off"
                placeholder="As a student I want to book a session so that I get help"
                {...form.register("title")}
              />
              {fieldError("title")}
            </Field>

            <Field data-invalid={!!errors.story_id}>
              <FieldLabel htmlFor="story-story_id">Story id</FieldLabel>
              <Input
                {...wire("story_id", true)}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                readOnly={editing}
                placeholder={`${projectId}-…`}
                {...form.register("story_id")}
              />
              <FieldDescription id="story-story_id-help">
                {editing ? "Ids don't change." : "Empty: the next free id."}
              </FieldDescription>
              {fieldError("story_id")}
            </Field>

            <Field>
              <FieldLabel htmlFor="story-issue_type">Type</FieldLabel>
              <NativeSelect id="story-issue_type" className="w-full" {...form.register("issue_type")}>
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {ISSUE_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="story-priority">Priority</FieldLabel>
              <NativeSelect id="story-priority" className="w-full" {...form.register("priority")}>
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field data-invalid={!!errors.story_points}>
              <FieldLabel htmlFor="story-story_points">
                Story points <span className="font-normal text-muted-foreground">(team&apos;s estimate)</span>
              </FieldLabel>
              <Input
                {...wire("story_points")}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                {...form.register("story_points")}
              />
              {fieldError("story_points")}
            </Field>

            <Field data-invalid={!!errors.description} className="sm:col-span-2">
              <FieldLabel htmlFor="story-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea {...wire("description")} rows={4} {...form.register("description")} />
              {fieldError("description")}
            </Field>

            <Field data-invalid={!!errors.acceptance_criteria} className="sm:col-span-2">
              <FieldLabel htmlFor="story-acceptance_criteria">
                Acceptance criteria <span className="font-normal text-muted-foreground">(one per line)</span>
              </FieldLabel>
              <Textarea
                {...wire("acceptance_criteria")}
                rows={4}
                placeholder={"Given … when … then …"}
                {...form.register("acceptance_criteria")}
              />
              {fieldError("acceptance_criteria")}
            </Field>

            <Field data-invalid={!!errors.epic}>
              <FieldLabel htmlFor="story-epic">
                Epic <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input {...wire("epic")} autoComplete="off" placeholder="Booking" {...form.register("epic")} />
              {fieldError("epic")}
            </Field>

            <Field data-invalid={!!errors.blocked_by}>
              <FieldLabel htmlFor="story-blocked_by">Blocked by (open issues)</FieldLabel>
              <Input {...wire("blocked_by")} {...whole} {...form.register("blocked_by")} />
              {fieldError("blocked_by")}
            </Field>

            <Field data-invalid={!!errors.depends_on}>
              <FieldLabel htmlFor="story-depends_on">Depends on (issues)</FieldLabel>
              <Input {...wire("depends_on")} {...whole} {...form.register("depends_on")} />
              {fieldError("depends_on")}
            </Field>

            <Field data-invalid={!!errors.needed_by}>
              <FieldLabel htmlFor="story-needed_by">Needed by (issues)</FieldLabel>
              <Input {...wire("needed_by")} {...whole} {...form.register("needed_by")} />
              {fieldError("needed_by")}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner aria-hidden /> : null}
              {editing ? "Save story" : "Add story"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
