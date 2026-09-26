import type { Metadata } from "next";

import { PlanView } from "../_components/PlanView";

export const metadata: Metadata = { title: "Sprint planning · Effort & Sprint Risk" };

export default function SprintPlanningPage() {
  return <PlanView />;
}
