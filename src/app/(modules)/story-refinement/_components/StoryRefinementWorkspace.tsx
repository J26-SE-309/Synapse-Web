"use client";

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  Clock3Icon,
  HistoryIcon,
  PencilIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  SparklesIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { startTransition, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { useProject } from "@/shared/projects/ProjectProvider";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

import { CandidateCard } from "./CandidateCard";
import { AcceptanceCriteriaEditor } from "./AcceptanceCriteriaComponents";
import { AssumptionList, INVESTChecklist, QualityEvaluation, RequirementCard, UserStoryCard } from "./StoryComponents";
import { WorkflowIndicator } from "./WorkflowComponents";
import {
  createDemoGeneration,
  draftFromCandidate,
  EMPTY_PROJECT_CONTEXT,
  evaluateInvestLocally,
  formatTimestamp,
  generateAcceptanceCriteria,
  generateCandidates,
  getServerGenerationHistory,
  MOCK_REQUIREMENTS,
  readGenerationHistory,
  saveGeneration,
  subscribeToGenerationHistory,
} from "../_lib/mock-service";
import type { AcceptanceCriterion, GenerationRecord, ProjectContext, StoryDraft, ValidatedRequirement } from "../_lib/types";

function updateCriterion(
  criteria: AcceptanceCriterion[],
  criterionId: string,
  field: keyof Omit<AcceptanceCriterion, "id">,
  value: string,
): AcceptanceCriterion[] {
  return criteria.map((criterion) => criterion.id === criterionId ? { ...criterion, [field]: value } : criterion);
}

export function StoryRefinementWorkspace({
  initialRequirementId,
  initialCandidateId,
  initialResumeId,
}: {
  initialRequirementId?: string;
  initialCandidateId?: string;
  initialResumeId?: string;
}) {
  const { projectId, project } = useProject();
  const router = useRouter();
  const initialRequirement = MOCK_REQUIREMENTS.find((item) => item.id === initialRequirementId) ?? MOCK_REQUIREMENTS[0];
  const [requirement, setRequirement] = useState<ValidatedRequirement>(initialRequirement);
  const [context, setContext] = useState<ProjectContext>({ ...EMPTY_PROJECT_CONTEXT, actor: initialRequirement.actor });
  const [preferredCandidateStoryId, setPreferredCandidateStoryId] = useState(initialCandidateId);
  const [generation, setGeneration] = useState<GenerationRecord>(() => {
    const demo = createDemoGeneration(initialRequirement);
    const selected = demo.candidates.find((candidate) => candidate.storyId === initialCandidateId);
    return selected ? { ...demo, selectedCandidateId: selected.id, draft: draftFromCandidate(selected) } : demo;
  });
  const [draft, setDraft] = useState<StoryDraft>(() => generation.draft);
  const history = useSyncExternalStore(subscribeToGenerationHistory, readGenerationHistory, getServerGenerationHistory);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [criteriaGenerated, setCriteriaGenerated] = useState(false);
  const [isGeneratingCriteria, setIsGeneratingCriteria] = useState(false);
  const [editingStory, setEditingStory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!initialResumeId) return;
    const resumed = readGenerationHistory().find((record) => record.id === initialResumeId);
    startTransition(() => {
      if (!resumed) {
        setError("The saved acceptance criteria could not be restored. Return to the generator and continue again.");
        return;
      }
      const resumedRequirement = MOCK_REQUIREMENTS.find((item) => item.id === resumed.requirementId);
      if (resumedRequirement) setRequirement(resumedRequirement);
      setGeneration(resumed);
      setDraft(resumed.draft);
      setPreferredCandidateStoryId(resumed.candidates.find((candidate) => candidate.id === resumed.selectedCandidateId)?.storyId);
      setContext(typeof resumed.context === "string"
        ? { ...EMPTY_PROJECT_CONTEXT, existingSystemContext: resumed.context }
        : { ...EMPTY_PROJECT_CONTEXT, ...resumed.context });
      setHasGenerated(true);
      setCriteriaGenerated(true);
      setNotice("Acceptance criteria restored from the generator. Review the story and criteria before approval.");
    });
  }, [initialResumeId]);

  const selectedCandidate = generation.candidates.find((candidate) => candidate.id === generation.selectedCandidateId) ?? generation.candidates[0];
  const approved = history.find((record) => record.id === generation.id && record.approvedAt) ?? (generation.approvedAt ? generation : null);

  async function runGeneration() {
    setError(null);
    setNotice(null);
    setIsGenerating(true);
    try {
      const generated = await generateCandidates({
        requirement,
        context: Object.fromEntries(Object.entries(context).map(([key, value]) => [key, value.trim()])) as ProjectContext,
        projectId,
      });
      const preferredCandidate = generated.candidates.find((candidate) => candidate.storyId === preferredCandidateStoryId);
      const nextGeneration = preferredCandidate
        ? { ...generated, selectedCandidateId: preferredCandidate.id, draft: draftFromCandidate(preferredCandidate) }
        : generated;
      saveGeneration(nextGeneration);
      setGeneration(nextGeneration);
      setDraft(nextGeneration.draft);
      setHasGenerated(true);
      setCriteriaGenerated(false);
      setEditingStory(false);
      setNotice("Three candidates generated and saved to browser history. Review the evidence before approval.");
    } catch {
      setError("The mock generation could not be completed. Your current draft is unchanged; try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function changeRequirement(id: string) {
    const nextRequirement = MOCK_REQUIREMENTS.find((item) => item.id === id);
    if (!nextRequirement) return;
    const demo = createDemoGeneration(nextRequirement);
    setRequirement(nextRequirement);
    setGeneration(demo);
    setDraft(demo.draft);
    setPreferredCandidateStoryId(undefined);
    setContext({ ...EMPTY_PROJECT_CONTEXT, actor: nextRequirement.actor });
    setHasGenerated(false);
    setCriteriaGenerated(false);
    setEditingStory(false);
    setError(null);
    setNotice("Example candidates are loaded. Generate to create a saved research run.");
  }

  function selectCandidate(candidateId: string) {
    const candidate = generation.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    setGeneration({ ...generation, selectedCandidateId: candidate.id, approvedAt: undefined, approvedDraft: undefined });
    setDraft(draftFromCandidate(candidate));
    setPreferredCandidateStoryId(candidate.storyId);
    setCriteriaGenerated(false);
    setEditingStory(false);
    setNotice(null);
  }

  function updateDraft(nextDraft: StoryDraft) {
    setDraft(nextDraft);
    if (approved) {
      setGeneration({ ...generation, approvedAt: undefined, approvedDraft: undefined });
      setNotice("Edits changed the approved version. Review and approve this revision to prepare it for integration.");
    }
  }

  function addCriterion() {
    const usedIds = new Set(draft.acceptanceCriteria.map((criterion) => criterion.id));
    let sequence = draft.acceptanceCriteria.length + 1;
    while (usedIds.has(`AC${sequence}`)) sequence += 1;
    updateDraft({
      ...draft,
      acceptanceCriteria: [...draft.acceptanceCriteria, { id: `AC${sequence}`, given: "", when: "", then: "" }],
    });
  }

  function removeCriterion(criterionId: string) {
    updateDraft({ ...draft, acceptanceCriteria: draft.acceptanceCriteria.filter((criterion) => criterion.id !== criterionId) });
  }

  function restoreGeneration(record: GenerationRecord) {
    const nextRequirement = MOCK_REQUIREMENTS.find((item) => item.id === record.requirementId);
    if (nextRequirement) setRequirement(nextRequirement);
    setGeneration(record);
    setDraft(record.approvedDraft ?? record.draft);
    setPreferredCandidateStoryId(record.candidates.find((candidate) => candidate.id === record.selectedCandidateId)?.storyId);
    setContext(typeof record.context === "string"
      ? { ...EMPTY_PROJECT_CONTEXT, existingSystemContext: record.context }
      : { ...EMPTY_PROJECT_CONTEXT, ...record.context });
    setHasGenerated(true);
    setCriteriaGenerated(true);
    setEditingStory(false);
    setNotice(record.approvedAt ? "Approved version restored from local history." : "Generation restored from local history; review it before approval.");
    setError(null);
  }

  async function runAcceptanceCriteriaGeneration() {
    if (!selectedCandidate) return;
    setError(null);
    setIsGeneratingCriteria(true);
    try {
      const criteria = await generateAcceptanceCriteria(selectedCandidate);
      updateDraft({ ...draft, acceptanceCriteria: criteria });
      setCriteriaGenerated(true);
      document.getElementById("criteria")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError("Acceptance criteria could not be generated. Your current draft is unchanged; try again.");
    } finally {
      setIsGeneratingCriteria(false);
    }
  }

  function openHumanReview() {
    if (!selectedCandidate || !criteriaGenerated) return;
    try {
      const reviewRecord: GenerationRecord = {
        ...generation,
        requirementId: requirement.id,
        requirementText: requirement.text,
        context,
        projectId,
        selectedCandidateId: selectedCandidate.id,
        draft,
        status: "Draft",
        approvedAt: undefined,
        approvedDraft: undefined,
      };
      saveGeneration(reviewRecord);
      router.push(`/story-refinement/review?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(selectedCandidate.storyId)}&resumeId=${encodeURIComponent(reviewRecord.id)}`);
    } catch {
      setError("The review draft could not be saved on this device. Your edits are still visible; try again.");
    }
  }

  return (
    <PageContainer id="dashboard">
      <PageHeader
        title="User story refinement"
        description="Research workspace for turning Component 1 validated requirements into human-reviewed Agile stories."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/story-refinement/requirements">Validated requirements</Link>
            </Button>
            <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs font-medium">
              <span className="size-2 rounded-full bg-warning" aria-hidden />
              Mock research mode
            </span>
            <span className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
              {project ? `${project.name} · ${project.id}` : "No project selected"}
            </span>
          </div>
        }
      />

      <WorkflowIndicator currentStep={hasGenerated ? "Story generation" : "Validated requirement"} />

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangleIcon aria-hidden />
          <AlertTitle>Action needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert className="border-primary/25 bg-primary/5">
          <SparklesIcon aria-hidden />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <section id="requirements" aria-labelledby="requirement-heading" className="scroll-mt-4">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <RequirementCard requirement={requirement} headingId="requirement-heading" />
            <p className="text-xs text-muted-foreground">Component 1 already checks requirement quality; ambiguity analysis is not repeated here.</p>
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
                <label htmlFor="requirement-select" className="text-xs font-medium text-muted-foreground">Sample input</label>
                <select
                  id="requirement-select"
                  value={requirement.id}
                  onChange={(event) => changeRequirement(event.target.value)}
                  className="h-8 min-w-48 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {MOCK_REQUIREMENTS.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}
                </select>
                <Link href="/story-refinement/requirements" className="ml-auto text-xs font-medium text-primary hover:underline">Validated requirements</Link>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                <span className="font-mono">02</span> Project Context
              </div>
              <CardTitle className="text-lg">Add useful context</CardTitle>
              <CardDescription>All fields are optional. Context guides story generation; it does not replace the validated requirement.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void runGeneration(); }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="context-actor" className="text-xs font-medium">User / Actor</label>
                    <Input id="context-actor" value={context.actor} onChange={(event) => setContext({ ...context, actor: event.target.value })} placeholder="e.g. Student" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="context-feature" className="text-xs font-medium">Feature / Module</label>
                    <Input id="context-feature" value={context.featureModule} onChange={(event) => setContext({ ...context, featureModule: event.target.value })} placeholder="e.g. Session booking" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="context-goal" className="text-xs font-medium">Business Goal</label>
                    <Input id="context-goal" value={context.businessGoal} onChange={(event) => setContext({ ...context, businessGoal: event.target.value })} placeholder="What outcome should this support?" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="context-related" className="text-xs font-medium">Related Requirements</label>
                    <Input id="context-related" value={context.relatedRequirements} onChange={(event) => setContext({ ...context, relatedRequirements: event.target.value })} placeholder="Requirement IDs or dependencies" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="context-existing" className="text-xs font-medium">Existing System Context</label>
                    <Textarea id="context-existing" value={context.existingSystemContext} onChange={(event) => setContext({ ...context, existingSystemContext: event.target.value })} placeholder="Relevant workflows, roles, or system behavior" rows={2} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="context-constraints" className="text-xs font-medium">Additional Constraints</label>
                    <Textarea id="context-constraints" value={context.additionalConstraints} onChange={(event) => setContext({ ...context, additionalConstraints: event.target.value })} placeholder="Policy, platform, timing, or accessibility constraints" rows={2} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">{project ? `Project: ${project.name}` : "Project selection is optional"}</p>
                  {!hasGenerated ? (
                    <Button type="submit" disabled={isGenerating}>
                      {isGenerating ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <SparklesIcon aria-hidden />}
                      Generate User Story
                    </Button>
                  ) : <p className="text-xs text-muted-foreground">Update context, then use Regenerate on the result.</p>}
                </div>
                {isGenerating ? <p role="status" aria-live="polite" className="text-sm font-medium text-primary">Analyzing context and generating user story...</p> : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {hasGenerated ? (
        <section id="generated-story" aria-labelledby="generated-story-heading" className="scroll-mt-4">
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-primary">03 · Generated draft · {selectedCandidate.storyId}</p>
                  <CardTitle id="generated-story-heading" className="mt-1 text-lg">User Story</CardTitle>
                  <CardDescription>Mock-generated suggestion. Review and edit before using or approving it.</CardDescription>
                </div>
                <span className="rounded-sm border bg-muted px-2.5 py-1.5 text-xs font-medium">Human review required</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingStory ? (
                <div className="space-y-2">
                  <label htmlFor="generated-story-edit" className="text-sm font-medium">Edit generated user story</label>
                  <Textarea id="generated-story-edit" value={draft.userStory} onChange={(event) => updateDraft({ ...draft, userStory: event.target.value })} rows={3} className="min-h-24 resize-y text-base leading-relaxed" />
                </div>
              ) : (
                <UserStoryCard story={{ storyId: selectedCandidate.storyId, requirementId: requirement.id, text: draft.userStory }} title="Generated User Story" />
              )}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => void runGeneration()} disabled={isGenerating}>
                  {isGenerating ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
                  {isGenerating ? "Analyzing context and generating user story..." : "Regenerate"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingStory(!editingStory)}>
                  <PencilIcon aria-hidden /> {editingStory ? "Done editing" : "Edit"}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href={`/story-refinement/candidates?requirementId=${encodeURIComponent(requirement.id)}`}>Compare Candidates</Link>
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href={`/story-refinement/evaluation?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(selectedCandidate.storyId)}`}>Evaluate Quality</Link>
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href={`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(selectedCandidate.storyId)}`}>Open Criteria Generator</Link>
                </Button>
                <Button type="button" onClick={() => void runAcceptanceCriteriaGeneration()} disabled={isGeneratingCriteria}>
                  {isGeneratingCriteria ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <SparklesIcon aria-hidden />}
                  {isGeneratingCriteria ? "Generating acceptance criteria..." : "Generate Acceptance Criteria"}
                </Button>
              </div>
              {isGenerating ? <p role="status" aria-live="polite" className="text-sm font-medium text-primary">Analyzing context and generating user story...</p> : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {hasGenerated ? (
        <section id="generation" aria-labelledby="generation-heading" className="scroll-mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">04 · Candidate comparison</p>
            <h2 id="generation-heading" className="mt-1 text-lg font-semibold">Compare candidate stories</h2>
            <p className="text-sm text-muted-foreground">Candidates are mock AI output for research prototyping, not verified requirements.</p>
          </div>
          <div className="grid items-stretch gap-3 md:grid-cols-3">
            {generation.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                selected={candidate.id === generation.selectedCandidateId}
                onSelect={() => selectCandidate(candidate.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {hasGenerated ? (
        <section id="evaluation" aria-labelledby="evaluation-heading" className="scroll-mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">03 · Candidate evaluation</p>
          <h2 id="evaluation-heading" className="mt-1 text-lg font-semibold">Why this candidate scored this way</h2>
          <p className="text-sm text-muted-foreground">Scores are evidence prompts for human review, not a guarantee of correctness.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <QualityEvaluation scores={selectedCandidate.assessment} />
          <INVESTChecklist criteria={evaluateInvestLocally(draft.userStory, draft.acceptanceCriteria)} />
          <AssumptionList assumptions={selectedCandidate.unsupportedAssumptions} />
        </div>
        </section>
      ) : null}

      {hasGenerated && criteriaGenerated ? (
        <section id="criteria" aria-labelledby="criteria-heading" className="scroll-mt-4">
        <AcceptanceCriteriaEditor
          criteria={draft.acceptanceCriteria}
          onChange={(criterionId, field, value) => updateDraft({ ...draft, acceptanceCriteria: updateCriterion(draft.acceptanceCriteria, criterionId, field, value) })}
          onAdd={addCriterion}
          onDelete={removeCriterion}
        />
        </section>
      ) : null}

      {hasGenerated && criteriaGenerated ? (
        <section id="review" aria-labelledby="review-heading" className="scroll-mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">05 · Human review & approval</p>
          <p className="text-sm text-muted-foreground">AI suggestions are not automatically correct. Edit the story and criteria before approval.</p>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserRoundCheckIcon aria-hidden className="size-4 text-primary" /> Human-edited draft</CardTitle>
              <CardDescription>Edit the story here; acceptance criteria can be edited in the section above.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label htmlFor="draft-user-story" className="text-sm font-medium">User story</label>
              <Textarea
                id="draft-user-story"
                value={draft.userStory}
                onChange={(event) => updateDraft({ ...draft, userStory: event.target.value })}
                rows={4}
                className="min-h-28 resize-y leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">Selected candidate: {selectedCandidate.storyId} · {selectedCandidate.label}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Continue to human review</CardTitle>
              <CardDescription>Review the validated source, selected story, acceptance criteria, and INVEST assessment on the approval page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {draft.acceptanceCriteria.length} acceptance {draft.acceptanceCriteria.length === 1 ? "criterion" : "criteria"} selected for {selectedCandidate.storyId}.
              </p>
              <Button type="button" onClick={openHumanReview} disabled={!draft.userStory.trim() || !draft.acceptanceCriteria.length} className="w-full">
                <UserRoundCheckIcon aria-hidden /> Human Review & Approval
              </Button>
              <p className="text-xs text-muted-foreground">Approval is recorded only on the review page after an explicit human confirmation.</p>
            </CardContent>
          </Card>
        </div>
        </section>
      ) : null}

      <section id="history" aria-labelledby="history-heading" className="scroll-mt-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">06 · Generation history</p>
            <h2 id="history-heading" className="mt-1 text-lg font-semibold">Research runs on this device</h2>
            <p className="text-sm text-muted-foreground">Mock generations and approved versions are stored in this browser only.</p>
          </div>
          {history.length ? <span className="text-xs tabular-nums text-muted-foreground">{history.length} saved</span> : null}
        </div>
        {history.length ? (
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {history.map((record) => (
                <li key={record.id} className="flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    {record.status === "Approved" || record.approvedAt
                      ? <BadgeCheckIcon aria-hidden className="size-4 text-success" />
                      : record.status === "Rejected"
                        ? <AlertTriangleIcon aria-hidden className="size-4 text-danger" />
                        : <HistoryIcon aria-hidden className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{record.requirementId} · {record.requirementText}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock3Icon aria-hidden className="size-3" />{formatTimestamp(record.createdAt)}</span>
                      <span>{record.candidates.length} candidates</span>
                      <span className={record.status === "Approved" || record.approvedAt ? "font-medium text-success" : record.status === "Rejected" ? "font-medium text-danger" : "text-warning"}>
                        {record.status ?? (record.approvedAt ? "Approved" : "Awaiting approval")}
                      </span>
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => restoreGeneration(record)}>
                    <RotateCwIcon aria-hidden /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/15 px-5 py-8 text-center">
            <HistoryIcon aria-hidden className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No saved runs yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Regenerate candidates to save a run to this browser&apos;s local history.</p>
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>Research prototype · Mock generation service · No live LLM connection</span>
        <a href="#dashboard" className="inline-flex items-center gap-1 hover:text-foreground">Back to top <ArrowRightIcon aria-hidden className="size-3 -rotate-90" /></a>
      </footer>
    </PageContainer>
  );
}