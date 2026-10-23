import type { Metadata } from "next";

import { PageHeader } from "@/shared/components/PageHeader";

import { ModelRefinementForm } from "./_components/ModelRefinementForm";
import { StoryRefinementWorkspace } from "./_components/StoryRefinementWorkspace";

export const metadata: Metadata = { title: "Story Refinement" };

export default async function StoryRefinementPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string | string[]; candidateId?: string | string[]; resumeId?: string | string[] }>;
}) {
  const { requirementId, candidateId, resumeId } = await searchParams;
  const initialRequirementId = (Array.isArray(requirementId) ? requirementId[0] : requirementId) || undefined;
  const initialCandidateId = (Array.isArray(candidateId) ? candidateId[0] : candidateId) || undefined;
  const initialResumeId = (Array.isArray(resumeId) ? resumeId[0] : resumeId) || undefined;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Story Refinement"
        description="Turn a validated software requirement into an Agile user story with testable acceptance criteria."
      />
      <ModelRefinementForm initialRequirementId={initialRequirementId} />
      <StoryRefinementWorkspace
        initialRequirementId={initialRequirementId}
        initialCandidateId={initialCandidateId}
        initialResumeId={initialResumeId}
      />
    </div>
  );
}
