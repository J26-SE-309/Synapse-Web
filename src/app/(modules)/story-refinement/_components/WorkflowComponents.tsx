import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { StatusBadge } from "./StoryComponents";

const WORKFLOW_STEPS = [
  { label: "Validated requirement", href: "/story-refinement/requirements" },
  { label: "Story generation", href: "/story-refinement/candidates" },
  { label: "INVEST assessment", href: "/story-refinement/evaluation" },
  { label: "Acceptance criteria", href: "/story-refinement/acceptance-criteria" },
  { label: "Optimization", href: "/story-refinement/acceptance-criteria#local-optimization-heading" },
  { label: "Human review", href: "/story-refinement/review" },
] as const;

export function WorkflowIndicator({ currentStep }: { currentStep: (typeof WORKFLOW_STEPS)[number]["label"] }) {
  return (
    <nav aria-label="Story refinement workflow">
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {WORKFLOW_STEPS.map((step, index) => {
          const current = step.label === currentStep;
          return (
            <li key={step.label}>
              <Link
                href={step.href}
                aria-current={current ? "step" : undefined}
                className={`flex h-full items-center gap-2 rounded-md border p-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${current ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border font-mono">{index + 1}</span>
                <span>{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function GenerationProgress({
  label = "Generating…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium text-primary"><LoaderCircleIcon aria-hidden className="size-4 animate-spin" />{label}</p>
      <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-md border bg-muted/35" />)}</div>
    </div>
  );
}

export function ReviewPanel({
  title,
  description,
  children,
  status,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  status?: "Draft" | "Approved" | "Rejected";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="text-base">{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</div>
          {status ? <StatusBadge status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ApprovalDialog({
  open,
  onOpenChange,
  onConfirm,
  isApproved = false,
  disabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isApproved?: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm approval</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to approve this user story and acceptance criteria?</AlertDialogDescription>
        </AlertDialogHeader>
        <Alert className="border-warning/30 bg-warning/10">
          <AlertTriangleIcon aria-hidden />
          <AlertTitle>Human decision required</AlertTitle>
          <AlertDescription>Approval is an explicit human decision. Generated content is not automatically accepted.</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isApproved || disabled}>Confirm Approval</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}