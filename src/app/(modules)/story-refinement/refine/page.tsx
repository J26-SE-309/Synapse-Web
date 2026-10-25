import type { Metadata } from "next";

import { PageHeader } from "@/shared/components/PageHeader";

import { StoryRefinementWorkspace } from "../_components/StoryRefinementWorkspace";

export const metadata: Metadata = { title: "Refine User Story · Story Refinement" };

export default async function RefineUserStoryPage({
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
        title="Refine User Story"
        description="Turn the selected validated requirement into an Agile user story with testable acceptance criteria."
      />
      <StoryRefinementWorkspace
        initialRequirementId={initialRequirementId}
        initialCandidateId={initialCandidateId}
        initialResumeId={initialResumeId}
      />
    </div>
  );
}
