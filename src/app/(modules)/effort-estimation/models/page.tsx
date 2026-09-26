import type { Metadata } from "next";

import { ModelsView } from "../_components/ModelsView";

export const metadata: Metadata = { title: "Models · Effort & Sprint Risk" };

export default function ModelsPage() {
  return <ModelsView />;
}
