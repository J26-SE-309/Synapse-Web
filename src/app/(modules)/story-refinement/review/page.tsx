import type { Metadata } from "next";

import { ReviewApprovalView } from "../_components/ReviewApprovalView";

export const metadata: Metadata = { title: "Review & Approval · Story Refinement" };

export default async function ReviewApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string | string[]; candidateId?: string | string[]; resumeId?: string | string[] }>;
}) {
  const { requirementId, candidateId, resumeId } = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
  return <ReviewApprovalView initialRequirementId={first(requirementId)} initialCandidateId={first(candidateId)} initialResumeId={first(resumeId)} />;
}