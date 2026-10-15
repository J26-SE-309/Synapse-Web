import type { Metadata } from "next";

import { PredictStoryView } from "../_components/PredictStory";

export const metadata: Metadata = { title: "Predict a story · Effort & Sprint Risk" };

export default function PredictStoryPage() {
  return <PredictStoryView />;
}
