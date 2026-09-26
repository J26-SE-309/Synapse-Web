"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { describeError } from "@/shared/api/gateway";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Textarea } from "@/shared/ui/textarea";

import { useFeedback } from "../_lib/api";
import { DECISION_LABELS, points } from "../_lib/format";
import type { Decision } from "../_lib/types";

export const MAX_REASON = 500;

export const feedbackSchema = (decision: Decision) =>
  z.object({
    points: z
      .string()
      .trim()
      .refine(
        (text) => decision !== "adjust" || (text !== "" && Number.isFinite(Number(text)) && Number(text) >= 0),
        "Enter your estimate: a number of 0 or more.",
      ),
    reason: z.string().trim().max(MAX_REASON, `Use at most ${MAX_REASON} characters.`),
  });

type FeedbackValues = z.infer<ReturnType<typeof feedbackSchema>>;

function DecisionForm({
  decision,
  predicted,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  decision: "adjust" | "reject";
  predicted: number;
  onSubmit: (values: FeedbackValues) => Promise<void>;
  onCancel: () => void;
  idPrefix: string;
}) {
  const form = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema(decision)),
    defaultValues: { points: decision === "adjust" ? String(Math.round(predicted * 10) / 10) : "", reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {decision === "adjust" ? (
        <Field data-invalid={!!errors.points}>
          <FieldLabel htmlFor={`${idPrefix}-points`}>Your estimate (points)</FieldLabel>
          <Input
            id={`${idPrefix}-points`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            autoFocus
            aria-invalid={!!errors.points}
            aria-describedby={errors.points ? `${idPrefix}-points-error` : undefined}
            {...form.register("points")}
          />
          <FieldError id={`${idPrefix}-points-error`} errors={[errors.points]} />
        </Field>
      ) : null}
      <Field data-invalid={!!errors.reason}>
        <FieldLabel htmlFor={`${idPrefix}-reason`}>
          Why? <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea
          id={`${idPrefix}-reason`}
          rows={2}
          autoFocus={decision === "reject"}
          aria-invalid={!!errors.reason}
          aria-describedby={errors.reason ? `${idPrefix}-reason-error` : undefined}
          {...form.register("reason")}
        />
        <FieldError id={`${idPrefix}-reason-error`} errors={[errors.reason]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {decision === "adjust" ? "Save estimate" : "Reject estimate"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Accept, adjust or reject an estimate (FR19). The latest decision counts; it is stored with the prediction
 * and compared with the sprint's outcome later.
 */
export function FeedbackControls({
  projectId,
  predictionId,
  storyTitle,
  predicted,
  initial,
}: {
  projectId: string;
  predictionId: string | null | undefined;
  storyTitle: string;
  predicted: number;
  initial?: { decision: Decision; points?: number | null } | null;
}) {
  const feedback = useFeedback(projectId);
  const [decided, setDecided] = useState(initial ?? null);
  const [open, setOpen] = useState<"adjust" | "reject" | null>(null);

  if (!predictionId) {
    return <span className="text-xs text-muted-foreground">Not recorded, so it cannot be reviewed</span>;
  }

  async function record(decision: Decision, values?: FeedbackValues) {
    try {
      const adjusted = decision === "adjust" && values ? Number(values.points) : null;
      const result = await feedback.mutateAsync({
        prediction_id: predictionId!,
        decision,
        target: "estimate",
        adjusted_story_points: adjusted,
        reason: values?.reason || null,
      });
      if (!result.recorded) {
        toast.warning("The decision was not stored", { description: "The service's database is unavailable. Try again shortly." });
        return;
      }
      setDecided({ decision, points: adjusted });
      setOpen(null);
      toast.success(`${DECISION_LABELS[decision]}: ${storyTitle}`);
    } catch (error) {
      toast.error("The decision was not stored", { description: describeError(error) });
    }
  }

  if (decided && open === null) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-medium">
          <CheckIcon aria-hidden className="size-4 text-success" />
          {DECISION_LABELS[decided.decision]}
          {decided.decision === "adjust" && decided.points != null ? ` to ${points(decided.points)}` : ""}
        </span>
        <Button variant="link" size="xs" className="h-auto px-0" onClick={() => setDecided(null)}>
          Change<span className="sr-only"> the decision on {storyTitle}</span>
        </Button>
      </div>
    );
  }

  const idPrefix = `feedback-${predictionId}`;
  return (
    <div role="group" aria-label={`Review the estimate for ${storyTitle}`} className="flex flex-wrap gap-1.5">
      <Button size="xs" variant="outline" disabled={feedback.isPending} onClick={() => record("accept")}>
        <CheckIcon aria-hidden /> Accept
      </Button>
      {(["adjust", "reject"] as const).map((decision) => (
        <Popover key={decision} open={open === decision} onOpenChange={(next) => setOpen(next ? decision : null)}>
          <PopoverTrigger asChild>
            <Button size="xs" variant="outline" disabled={feedback.isPending}>
              {decision === "adjust" ? <PencilIcon aria-hidden /> : <XIcon aria-hidden />}
              {decision === "adjust" ? "Adjust" : "Reject"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <DecisionForm
              decision={decision}
              predicted={predicted}
              idPrefix={`${idPrefix}-${decision}`}
              onSubmit={(values) => record(decision, values)}
              onCancel={() => setOpen(null)}
            />
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
