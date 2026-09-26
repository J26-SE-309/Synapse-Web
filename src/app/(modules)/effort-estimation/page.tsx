import type { Metadata } from "next";

import { OverviewView } from "./_components/OverviewView";

export const metadata: Metadata = { title: "Effort & Sprint Risk" };

// Owned by @Nikeshala22. The module's pages are listed in _nav.ts; components, hooks and API calls live in
// _components/ and _lib/.
export default function EffortEstimationPage() {
  return <OverviewView />;
}
