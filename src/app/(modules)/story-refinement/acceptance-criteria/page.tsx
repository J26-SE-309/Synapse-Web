import type { Metadata } from "next";

import { AcceptanceCriteriaGeneratorView } from "../_components/AcceptanceCriteriaGeneratorView";

export const metadata: Metadata = { title: "Acceptance Criteria Generator · Story Refinement" };

export default async function AcceptanceCriteriaPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string | string[]; candidateId?: string | string[]; resumeId?: string | string[] }>;
}) {
  const { requirementId, candidateId, resumeId } = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
  return <AcceptanceCriteriaGeneratorView initialRequirementId={first(requirementId)} initialCandidateId={first(candidateId)} initialResumeId={first(resumeId)} />;
}