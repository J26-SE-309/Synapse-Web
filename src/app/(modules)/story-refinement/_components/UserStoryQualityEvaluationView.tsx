"use client";

import { ArrowLeftIcon, ArrowRightIcon, LightbulbIcon, UserRoundCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { Textarea } from "@/shared/ui/textarea";

import { AssumptionList, INVESTChecklist, QualityEvaluation, UserStoryCard } from "./StoryComponents";
import { WorkflowIndicator } from "./WorkflowComponents";
import { createDemoGeneration, evaluateInvestLocally, getMockImprovementRecommendations, MOCK_REQUIREMENTS, optimizeUserStoryLocally } from "../_lib/mock-service";
import type { StoryCandidate, ValidatedRequirement } from "../_lib/types";

function selectedCandidate(requirement: ValidatedRequirement, candidateId?: string): StoryCandidate {
  const candidates = createDemoGeneration(requirement).candidates;
  return candidates.find((candidate) => candidate.storyId === candidateId) ?? candidates[0];
}

function refinementUrl(requirementId: string, storyId: string): string {
  return `/story-refinement?requirementId=${encodeURIComponent(requirementId)}&candidateId=${encodeURIComponent(storyId)}`;
}

export function UserStoryQualityEvaluationView({
  initialRequirementId,
  initialCandidateId,
}: {
  initialRequirementId?: string;
  initialCandidateId?: string;
}) {
  const requirement = MOCK_REQUIREMENTS.find((item) => item.id === initialRequirementId) ?? MOCK_REQUIREMENTS[0];
  const candidate = selectedCandidate(requirement, initialCandidateId);
  const [userStory, setUserStory] = useState(candidate.userStory);
  const [editingStory, setEditingStory] = useState(false);
  const [optimizationNotice, setOptimizationNotice] = useState("");
  const investAssessment = evaluateInvestLocally(userStory, candidate.acceptanceCriteria);
  const overall = Math.round(candidate.assessment.reduce((total, dimension) => total + dimension.score, 0) / candidate.assessment.length * 100);
  const recommendations = getMockImprovementRecommendations(candidate);

  return (
    <PageContainer>
      <PageHeader
        title="User Story Quality Evaluation"
        description="A transparent mock assessment of the selected story to support, not replace, human review."
        actions={
          <Button asChild variant="outline">
            <Link href={`/story-refinement/candidates?requirementId=${encodeURIComponent(requirement.id)}`}><ArrowLeftIcon aria-hidden /> Compare candidates</Link>
          </Button>
        }
      />

      <WorkflowIndicator currentStep="INVEST assessment" />
      <Card className="border-primary/25">
        <CardContent className="pt-5">
          <UserStoryCard
            story={{ storyId: candidate.storyId, requirementId: requirement.id, text: userStory }}
            title="Selected User Story"
            actions={<span className="rounded-sm border bg-muted px-2.5 py-1.5 text-xs font-medium">{candidate.label}</span>}
          />
          {editingStory ? <Textarea className="mt-4" aria-label="Edit selected user story" value={userStory} onChange={(event) => setUserStory(event.target.value)} rows={3} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingStory((editing) => !editing)}>{editingStory ? "Done Editing" : "Edit User Story"}</Button>
            <Button type="button" onClick={() => {
              const result = optimizeUserStoryLocally(userStory, requirement);
              setUserStory(result.optimizedStory);
              setOptimizationNotice(`${result.explanation} Prototype formatting only; no LLM or semantic optimizer is running.`);
            }}>Optimize User Story</Button>
          </div>
          {optimizationNotice ? <p role="status" className="mt-3 text-sm text-muted-foreground">{optimizationNotice}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(13rem,0.65fr)_minmax(0,1.35fr)]">
        <Card className="flex flex-col justify-center border-primary/30 bg-primary/5">
          <CardHeader>
            <CardDescription>Overall Quality Score</CardDescription>
            <CardTitle className="font-mono text-5xl tabular-nums">{overall}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overall} aria-label="Overall quality score" className="h-2" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">A mean of the five mock quality dimensions shown here. Use the rationale and source requirement when reviewing.</p>
          </CardContent>
        </Card>

        <QualityEvaluation scores={candidate.assessment.filter((dimension) => dimension.key !== "invest")} />
      </div>

      <section aria-labelledby="invest-heading" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">INVEST Evaluation</p>
          <h2 id="invest-heading" className="mt-1 text-lg font-semibold">Six story quality checks</h2>
        </div>
        <INVESTChecklist criteria={investAssessment} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AssumptionList assumptions={candidate.unsupportedAssumptions} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><LightbulbIcon aria-hidden className="size-4 text-primary" /> Improvement Recommendations</CardTitle>
            <CardDescription>Suggestions to discuss with the Product Owner before accepting this story.</CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.length ? (
              <ul className="space-y-2">
                {recommendations.map((recommendation) => <li key={recommendation} className="flex gap-2 text-sm leading-relaxed"><ArrowRightIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />{recommendation}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No mock recommendations for this candidate. Review the source requirement and acceptance criteria manually.</p>}
          </CardContent>
        </Card>
      </div>

      <Alert className="border-primary/25 bg-primary/5">
        <UserRoundCheckIcon aria-hidden />
        <AlertTitle>Human decision required</AlertTitle>
        <AlertDescription>AI evaluation is an assistance mechanism only. Scores and recommendations can be wrong or incomplete; the final decision belongs to the human reviewer (Product Owner or developer).</AlertDescription>
      </Alert>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link href={`/story-refinement/candidates?requirementId=${encodeURIComponent(requirement.id)}`}><ArrowLeftIcon aria-hidden /> Back to candidates</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(requirement.id)}&candidateId=${encodeURIComponent(candidate.storyId)}`}>Generate Acceptance Criteria</Link>
        </Button>
        <Button asChild>
          <Link href={refinementUrl(requirement.id, candidate.storyId)}>Improve User Story <ArrowRightIcon aria-hidden /></Link>
        </Button>
      </div>
    </PageContainer>
  );
}