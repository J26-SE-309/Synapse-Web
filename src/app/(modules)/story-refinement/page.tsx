import type { Metadata } from "next";

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
  return <StoryRefinementWorkspace initialRequirementId={initialRequirementId} initialCandidateId={initialCandidateId} initialResumeId={initialResumeId} />;
}
