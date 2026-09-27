import type { Metadata } from "next";

import { PredictionDetailView } from "../../_components/PredictionDetailView";

export const metadata: Metadata = { title: "Prediction · Effort & Sprint Risk" };

export default async function PredictionPage({ params }: { params: Promise<{ predictionId: string }> }) {
  const { predictionId } = await params;
  return <PredictionDetailView predictionId={predictionId} />;
}
