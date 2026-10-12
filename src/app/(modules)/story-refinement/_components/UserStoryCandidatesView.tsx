"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LoaderCircleIcon, PencilIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";

import { AssumptionList, QualityEvaluation, QualityScore, StatusBadge, UserStoryCard } from "./StoryComponents";
import { GenerationProgress, WorkflowIndicator } from "./WorkflowComponents";
import { createDemoGeneration, EMPTY_PROJECT_CONTEXT, generateCandidates, MOCK_REQUIREMENTS } from "../_lib/mock-service";
import type { StoryCandidate, ValidatedRequirement } from "../_lib/types";

function overallScore(candidate: StoryCandidate): number {
  return candidate.assessment.reduce((total, item) => total + item.score, 0) / candidate.assessment.length;
}

function candidateRefinementUrl(requirementId: string, candidateId: string): string {
  return `/story-refinement?requirementId=${encodeURIComponent(requirementId)}&candidateId=${encodeURIComponent(candidateId)}`;
}

function candidateEvaluationUrl(requirementId: string, candidateId: string): string {
  return `/story-refinement/evaluation?requirementId=${encodeURIComponent(requirementId)}&candidateId=${encodeURIComponent(candidateId)}`;
}

function candidateCriteriaUrl(requirementId: string, candidateId: string): string {
  return `/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirementId)}&candidateId=${encodeURIComponent(candidateId)}`;
}

