"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  FileCheck2Icon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RotateCwIcon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { describeError } from "@/shared/api/gateway";
import { useProject } from "@/shared/projects/ProjectProvider";
import { useImportStories } from "@/shared/backlog/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";

import { AcceptanceCriteriaReviewCard } from "./AcceptanceCriteriaComponents";
import { AssumptionList, INVESTChecklist, QualityEvaluation, RequirementCard, StatusBadge, UserStoryCard } from "./StoryComponents";
import { ApprovalDialog, ReviewPanel, WorkflowIndicator } from "./WorkflowComponents";
import {
  approveGeneration,
  createDemoGeneration,
  createMockAcceptanceCriteria,
  EMPTY_PROJECT_CONTEXT,
  evaluateInvestLocally,
  generateCandidates,
  analyzeAcceptanceCriteriaLocally,
  getMockImprovementRecommendations,
  MOCK_REQUIREMENTS,
  optimizeAcceptanceCriteriaLocally,
  optimizeUserStoryLocally,
  readGenerationHistory,
  saveGeneration,
} from "../_lib/mock-service";
import type { GenerationRecord, LocalOptimizationResult, StoryDraft, ValidatedRequirement } from "../_lib/types";

function initialRecord(requirement: ValidatedRequirement, candidateId?: string): GenerationRecord {
  const base = createDemoGeneration(requirement);
  const candidate = base.candidates.find((entry) => entry.storyId === candidateId) ?? base.candidates[0];
  return {
    ...base,
    selectedCandidateId: candidate.id,
    draft: { userStory: candidate.userStory, acceptanceCriteria: createMockAcceptanceCriteria(requirement) },
  };
}

