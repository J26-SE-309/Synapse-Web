import type { Metadata } from "next";

import { PredictionLogView } from "../_components/PredictionLogView";

export const metadata: Metadata = { title: "Prediction log · Effort & Sprint Risk" };

export default function PredictionLogPage() {
  return <PredictionLogView />;
}
