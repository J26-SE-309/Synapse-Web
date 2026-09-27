import type { Metadata } from "next";

import { PredictionLogView } from "../_components/PredictionLogView";

export const metadata: Metadata = { title: "Prediction log · Effort & Sprint Risk" };

export default async function PredictionLogPage({
  searchParams,
}: {
  searchParams: Promise<{ sprint?: string | string[]; story?: string | string[] }>;
}) {
  const { sprint, story } = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
  // Links from a sprint or a story (the platform's Sprints and Backlog pages) open the log already filtered.
  return <PredictionLogView initialFilters={{ sprintId: first(sprint), storyId: first(story) }} />;
}
