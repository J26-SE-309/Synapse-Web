import type { Metadata } from "next";

import { GenerationHistoryView } from "../_components/GenerationHistoryView";

export const metadata: Metadata = { title: "Generation History · Story Refinement" };

export default function GenerationHistoryPage() {
  return <GenerationHistoryView />;
}