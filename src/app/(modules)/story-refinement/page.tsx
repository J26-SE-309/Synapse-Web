import type { Metadata } from "next";

import { PageHeader } from "@/shared/components/PageHeader";

import { ValidatedRequirementsView } from "./_components/ValidatedRequirementsView";

export const metadata: Metadata = { title: "Story Refinement" };

export default function StoryRefinementPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Story Refinement"
        description="Turn a validated software requirement into an Agile user story with testable acceptance criteria."
      />
      <ValidatedRequirementsView />
    </div>
  );
}
