import type { Metadata } from "next";

import { SprintView } from "@/shared/backlog/SprintView";

export async function generateMetadata({ params }: { params: Promise<{ sprintId: string }> }): Promise<Metadata> {
  const { sprintId } = await params;
  return { title: `${decodeURIComponent(sprintId)} · Sprints` };
}

export default async function SprintPage({ params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = await params;
  return <SprintView sprintId={decodeURIComponent(sprintId)} />;
}
