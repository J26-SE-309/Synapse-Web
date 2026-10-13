"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { useProject } from "@/shared/projects/ProjectProvider";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";

import { AcceptanceCriteriaEditor } from "./AcceptanceCriteriaComponents";
import { GenerationProgress, WorkflowIndicator } from "./WorkflowComponents";
import { StatusBadge } from "./StoryComponents";
import {
  createDemoGeneration,
  createMockAcceptanceCriteria,
  EMPTY_PROJECT_CONTEXT,
  generateMockAcceptanceCriteria,
  MOCK_REQUIREMENTS,
  optimizeAcceptanceCriteriaLocally,
  readGenerationHistory,
  saveGeneration,
} from "../_lib/mock-service";
import type { AcceptanceCriterion, GenerationRecord, LocalOptimizationResult, ProjectContext, StoryCandidate, ValidatedRequirement } from "../_lib/types";

function findStory(requirement: ValidatedRequirement, storyId?: string): StoryCandidate {
  const candidates = createDemoGeneration(requirement).candidates;
  return candidates.find((candidate) => candidate.storyId === storyId) ?? candidates[0];
}

function reviewUrl(requirementId: string, candidateId: string, resumeId: string): string {
  return `/story-refinement/review?requirementId=${encodeURIComponent(requirementId)}&candidateId=${encodeURIComponent(candidateId)}&resumeId=${encodeURIComponent(resumeId)}`;
}

