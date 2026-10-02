import type { Metadata } from "next";

import { RequirementQualityAnalyzer } from "./_components/RequirementQualityAnalyzer";

export const metadata: Metadata = {
  title: "Requirement Quality",
};

export default function RequirementQualityPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Requirement Quality
        </h1>
        <p className="text-zinc-600">
          Assess the quality of a software requirement using contextual
          classification and structural completeness checks.
        </p>
      </header>

      <RequirementQualityAnalyzer />
    </div>
  );
}