export function UserStoryCandidatesView({ initialRequirementId }: { initialRequirementId?: string }) {
  const initialRequirement = MOCK_REQUIREMENTS.find((item) => item.id === initialRequirementId) ?? MOCK_REQUIREMENTS[0];
  const [requirement, setRequirement] = useState<ValidatedRequirement>(initialRequirement);
  const [candidates, setCandidates] = useState<StoryCandidate[]>(() => createDemoGeneration(initialRequirement).candidates);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editedStories, setEditedStories] = useState<Record<string, string>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ranked = [...candidates].sort((left, right) => overallScore(right) - overallScore(left));
  const recommendedId = ranked[0]?.id;

  async function regenerate(candidateIndex?: number) {
    setIsRegenerating(true);
    setError(null);
    setNotice(null);
    try {
      const record = await generateCandidates({
        requirement,
        context: { ...EMPTY_PROJECT_CONTEXT, actor: requirement.actor },
        projectId: null,
      });
      setCandidates(candidateIndex === undefined
        ? record.candidates
        : candidates.map((candidate, index) => index === candidateIndex ? record.candidates[index] : candidate));
      setEditingCandidateId(null);
      if (candidateIndex === undefined) setEditedStories({});
      else setEditedStories((current) => {
        const next = { ...current };
        delete next[candidates[candidateIndex]?.id];
        return next;
      });
      setNotice(candidateIndex === undefined
        ? "Three mock candidates regenerated. Review their scores and assumptions before selecting one."
        : `Candidate ${candidateIndex + 1} regenerated. Review its scores and assumptions before selecting it.`);
    } catch {
      setError("Candidates could not be regenerated. The current comparison is unchanged; try again.");
    } finally {
      setIsRegenerating(false);
    }
  }

  function updateRequirement(id: string) {
    const selected = MOCK_REQUIREMENTS.find((item) => item.id === id);
    if (!selected) return;
    setRequirement(selected);
    setCandidates(createDemoGeneration(selected).candidates);
    setEditingCandidateId(null);
    setEditedStories({});
    setError(null);
    setNotice(null);
  }

  function editStory(candidate: StoryCandidate, value: string) {
    setEditedStories({ ...editedStories, [candidate.id]: value });
  }

  return (
    <PageContainer>
      <PageHeader
        title="User Story Candidates"
        description="Compare mock story alternatives for the same validated requirement before choosing one for human review."
        actions={
          <Button asChild variant="outline">
            <Link href={`/story-refinement?requirementId=${encodeURIComponent(requirement.id)}`}><ArrowLeftIcon aria-hidden /> Back to refinement</Link>
          </Button>
        }
      />

      <WorkflowIndicator currentStep="Story generation" />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Validated requirement · {requirement.id}</p>
              <CardTitle className="mt-1 text-base">Source requirement</CardTitle>
              <CardDescription className="mt-2 max-w-4xl text-sm leading-relaxed text-foreground">{requirement.text}</CardDescription>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="candidate-requirement" className="text-xs font-medium text-muted-foreground">Compare requirement</label>
              <select
                id="candidate-requirement"
                value={requirement.id}
                onChange={(event) => updateRequirement(event.target.value)}
                className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MOCK_REQUIREMENTS.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-sm border bg-warning/10 px-2.5 py-1.5 font-medium text-warning">Mock AI output</span>
          <span>Scores describe the generated text and are not proof of correctness.</span>
        </div>
        <Button type="button" variant="outline" onClick={() => void regenerate()} disabled={isRegenerating}>
          {isRegenerating ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
          {isRegenerating ? "Regenerating candidates…" : "Regenerate all candidates"}
        </Button>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      ) : null}
      {notice ? <p role="status" className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">{notice}</p> : null}

      {isRegenerating ? (
        <GenerationProgress label="Regenerating story candidates…" rows={3} />
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {candidates.map((candidate, index) => {
            const score = overallScore(candidate);
            const recommended = candidate.id === recommendedId;
            const isEditing = editingCandidateId === candidate.id;
            const story = editedStories[candidate.id] ?? candidate.userStory;
            return (
              <Card key={candidate.id} className={`flex flex-col ${recommended ? "border-primary ring-1 ring-primary/35" : ""}`}>
                <CardHeader className="border-b bg-muted/15">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{candidate.storyId}</p>
                      <CardTitle className="mt-1 text-base">Candidate {index + 1}</CardTitle>
                      <CardDescription className="mt-1">{candidate.label}</CardDescription>
                    </div>
                    {recommended ? <StatusBadge status="Recommended" /> : null}
                  </div>
                  <QualityScore label="Overall Quality Score" score={score / 100} overall />
                </CardHeader>

                <CardContent className="flex-1 space-y-4 pt-4">
                  <section aria-label={`Candidate ${index + 1} user story`} className="space-y-2">
                    {isEditing ? (
                      <Textarea
                        aria-label={`Edit Candidate ${index + 1} story`}
                        value={story}
                        onChange={(event) => editStory(candidate, event.target.value)}
                        rows={5}
                        className="min-h-32 resize-y text-sm leading-relaxed"
                      />
                    ) : <UserStoryCard story={{ storyId: candidate.storyId, requirementId: requirement.id, text: story }} title="Generated User Story" />}
                    {editedStories[candidate.id] ? <p className="text-xs text-muted-foreground">Edited locally; generated quality scores remain unchanged.</p> : null}
                  </section>

                  <div className="border-t pt-4"><QualityEvaluation scores={candidate.assessment} /></div>
                  <div className="border-t pt-4"><AssumptionList assumptions={candidate.unsupportedAssumptions} /></div>
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={candidateRefinementUrl(requirement.id, candidate.storyId)}>
                      <CheckIcon aria-hidden /> Select Candidate
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCandidateId(isEditing ? null : candidate.id)}
                  >
                    <PencilIcon aria-hidden /> {isEditing ? "Save Edit" : "Edit"}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Regenerate Candidate ${index + 1}`} title={`Regenerate Candidate ${index + 1}`} onClick={() => void regenerate(index)} disabled={isRegenerating}>
                    <RotateCwIcon aria-hidden />
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={candidateEvaluationUrl(requirement.id, candidate.storyId)}>Evaluate Quality</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={candidateCriteriaUrl(requirement.id, candidate.storyId)}>Generate Acceptance Criteria</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
        <p className="text-sm font-medium">Recommended because this candidate has the highest overall quality score and fewer unsupported assumptions.</p>
        <p className="mt-1 text-xs text-muted-foreground">The recommendation is based on the current mock assessment; review the evidence and edit the selected story before approval.</p>
      </div>

      <div className="flex justify-start border-t pt-4">
        <Button asChild variant="link" className="px-0">
          <Link href={`/story-refinement?requirementId=${encodeURIComponent(requirement.id)}`}><ArrowLeftIcon aria-hidden /> Return to refinement</Link>
        </Button>
        <ArrowRightIcon aria-hidden className="sr-only" />
      </div>
    </PageContainer>
  );
}