export function AcceptanceCriteriaGeneratorView({
  initialRequirementId,
  initialCandidateId,
  initialResumeId,
}: {
  initialRequirementId?: string;
  initialCandidateId?: string;
  initialResumeId?: string;
}) {
  const router = useRouter();
  const { project } = useProject();
  const requirement = MOCK_REQUIREMENTS.find((item) => item.id === initialRequirementId) ?? MOCK_REQUIREMENTS[0];
  const story = findStory(requirement, initialCandidateId);
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(() => createMockAcceptanceCriteria(requirement));
  const [optimization, setOptimization] = useState<LocalOptimizationResult | null>(null);
  const [userFeedback, setUserFeedback] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingId, setIsRegeneratingId] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext>({ actor: "", featureModule: "", businessGoal: "", relatedRequirements: "", existingSystemContext: "", additionalConstraints: "" });

  useEffect(() => {
    const history = readGenerationHistory();
    const resumed = initialResumeId
      ? history.find((record) => record.id === initialResumeId)
      : history.find((record) => record.requirementId === requirement.id
        && record.candidates.some((candidate) => candidate.storyId === story.storyId));
    startTransition(() => {
      if (initialResumeId && !resumed) {
        setError("The saved criteria could not be restored from local history.");
        return;
      }
      if (resumed) {
        setProjectContext(typeof resumed.context === "string"
          ? { ...EMPTY_PROJECT_CONTEXT, existingSystemContext: resumed.context }
          : { ...EMPTY_PROJECT_CONTEXT, ...resumed.context });
        if (initialResumeId) {
          setCriteria(resumed.draft.acceptanceCriteria.map((criterion) => ({ ...criterion })));
          setMessage("Acceptance criteria restored from this saved generation.");
        }
      }
    });
  }, [initialResumeId, requirement.id, story.storyId]);

  function updateCriterion(criterionId: string, field: keyof Omit<AcceptanceCriterion, "id">, value: string) {
    setCriteria((current) => current.map((criterion) => criterion.id === criterionId ? { ...criterion, [field]: value, status: "Draft" } : criterion));
    setOptimization(null);
    setMessage(null);
  }

  function addCriterion() {
    const used = new Set(criteria.map((criterion) => criterion.id));
    let sequence = 1;
    while (used.has(`AC${sequence}`)) sequence += 1;
    setCriteria([...criteria, {
      id: `AC${sequence}`,
      title: "",
      given: "",
      when: "",
      then: "",
      status: "Draft",
      priority: "Medium",
      category: "Functional",
    }]);
    setOptimization(null);
    setMessage(null);
  }

  function deleteCriterion(criterionId: string) {
    setCriteria((current) => current.filter((criterion) => criterion.id !== criterionId));
    setOptimization(null);
    setMessage(null);
  }

  function saveCriterion(criterionId: string) {
    setCriteria((current) => current.map((criterion) => criterion.id === criterionId
      ? { ...criterion, status: "Human Verified" }
      : criterion));
    setMessage(`${criterionId} saved and marked Human Verified.`);
  }

  async function regenerateCriterion(criterionId: string) {
    const index = criteria.findIndex((criterion) => criterion.id === criterionId);
    if (index < 0) return;
    setIsRegeneratingId(criterionId);
    setError(null);
    try {
      const regenerated = await generateMockAcceptanceCriteria(requirement);
      const replacement = regenerated[index];
      if (!replacement) {
        setError(`${criterionId} could not be regenerated because there is no distinct requirement scenario for it. Add a criterion manually or regenerate the full set.`);
        return;
      }
      setCriteria((current) => current.map((criterion) => criterion.id === criterionId
        ? { ...replacement, id: criterionId, status: "Optimized" }
        : criterion));
      setOptimization(null);
      setMessage(`${criterionId} regenerated from the selected requirement.`);
    } catch {
      setError(`${criterionId} could not be regenerated. Its current text is unchanged; try again.`);
    } finally {
      setIsRegeneratingId(null);
    }
  }

  async function generate() {
    setIsGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const generated = await generateMockAcceptanceCriteria(requirement);
      setCriteria(generated);
      setOptimization(null);
      setMessage("Requirement-specific draft criteria generated. Review every criterion and any policy decision flags.");
    } catch {
      setError("Criteria could not be generated. Your current edits are unchanged; try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function optimize() {
    setError(null);
    setMessage(null);
    try {
      const result = optimizeAcceptanceCriteriaLocally(requirement, projectContext, criteria, userFeedback);
      setOptimization(result);
      setCriteria(result.optimizedCriteria);
      setMessage("Prototype checks completed. Review each finding and compare the original and optimized criteria; no automated quality score or semantic validation was performed.");
    } catch (optimizationError) {
      setError(optimizationError instanceof Error
        ? `Local optimization could not be completed: ${optimizationError.message}`
        : "Local optimization could not be completed. Your current criteria are unchanged.");
    }
  }

  function continueToReview() {
    if (!criteria.length) {
      setError("Add at least one acceptance criterion before continuing to review.");
      return;
    }
    setIsContinuing(true);
    const base = createDemoGeneration(requirement);
    const selected = base.candidates.find((candidate) => candidate.storyId === story.storyId) ?? base.candidates[0];
    const updatedCandidate = { ...selected, acceptanceCriteria: criteria.map((criterion) => ({ ...criterion })) };
    const candidates = base.candidates.map((candidate) => candidate.storyId === updatedCandidate.storyId ? updatedCandidate : candidate);
    const generationId = `criteria-${Date.now()}`;
    const record: GenerationRecord = {
      ...base,
      id: generationId,
      candidates,
      selectedCandidateId: updatedCandidate.id,
      draft: { userStory: story.userStory, acceptanceCriteria: updatedCandidate.acceptanceCriteria },
      context: projectContext,
    };
    saveGeneration(record);
    router.push(reviewUrl(requirement.id, story.storyId, generationId));
  }

  return (
    <PageContainer>
      <PageHeader
        title="Acceptance Criteria Generator"
        description="Generate detailed, independent, testable Given–When–Then outcomes for the selected user story."
        actions={
          <Button asChild variant="outline">
            <Link href={`/story-refinement/evaluation?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(story.storyId)}`}><ArrowLeftIcon aria-hidden /> Quality evaluation</Link>
          </Button>
        }
      />

      <WorkflowIndicator currentStep="Acceptance criteria" />
      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{requirement.id} · {story.storyId}</p>
              <CardTitle className="mt-1 text-base">Selected User Story</CardTitle>
            </div>
            <span className="rounded-sm border bg-muted px-2.5 py-1.5 text-xs font-medium">{story.label}</span>
          </div>
        </CardHeader>
        <CardContent>
          <blockquote className="border-l-2 border-primary pl-4 text-sm font-medium leading-relaxed">{story.userStory}</blockquote>
          <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-muted-foreground">Requirement ID</dt><dd className="font-mono">{requirement.id}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Validation status</dt><dd>{requirement.validationStatus}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Requirement description</dt><dd className="mt-1">{requirement.text}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Requirement quality score</dt><dd>{requirement.qualityScore === undefined ? "Not supplied" : `${Math.round(requirement.qualityScore * 100)}%`}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Project / domain context</dt><dd>{project ? `${project.name} (${project.id})` : "No project selected"} · {requirement.source}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Feature / domain</dt><dd>{projectContext.featureModule || (requirement.id === "REQ-BANK-001" ? "Banking and money transfers" : "Tutoring and session management")}</dd></div>
              {projectContext.relatedRequirements ? <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Related requirements</dt><dd>{projectContext.relatedRequirements}</dd></div> : null}
              {projectContext.businessGoal ? <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Business goal</dt><dd>{projectContext.businessGoal}</dd></div> : null}
              {projectContext.existingSystemContext ? <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Existing system context</dt><dd>{projectContext.existingSystemContext}</dd></div> : null}
              {projectContext.additionalConstraints ? <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Project constraints</dt><dd>{projectContext.additionalConstraints}</dd></div> : null}
          </dl>
          <label className="mt-4 block max-w-md space-y-1.5 text-xs font-medium">
            Select validated requirement
            <select
              aria-label="Select validated requirement"
              value={requirement.id}
              onChange={(event) => {
                const next = MOCK_REQUIREMENTS.find((item) => item.id === event.target.value);
                if (next) router.push(`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(next.id)}&candidateId=${encodeURIComponent(`${next.id}-S1`)}`);
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {MOCK_REQUIREMENTS.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      <section aria-labelledby="criteria-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Given · When · Then</p>
            <h2 id="criteria-heading" className="mt-1 text-lg font-semibold">Generated Acceptance Criteria</h2>
            <p className="text-sm text-muted-foreground">Edit the outcomes to match the validated requirement and agreed scope.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void generate()} disabled={isGenerating}>
              {isGenerating ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <SparklesIcon aria-hidden />}
              {isGenerating ? "Generating…" : "Generate Acceptance Criteria"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void generate()} disabled={isGenerating}>
              <RotateCwIcon aria-hidden /> Regenerate
            </Button>
          </div>
        </div>

        {isGenerating ? <GenerationProgress label="Generating acceptance criteria from the selected story…" rows={1} /> : null}
        {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="rounded-md border border-success/30 bg-success-soft p-3 text-sm text-success">{message}</p> : null}

        <AcceptanceCriteriaEditor
          criteria={criteria}
          onChange={updateCriterion}
          onAdd={addCriterion}
          onDelete={deleteCriterion}
          showActions
          onSave={saveCriterion}
          onRegenerate={(criterionId) => void regenerateCriterion(criterionId)}
          isRegeneratingId={isRegeneratingId}
        />
      </section>

      <section aria-labelledby="local-optimization-heading" className="space-y-4">
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle id="local-optimization-heading">Local Optimization</CardTitle>
                <CardDescription>Prototype simulation · deterministic local checks only. No local LLM, semantic engine, external service, or automated quality score is running.</CardDescription>
              </div>
              <span className="rounded-sm border bg-warning/10 px-2 py-1 text-xs font-medium text-warning">Human review required</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                "Context Analysis · roles, stated rules, constraints, related requirements, and domain risks",
                "Coverage Analysis · behaviours stated by the selected requirement",
                "Quality Analysis · completeness, clarity, consistency, specificity, and testability signals",
                "Security and Validation · relevant authentication, authorization, input, integrity, error, and data-protection coverage",
                "Duplicate Detection · exact normalized Given–When–Then duplicates; partial overlap remains a human check",
                "Unsupported-Assumption Detection · unapproved context or policy details requiring a decision",
                "Local Optimization · safe whitespace cleanup and exact duplicate removal only",
                "Comparison · original and optimized criteria with the reason for each change",
              ].map((step, index) => <li key={step} className="rounded-md border bg-muted/20 p-3"><span className="mr-2 font-mono text-primary">{index + 1}.</span>{step}</li>)}
            </ol>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="optimization-feedback">
              Reviewer feedback for this optimization
              <Textarea
                id="optimization-feedback"
                value={userFeedback}
                onChange={(event) => {
                  setUserFeedback(event.target.value);
                  setOptimization(null);
                }}
                placeholder="Optional feedback to consider; the prototype will flag it for human assessment and will not treat it as approved policy."
                rows={2}
              />
            </label>
            <Button type="button" onClick={optimize} disabled={!criteria.length}>
              <SparklesIcon aria-hidden /> Optimize Acceptance Criteria
            </Button>
            {optimization ? (
              <div className="space-y-4" aria-live="polite">
                <div>
                  <h3 className="font-semibold">Analysis findings</h3>
                  <ul className="mt-2 space-y-2">
                    {optimization.findings.map((finding) => (
                      <li key={finding.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{finding.area}: {finding.summary}</p>
                          <StatusBadge status={finding.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{finding.details}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold">Original and optimized comparison</h3>
                  {optimization.changes.length ? (
                    <ul className="mt-2 space-y-3">
                      {optimization.changes.map((change) => (
                        <li key={change.criterionId} className="rounded-md border p-3">
                          <p className="text-sm font-medium">{change.criterionId} · {change.explanation}</p>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div className="rounded bg-muted/30 p-3 text-sm">
                              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Original</p>
                              <p><strong>{change.original.title || "Untitled criterion"}</strong></p>
                              <p>Given: {change.original.given}</p><p>When: {change.original.when}</p><p>Then: {change.original.then}</p>
                            </div>
                            <div className="rounded bg-primary/5 p-3 text-sm">
                              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Optimized</p>
                              {change.optimized ? (
                                <><p><strong>{change.optimized.title || "Untitled criterion"}</strong></p>
                                  <p>Given: {change.optimized.given}</p><p>When: {change.optimized.when}</p><p>Then: {change.optimized.then}</p></>
                              ) : <p>Removed as an exact duplicate; the earlier criterion is retained.</p>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 rounded-md border p-3 text-sm text-muted-foreground">No wording or duplicate changes were necessary. The full criterion set remains unchanged.</p>}
                  <details className="mt-3 rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Show complete original and optimized sets</summary>
                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      {[["Original", optimization.originalCriteria], ["Optimized", optimization.optimizedCriteria]].map(([label, items]) => (
                        <div key={label as string} className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground">{label as string}</h4>
                          {(items as AcceptanceCriterion[]).map((criterion) => (
                            <div key={criterion.id} className="rounded border p-3 text-sm">
                              <p className="font-medium">{criterion.id} · {criterion.title}</p>
                              <p>Given: {criterion.given}</p><p>When: {criterion.when}</p><p>Then: {criterion.then}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground">Run the prototype checks to see findings and a before/after comparison. Findings do not certify correctness.</p>}
          </CardContent>
        </Card>
      </section>

      <Card className="border-primary/20 bg-primary/5">
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-xs text-muted-foreground">Criteria and edits are mock data until saved for review.</p>
          <Button type="button" onClick={continueToReview} disabled={isContinuing || !criteria.length}>
            {isContinuing ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
            Continue to Review <ArrowRightIcon aria-hidden />
          </Button>
        </CardFooter>
      </Card>
    </PageContainer>
  );
}