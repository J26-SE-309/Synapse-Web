import type { Metadata } from "next";

import { UserStoryQualityEvaluationView } from "../_components/UserStoryQualityEvaluationView";

export const metadata: Metadata = { title: "User Story Quality Evaluation · Story Refinement" };

export default async function UserStoryQualityEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string | string[]; candidateId?: string | string[] }>;
}) {
  const { requirementId, candidateId } = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
  return <UserStoryQualityEvaluationView initialRequirementId={first(requirementId)} initialCandidateId={first(candidateId)} />;
}