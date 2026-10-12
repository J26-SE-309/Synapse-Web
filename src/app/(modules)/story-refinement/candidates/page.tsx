import type { Metadata } from "next";

import { UserStoryCandidatesView } from "../_components/UserStoryCandidatesView";

export const metadata: Metadata = { title: "User Story Candidates · Story Refinement" };

export default async function UserStoryCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string | string[] }>;
}) {
  const { requirementId } = await searchParams;
  const initialRequirementId = (Array.isArray(requirementId) ? requirementId[0] : requirementId) || undefined;
  return <UserStoryCandidatesView initialRequirementId={initialRequirementId} />;
}