export function ReviewApprovalView({
  initialRequirementId,
  initialCandidateId,
  initialResumeId,
}: {
  initialRequirementId?: string;
  initialCandidateId?: string;
  initialResumeId?: string;
}) {
  const initialRequirement = MOCK_REQUIREMENTS.find((item) => item.id === initialRequirementId) ?? MOCK_REQUIREMENTS[0];
  const [record, setRecord] = useState<GenerationRecord>(() => initialRecord(initialRequirement, initialCandidateId));
  const [editingStory, setEditingStory] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [optimization, setOptimization] = useState<LocalOptimizationResult | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { project, projectId } = useProject();
  const importStories = useImportStories(projectId ?? "");
  const router = useRouter();

  useEffect(() => {
    if (!initialResumeId) return;
    const resumed = readGenerationHistory().find((entry) => entry.id === initialResumeId);
    startTransition(() => {
      if (!resumed) {
        setError("The review draft could not be restored. Return to Acceptance Criteria and continue again.");
        return;
      }
      setRecord(resumed);
      setReviewer(resumed.reviewMetadata?.reviewer ?? "");
      setDecisionNotes(resumed.reviewMetadata?.decisionNotes ?? resumed.approvedPackage?.decisionNotes ?? "");
      setNotice("Draft restored from Acceptance Criteria. Review each section before approval.");
    });
  }, [initialResumeId]);

  const requirement = MOCK_REQUIREMENTS.find((item) => item.id === record.requirementId) ?? initialRequirement;
  const candidate = record.candidates.find((item) => item.id === record.selectedCandidateId) ?? record.candidates[0];
  const recommendations = getMockImprovementRecommendations(
    candidate,
    typeof record.context === "string" ? { ...EMPTY_PROJECT_CONTEXT, existingSystemContext: record.context } : { ...EMPTY_PROJECT_CONTEXT, ...record.context },
  );
  const approved = record.status === "Approved" || !!record.approvedAt;
  const reviewContext = typeof record.context === "string"
    ? { ...EMPTY_PROJECT_CONTEXT, existingSystemContext: record.context }
    : { ...EMPTY_PROJECT_CONTEXT, ...record.context };
  const investAssessment = evaluateInvestLocally(record.draft.userStory, record.draft.acceptanceCriteria);
  const reviewFindings = analyzeAcceptanceCriteriaLocally(requirement, reviewContext, record.draft.acceptanceCriteria);
  const criteriaAreComplete = record.draft.acceptanceCriteria.length > 0
    && record.draft.acceptanceCriteria.every((criterion) =>
      criterion.title?.trim() && criterion.given.trim() && criterion.when.trim() && criterion.then.trim() && criterion.priority && criterion.category,
    );
  const approvalBlockers = [
    ...(!record.draft.userStory.trim() ? ["The user story is empty."] : []),
    ...(!criteriaAreComplete ? ["At least one complete criterion with a title and Given–When–Then steps is required."] : []),
    ...record.draft.acceptanceCriteria.filter((criterion) => criterion.decisionRequired).map((criterion) => `${criterion.id}: record and save the approved decision before approval.`),
    ...(requirement.id === "REQ-BANK-001" && !decisionNotes.trim()
      ? ["Record the human disposition of the unresolved bank-specific rules; do not treat the prototype's examples as bank policy."]
      : []),
    ...reviewFindings.filter((finding) => finding.id === "coverage" && finding.status === "Missing").map((finding) => finding.summary),
  ];
  const criteriaAreApprovalReady = criteriaAreComplete && approvalBlockers.length === 0 && reviewer.trim().length > 0;

  function updateDraft(nextDraft: StoryDraft) {
    setRecord((current) => ({
      ...current,
      draft: nextDraft,
      status: "Draft",
      approvedAt: undefined,
      approvedDraft: undefined,
      approvedPackage: undefined,
      reviewMetadata: undefined,
      sprintIntegration: undefined,
    }));
    setOptimization(null);
    setNotice(null);
  }

  function addCriterion() {
    const nextId = `AC${Math.max(0, ...record.draft.acceptanceCriteria.map((criterion) => Number(criterion.id.replace(/\D/g, "")) || 0)) + 1}`;
    updateDraft({
      ...record.draft,
      acceptanceCriteria: [...record.draft.acceptanceCriteria, {
        id: nextId,
        title: "",
        given: "",
        when: "",
        then: "",
        priority: "Medium",
        category: "Functional",
        status: "Draft",
      }],
    });
    setEditingCriterionId(nextId);
  }

  function verifyCriterion(criterionId: string) {
    updateDraft({
      ...record.draft,
      acceptanceCriteria: record.draft.acceptanceCriteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, status: "Human Verified" } : criterion,
      ),
    });
  }

  function optimizeStory() {
    const result = optimizeUserStoryLocally(record.draft.userStory, requirement);
    updateDraft({ ...record.draft, userStory: result.optimizedStory });
    setNotice(`${result.explanation} Prototype formatting only; confirm the result against the validated requirement.`);
  }

  function rerunOptimization() {
    try {
      const result = optimizeAcceptanceCriteriaLocally(requirement, reviewContext, record.draft.acceptanceCriteria, decisionNotes);
      setOptimization(result);
      setRecord((current) => ({
        ...current,
        draft: { ...current.draft, acceptanceCriteria: result.optimizedCriteria },
        status: "Draft",
        approvedAt: undefined,
        approvedDraft: undefined,
        approvedPackage: undefined,
        reviewMetadata: undefined,
        sprintIntegration: undefined,
      }));
      setNotice("Prototype optimization reran. Review the original-to-optimized changes and all remaining findings before approval.");
    } catch (optimizationError) {
      setError(optimizationError instanceof Error
        ? `Optimization could not be completed: ${optimizationError.message}`
        : "Optimization could not be completed. The draft is unchanged.");
    }
  }

  function backToEditing() {
    if (!saveDraft()) return;
    router.push(`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(candidate.storyId)}&resumeId=${encodeURIComponent(record.id)}`);
  }

  function requestChanges() {
    const decidedAt = new Date().toISOString();
    const requested = {
      ...record,
      status: "Draft" as const,
      approvedAt: undefined,
      approvedDraft: undefined,
      approvedPackage: undefined,
      reviewMetadata: {
        reviewer: reviewer.trim(),
        decision: "Changes Requested" as const,
        decidedAt,
        persistence: "prototype" as const,
        decisionNotes: decisionNotes.trim(),
      },
    };
    if (!persistReviewRecord(requested, "Changes requested and saved to this browser's prototype history. Returning to Acceptance Criteria for editing.")) return;
    router.push(`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(candidate.storyId)}&resumeId=${encodeURIComponent(record.id)}`);
  }

  function persistReviewRecord(nextRecord: GenerationRecord, successMessage: string): boolean {
    try {
      saveGeneration(nextRecord);
      setRecord(nextRecord);
      setNotice(successMessage);
      setError(null);
      return true;
    } catch (saveError) {
      setError(`The review decision could not be saved to browser history. Your current page state is unchanged. ${describeError(saveError)}`);
      return false;
    }
  }

  function saveDraft() {
    const saved = {
      ...record,
      status: "Draft" as const,
      approvedAt: undefined,
      approvedDraft: undefined,
      approvedPackage: undefined,
      reviewMetadata: {
        reviewer: reviewer.trim(),
        decision: "Draft" as const,
        decidedAt: new Date().toISOString(),
        persistence: "prototype" as const,
        decisionNotes: decisionNotes.trim(),
      },
    };
    return persistReviewRecord(saved, "Draft saved on this device. It is not approved yet.");
  }

  async function regenerate() {
    setIsRegenerating(true);
    setError(null);
    setNotice(null);
    try {
      const regenerated = await generateCandidates({
        requirement,
        context: { ...EMPTY_PROJECT_CONTEXT, ...record.context },
        projectId: record.projectId,
      });
      const selected = regenerated.candidates.find((item) => item.storyId === candidate.storyId) ?? regenerated.candidates[0];
      const nextRecord: GenerationRecord = {
        ...regenerated,
        id: record.id,
        selectedCandidateId: selected.id,
        draft: { userStory: selected.userStory, acceptanceCriteria: createMockAcceptanceCriteria(requirement) },
        status: "Draft",
      };
      setRecord(nextRecord);
      setEditingStory(false);
      setEditingCriterionId(null);
      saveGeneration(nextRecord);
      setNotice("Story and criteria regenerated as a draft. Human review and confirmation are still required.");
    } catch {
      setError("Regeneration failed. The current draft is unchanged; try again.");
    } finally {
      setIsRegenerating(false);
    }
  }

  function rejectDraft() {
    const decidedAt = new Date().toISOString();
    const rejected = {
      ...record,
      status: "Rejected" as const,
      approvedAt: undefined,
      approvedDraft: undefined,
      approvedPackage: undefined,
      reviewMetadata: { reviewer: reviewer.trim(), decision: "Rejected" as const, decidedAt, persistence: "prototype" as const, decisionNotes: decisionNotes.trim() },
    };
    const saved = persistReviewRecord(rejected, "This draft was rejected and saved to local history. It has not been approved.");
    if (!saved) return;
    setRejectionOpen(false);
  }

  function confirmApproval() {
    if (!criteriaAreApprovalReady) return;
    try {
      const approvedRecords = approveGeneration(record, record.draft, reviewer, decisionNotes, investAssessment);
      const approvedRecord = approvedRecords.find((entry) => entry.id === record.id);
      if (!approvedRecord) {
        setError("The approved version could not be saved. The current draft remains unapproved.");
        return;
      }
      setRecord(approvedRecord);
      setApprovalOpen(false);
      setNotice("User story and acceptance criteria approved. Reviewer, decision, and time are prototype fields saved in this browser's history.");
      setError(null);
    } catch (approvalError) {
      setError(describeError(approvalError));
    }
  }

  async function generateSprint() {
    if (!approved || !record.approvedPackage || !record.approvedDraft) return;
    setError(null);
    setNotice(null);
    if (!projectId || !project) {
      setNotice("User story and acceptance criteria approved successfully. Sprint planning integration is not connected to an active project yet. The approved artifacts are ready for integration.");
      return;
    }

    try {
      const result = await importStories.mutateAsync({
        stories: [{
          title: requirement.title,
          description: record.approvedPackage.userStory,
          acceptance_criteria: record.approvedPackage.acceptanceCriteria.map(
            (criterion) => `Given ${criterion.given}; when ${criterion.when}; then ${criterion.then}`,
          ),
          issue_type: "Story",
        }],
        sprint: null,
      });
      const integratedStory = result.stories[0];
      if (!integratedStory) {
        setError("The backlog service did not return a created story. Check the backlog before retrying to avoid duplicates.");
        return;
      }
      const integratedRecord: GenerationRecord = {
        ...record,
        sprintIntegration: {
          projectId,
          storyId: integratedStory.story_id,
          integratedAt: new Date().toISOString(),
          ...(result.sprint ? { sprintId: result.sprint.sprint_id } : {}),
        },
      };
      setRecord(integratedRecord);
      try {
        saveGeneration(integratedRecord);
        setNotice(result.sprint
          ? `Approved story ${integratedStory.story_id} was added to sprint ${result.sprint.name} (${result.sprint.sprint_id}).`
          : `Approved story ${integratedStory.story_id} was added to the backlog. No sprint was created because no sprint-planning details were supplied.`);
      } catch (saveError) {
        setError(`The story was created in the backlog, but this device could not save its reference. Do not submit again. ${describeError(saveError)}`);
      }
    } catch (integrationError) {
      setError(`The approved story was not added to sprint planning. ${describeError(integrationError)}`);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Review & Approval"
        description="Review the validated source, generated story, and acceptance criteria before deciding what becomes an Agile artifact."
        actions={
          <Button asChild variant="outline">
            <Link href={`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(candidate.storyId)}`}>
              <ArrowLeftIcon aria-hidden /> Acceptance Criteria
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="rounded-sm border bg-muted px-2 py-1 font-mono">{record.requirementId}</span>
          <StatusBadge status={approved ? "Approved" : record.status ?? "Draft"} />
          <span className="text-muted-foreground">Human decision required</span>
        </div>
      </PageHeader>

      <WorkflowIndicator currentStep="Human review" />
      {notice ? <Alert className="border-primary/25 bg-primary/5"><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>Review action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <section aria-labelledby="original-requirement-heading">
        <p id="original-requirement-heading" className="mb-3 text-xs font-semibold uppercase text-primary">Section 1 · Original Requirement</p>
        <RequirementCard requirement={requirement} />
      </section>

      <section aria-labelledby="comparison-heading" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Source comparison</p>
          <h2 id="comparison-heading" className="mt-1 text-lg font-semibold">Original Requirement vs Generated User Story</h2>
        </div>
        <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
          <Card>
            <CardHeader><CardTitle className="text-sm">Original Requirement</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-relaxed">{requirement.text}</p></CardContent>
          </Card>
          <div className="grid place-items-center text-xs font-semibold uppercase text-muted-foreground">VS</div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Generated User Story</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-relaxed">{record.draft.userStory}</p></CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="story-review-heading">
        <p id="story-review-heading" className="mb-3 text-xs font-semibold uppercase text-primary">Section 2 · Generated User Story</p>
        <ReviewPanel title={`${candidate.storyId} · ${candidate.label}`} description="Edit the story before saving, rejecting, or approving.">
          {editingStory ? (
            <Textarea aria-label="Edit reviewed user story" value={record.draft.userStory} onChange={(event) => updateDraft({ ...record.draft, userStory: event.target.value })} rows={4} className="min-h-28 resize-y leading-relaxed" />
          ) : <UserStoryCard story={{ storyId: candidate.storyId, requirementId: requirement.id, text: record.draft.userStory }} title="Generated User Story" />}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setEditingStory(!editingStory)}>
            <PencilIcon aria-hidden /> {editingStory ? "Done Editing" : "Edit"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="ml-2 mt-4" onClick={optimizeStory}>
            <SparklesIcon aria-hidden /> Optimize User Story
          </Button>
        </ReviewPanel>
      </section>

      <section aria-labelledby="acceptance-review-heading" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Section 3</p>
          <h2 id="acceptance-review-heading" className="mt-1 text-lg font-semibold">Acceptance Criteria</h2>
          <p className="text-sm text-muted-foreground">Edit or remove criteria before approval.</p>
        </div>
        {record.draft.acceptanceCriteria.map((criterion) => (
          <AcceptanceCriteriaReviewCard
            key={criterion.id}
            criterion={criterion}
            editing={editingCriterionId === criterion.id}
            onToggleEdit={() => {
              if (editingCriterionId === criterion.id) {
                const hasDecision = Boolean(criterion.decisionRequired && criterion.decisionResolution?.trim());
                if (hasDecision) {
                  updateDraft({
                    ...record.draft,
                    acceptanceCriteria: record.draft.acceptanceCriteria.map((item) => item.id === criterion.id
                      ? { ...item, decisionRequired: undefined, status: "Human Verified" }
                      : item),
                  });
                } else {
                  updateDraft({
                    ...record.draft,
                    acceptanceCriteria: record.draft.acceptanceCriteria.map((item) => item.id === criterion.id
                      ? { ...item, status: item.status === "Human Verified" ? "Draft" : item.status }
                      : item),
                  });
                }
                setEditingCriterionId(null);
              } else {
                setEditingCriterionId(criterion.id);
              }
            }}
            onChange={(field, value) => updateDraft({
              ...record.draft,
              acceptanceCriteria: record.draft.acceptanceCriteria.map((item) => item.id === criterion.id ? { ...item, [field]: value } : item),
            })}
            onDelete={() => updateDraft({ ...record.draft, acceptanceCriteria: record.draft.acceptanceCriteria.filter((item) => item.id !== criterion.id) })}
            onVerify={() => verifyCriterion(criterion.id)}
          />
        ))}
        {!record.draft.acceptanceCriteria.length ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No acceptance criteria remain. Regenerate or reject this draft before approval.</div> : null}
        <Button type="button" variant="outline" onClick={addCriterion}><PlusIcon aria-hidden /> Add Criterion</Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ReviewPanel title="Context-aware review findings" description="Deterministic prototype checks only; no semantic engine or authoritative policy validation is running.">
            <ul className="space-y-2">{reviewFindings.map((finding) => (
              <li key={finding.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-sm">{finding.summary}</p><StatusBadge status={finding.status} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{finding.details}</p>
              </li>
            ))}</ul>
            {optimization ? (
              <div className="mt-4 space-y-3 border-t pt-3">
                <h3 className="font-semibold">Original and optimized criteria comparison</h3>
                {optimization.changes.length ? optimization.changes.map((change) => (
                  <article key={change.criterionId} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{change.criterionId}: {change.explanation}</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Original</p><p>{change.original.title}: {change.original.given} / {change.original.when} / {change.original.then}</p></div>
                      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Optimized</p><p>{change.optimized ? `${change.optimized.title}: ${change.optimized.given} / ${change.optimized.when} / ${change.optimized.then}` : "Removed as an exact duplicate."}</p></div>
                    </div>
                  </article>
                )) : <p className="text-sm text-muted-foreground">No wording or duplicate changes were proposed; original and optimized sets are unchanged.</p>}
              </div>
            ) : null}
            <ul className="mt-4 space-y-2">{recommendations.map((item) => <li key={item} className="flex gap-2 text-sm"><ArrowRightIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />{item}</li>)}</ul>
            <Button className="mt-4" type="button" variant="outline" onClick={rerunOptimization}><RotateCwIcon aria-hidden /> Re-run Optimization</Button>
          </ReviewPanel>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border p-3 text-xs text-muted-foreground lg:col-span-2">
          Quality percentages below are the candidate&apos;s original mock assessment; they are not recalculated after edits. Current INVEST results and local criterion checks are evaluated separately against this draft.
        </div>
        <QualityEvaluation scores={candidate.assessment} />
        <INVESTChecklist criteria={investAssessment} />
        <AssumptionList assumptions={candidate.unsupportedAssumptions} />
      </div>
      <ReviewPanel title="Coverage and unresolved decisions" description="Review the prototype's coverage signals and explicitly record human decisions for applicable bank rules.">
        <p className="mb-3 text-sm"><strong>Coverage summary:</strong> {reviewFindings.find((finding) => finding.id === "coverage")?.details ?? "Coverage was not assessed."}</p>
        <label className="block space-y-1.5 text-sm font-medium" htmlFor="review-decision-notes">
          Human decision notes <span className="font-normal text-muted-foreground">(prototype field; records your disposition, not verified policy)</span>
          <Textarea id="review-decision-notes" value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} rows={3} placeholder="Record clarified business rules, or explain why flagged policy questions do not apply." />
        </label>
        <label className="mt-3 block space-y-1.5 text-sm font-medium" htmlFor="reviewer-name">
          Reviewer name <span className="font-normal text-muted-foreground">(prototype field; no authenticated identity is connected)</span>
          <Input id="reviewer-name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Enter reviewer name" />
        </label>
      </ReviewPanel>
      <Alert className="border-primary/25 bg-primary/5">
        <AlertTriangleIcon aria-hidden />
        <AlertTitle>Human review required</AlertTitle>
        <AlertDescription>Generated content and evaluation may be incomplete or wrong. This is a prototype review: reviewer identity and decisions are saved only in this browser, with no authenticated backend audit trail.</AlertDescription>
      </Alert>

      {!criteriaAreApprovalReady && !approved ? (
        <Alert variant="destructive">
          <AlertTitle>Approval is blocked</AlertTitle>
          <AlertDescription><ul className="list-disc space-y-1 pl-5">{(!reviewer.trim() ? ["Enter a reviewer name (prototype field)."] : []).concat(approvalBlockers).map((item) => <li key={item}>{item}</li>)}</ul></AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardFooter className="flex flex-wrap justify-end gap-2 py-4">
          <Button type="button" variant="outline" onClick={requestChanges} disabled={approved}>Request Changes</Button>
          <Button type="button" variant="outline" onClick={backToEditing} disabled={approved}><ArrowLeftIcon aria-hidden /> Back to Editing</Button>
          <Button type="button" variant="outline" onClick={saveDraft} disabled={approved}><SaveIcon aria-hidden /> Save Draft</Button>
          <Button type="button" variant="outline" onClick={() => setRegenerationOpen(true)} disabled={isRegenerating || approved}>
            {isRegenerating ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
            Regenerate
          </Button>
          <Button type="button" variant="destructive" onClick={() => setRejectionOpen(true)} disabled={approved}>Reject</Button>
          <Button type="button" onClick={() => setApprovalOpen(true)} disabled={approved || !criteriaAreApprovalReady}>
            <FileCheck2Icon aria-hidden /> {approved ? "Approved" : "Approve User Story & Acceptance Criteria"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Approved artifact package and sprint-planning handoff</CardTitle>
          <CardDescription>
            The approved package includes the requirement ID, user story, criteria, INVEST review, reviewer decision, and approval status. {project ? `Backlog target: ${project.name} (${project.id}).` : "No active project is selected."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-background p-4">
            <p className="text-xs font-semibold uppercase text-primary">Artifact package · {record.approvedPackage?.approvalStatus ?? "Not approved"}</p>
            <p className="mt-1 font-mono text-xs">{requirement.id}</p>
            <p className="mt-2 text-sm">{record.approvedPackage?.userStory ?? record.draft.userStory}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {(record.approvedPackage?.acceptanceCriteria ?? record.draft.acceptanceCriteria).map((criterion) => (
                <li key={criterion.id}>Given {criterion.given}; when {criterion.when}; then {criterion.then}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Prototype reviewer: {record.approvedPackage?.reviewer || "Not approved"} · approval time: {record.approvedPackage?.approvedAt || "Not approved"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Only available backlog fields are sent to the integration. No story points, dependencies, capacity, or sprint details are invented.</p>
          </div>
          {record.sprintIntegration ? (
            <Alert className={record.sprintIntegration.sprintId ? "border-success/30 bg-success/5" : "border-primary/25 bg-primary/5"}>
              <AlertTitle>{record.sprintIntegration.sprintId ? "Story added to sprint" : "Story added to backlog"}</AlertTitle>
              <AlertDescription>
                Story {record.sprintIntegration.storyId} was sent to project {record.sprintIntegration.projectId}.
                {record.sprintIntegration.sprintId ? <>{" "}<Link className="font-medium underline" href={`/sprints/${encodeURIComponent(record.sprintIntegration.sprintId)}`}>View sprint {record.sprintIntegration.sprintId}</Link></> : " No sprint was created because no sprint-planning details were supplied."}
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            onClick={() => void generateSprint()}
            disabled={!approved || importStories.isPending || !!record.sprintIntegration}
          >
            {importStories.isPending ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
            {record.sprintIntegration ? (record.sprintIntegration.sprintId ? "Sprint Generated" : "Added to Backlog") : importStories.isPending ? "Sending Approved Artifacts..." : "Approve & Generate Sprint"}
          </Button>
          {!approved ? <p className="text-xs text-muted-foreground">Approve the reviewed story above to enable sprint planning.</p> : null}
          {approved && !record.sprintIntegration ? <p className="text-xs text-muted-foreground">Without an active project this shows integration readiness only; no backend records or preview sprint are created.</p> : null}
        </CardContent>
      </Card>

      <ApprovalDialog open={approvalOpen} onOpenChange={setApprovalOpen} onConfirm={confirmApproval} isApproved={approved} disabled={!criteriaAreApprovalReady} />
      <AlertDialog open={rejectionOpen} onOpenChange={setRejectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this draft?</AlertDialogTitle>
            <AlertDialogDescription>This records a rejected decision in prototype browser history. The draft will not be approved or sent to the backlog.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={rejectDraft}>Reject draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={regenerationOpen} onOpenChange={setRegenerationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this draft?</AlertDialogTitle>
            <AlertDialogDescription>Regeneration replaces the current user story and acceptance criteria. Save a draft first if you need to preserve the current version.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setRegenerationOpen(false);
              void regenerate();
            }}>Regenerate draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}