"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { useCreateProject, type Project } from "@/shared/projects/api";
import {
  normaliseProjectId,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_ID_MAX,
  projectCreateSchema,
  suggestProjectId,
  type ProjectCreateValues,
} from "@/shared/projects/schema";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";

const EMPTY: ProjectCreateValues = { name: "", id: "", description: "" };
const FIELDS = ["name", "id", "description"] as const;

export function NewProjectDialog({
  open,
  onOpenChange,
  existingIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIds: readonly string[];
  onCreated: (project: Project) => void;
}) {
  const schema = useMemo(() => projectCreateSchema(existingIds), [existingIds]);
  const form = useForm<ProjectCreateValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: "onTouched" });
  const create = useCreateProject();
  // The key follows the name until someone types a key of their own.
  const [keyEdited, setKeyEdited] = useState(false);
  const { errors } = form.formState;
  const description = useWatch({ control: form.control, name: "description" });

  function close(next: boolean) {
    if (!next) {
      form.reset(EMPTY);
      create.reset();
      setKeyEdited(false);
    }
    onOpenChange(next);
  }

  async function submit(values: ProjectCreateValues) {
    try {
      const project = await create.mutateAsync(values);
      toast.success(`Created ${project.name}`, { description: `Project key ${project.id}` });
      onCreated(project);
      close(false);
    } catch (error) {
      if (error instanceof GatewayError && error.status === 409) {
        form.setError("id", { message: "A project with this key already exists." }, { shouldFocus: true });
        return;
      }
      if (error instanceof GatewayError && error.status === 422) {
        for (const problem of error.problems) {
          const field = FIELDS.find((name) => name === problem.loc[1]);
          if (field) form.setError(field, { message: problem.msg });
        }
        if (error.problems.some((problem) => FIELDS.includes(problem.loc[1] as (typeof FIELDS)[number]))) return;
      }
      form.setError("root", { message: describeError(error) });
    }
  }

  const name = form.register("name", {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!keyEdited) {
        form.setValue("id", suggestProjectId(event.target.value), { shouldValidate: form.formState.touchedFields.id });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              A project is one team&apos;s backlog and sprints. Every component stores its data under the project&apos;s key.
            </DialogDescription>
          </DialogHeader>

          {errors.root?.message ? (
            <Alert variant="destructive">
              <AlertTitle>The project was not created</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                autoComplete="off"
                placeholder="Tutoring app"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "project-name-error" : undefined}
                {...name}
              />
              <FieldError id="project-name-error" errors={[errors.name]} />
            </Field>

            <Controller
              control={form.control}
              name="id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="project-id">Project key</FieldLabel>
                  <Input
                    id="project-id"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="TUTOR"
                    maxLength={PROJECT_ID_MAX + 8}
                    className="font-mono uppercase"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`project-id-help${fieldState.invalid ? " project-id-error" : ""}`}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      setKeyEdited(event.target.value !== "");
                      field.onChange(normaliseProjectId(event.target.value));
                    }}
                  />
                  <FieldDescription id="project-id-help">
                    Capital letters, digits and hyphens, {PROJECT_ID_MAX} at most. It can&apos;t be changed later.
                  </FieldDescription>
                  <FieldError id="project-id-error" errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="project-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                id="project-description"
                rows={3}
                placeholder="What the team is building"
                aria-invalid={!!errors.description}
                aria-describedby={`project-description-count${errors.description ? " project-description-error" : ""}`}
                {...form.register("description")}
              />
              <FieldDescription id="project-description-count" className="tabular-nums">
                {description.length} / {PROJECT_DESCRIPTION_MAX} characters
              </FieldDescription>
              <FieldError id="project-description-error" errors={[errors.description]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner aria-hidden /> : null}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
