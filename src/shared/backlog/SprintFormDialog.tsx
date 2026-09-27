"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { describeError, GatewayError } from "@/shared/api/gateway";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";

import { useCreateSprint, useUpdateSprint } from "./api";
import { EMPTY_SPRINT, sprintFormSchema, toSprint, type SprintFormValues } from "./schema";
import type { Sprint } from "./types";

type FieldName = keyof SprintFormValues;
const FIELDS = Object.keys(EMPTY_SPRINT) as FieldName[];

function values(sprint: Sprint): SprintFormValues {
  return {
    sprint_id: sprint.sprint_id,
    name: sprint.name,
    goal: sprint.goal,
    length_days: String(sprint.length_days),
    capacity_points: sprint.capacity_points === null ? "" : String(sprint.capacity_points),
  };
}

/** Plan a new sprint, or change one that has not closed (sprint given). */
export function SprintFormDialog({
  projectId,
  sprint,
  open,
  onOpenChange,
}: {
  projectId: string;
  sprint?: Sprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: sprint ? values(sprint) : EMPTY_SPRINT,
    mode: "onTouched",
  });
  const create = useCreateSprint(projectId);
  const update = useUpdateSprint(projectId, sprint?.sprint_id ?? "");
  const router = useRouter();
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(sprint ? values(sprint) : EMPTY_SPRINT);
  }, [open, sprint, form]);

  async function submit(entered: SprintFormValues) {
    const body = toSprint(entered);
    try {
      if (sprint) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sprint_id, ...changes } = body;
        await update.mutateAsync({ ...changes, name: changes.name ?? sprint.name });
        toast.success(`Saved ${sprint.name}`);
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync(body);
        toast.success(`Planned ${created.name}`, { description: created.sprint_id });
        onOpenChange(false);
        router.push(`/sprints/${encodeURIComponent(created.sprint_id)}`);
      }
    } catch (error) {
      if (error instanceof GatewayError && error.status === 409 && !sprint) {
        form.setError("sprint_id", { message: "A sprint with this id already exists." }, { shouldFocus: true });
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

  const wire = (name: FieldName, help = false) => ({
    id: `sprint-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby":
      [help ? `sprint-${name}-help` : null, errors[name] ? `sprint-${name}-error` : null].filter(Boolean).join(" ") || undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{sprint ? `Edit ${sprint.name}` : "Plan a sprint"}</DialogTitle>
            <DialogDescription>
              {sprint
                ? "The id stays the same; every component stores the sprint's data under it."
                : "Plan it now, add stories from the backlog, check the estimates, then start it."}
            </DialogDescription>
          </DialogHeader>

          {errors.root?.message ? (
            <Alert variant="destructive">
              <AlertTitle>The sprint was not saved</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="sprint-name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input {...wire("name")} autoComplete="off" placeholder="Sprint 3" {...form.register("name")} />
              <FieldError id="sprint-name-error" errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.sprint_id}>
              <FieldLabel htmlFor="sprint-sprint_id">Sprint id</FieldLabel>
              <Input
                {...wire("sprint_id", true)}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                readOnly={!!sprint}
                placeholder={`${projectId}-S…`}
                {...form.register("sprint_id")}
              />
              <FieldDescription id="sprint-sprint_id-help">{sprint ? "Ids don't change." : "Empty: the next free id."}</FieldDescription>
              <FieldError id="sprint-sprint_id-error" errors={[errors.sprint_id]} />
            </Field>
            <Field data-invalid={!!errors.goal} className="sm:col-span-2">
              <FieldLabel htmlFor="sprint-goal">
                Sprint goal <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea {...wire("goal")} rows={2} placeholder="Students can book and pay for a session" {...form.register("goal")} />
              <FieldError id="sprint-goal-error" errors={[errors.goal]} />
            </Field>
            <Field data-invalid={!!errors.length_days}>
              <FieldLabel htmlFor="sprint-length_days">Length (days)</FieldLabel>
              <Input {...wire("length_days")} type="number" inputMode="numeric" min={1} max={60} step={1} {...form.register("length_days")} />
              <FieldError id="sprint-length_days-error" errors={[errors.length_days]} />
            </Field>
            <Field data-invalid={!!errors.capacity_points}>
              <FieldLabel htmlFor="sprint-capacity_points">
                Capacity (points) <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                {...wire("capacity_points", true)}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                {...form.register("capacity_points")}
              />
              <FieldDescription id="sprint-capacity_points-help">Empty: the team&apos;s recent velocity.</FieldDescription>
              <FieldError id="sprint-capacity_points-error" errors={[errors.capacity_points]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner aria-hidden /> : null}
              {sprint ? "Save sprint" : "Plan sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
