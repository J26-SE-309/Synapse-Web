import type { Metadata } from "next";

import { SprintsView } from "@/shared/backlog/SprintsView";

export const metadata: Metadata = { title: "Sprints" };

export default function SprintsPage() {
  return <SprintsView />;
}
