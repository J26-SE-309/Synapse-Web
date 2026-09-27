"use client";

import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import { describeError } from "@/shared/api/gateway";
import { PageHeader } from "@/shared/components/PageHeader";
import type { Project } from "@/shared/projects/api";
import { ProjectGate } from "@/shared/projects/ProjectGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Skeleton } from "@/shared/ui/skeleton";

import { useSprints, useStories } from "./api";
import { formatPoints } from "./badges";
import { ImportStoriesDialog } from "./ImportStoriesDialog";
import { StoryFormDialog } from "./StoryFormDialog";
import { StoryTable } from "./StoryTable";
import { totalPoints, type Story } from "./types";

const VIEWS = {
  backlog: { label: "Not in a sprint", keep: (story: Story) => story.sprint_id === null && story.status !== "done" },
  planned: { label: "In a sprint", keep: (story: Story) => story.sprint_id !== null && story.status !== "done" },
  done: { label: "Done", keep: (story: Story) => story.status === "done" },
  all: { label: "All stories", keep: () => true },
} as const;
type View = keyof typeof VIEWS;

function Backlog({ project }: { project: Project }) {
  const stories = useStories(project.id);
  const sprints = useSprints(project.id);
  const [view, setView] = useState<View>("backlog");
  const [creating, setCreating] = useState(false);
  const ids = useId();
  const all = stories.data ?? [];
  const shown = all.filter(VIEWS[view].keep);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Backlog"
        description="Every story of the project with its details. Plan sprints from here: the team chooses the stories, and the components give their opinion on them."
        actions={
          <>
            <ImportStoriesDialog projectId={project.id} />
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden /> New story
            </Button>
          </>
        }
      />

      {stories.isPending || sprints.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : stories.isError || sprints.isError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The backlog could not be loaded</AlertTitle>
          <AlertDescription>{describeError(stories.error ?? sprints.error)}</AlertDescription>
        </Alert>
      ) : all.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No stories yet</EmptyTitle>
            <EmptyDescription>
              Add the project&apos;s user stories one by one, or import a backlog file. Stories from story refinement will
              arrive here too.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden /> New story
            </Button>
            <ImportStoriesDialog projectId={project.id} />
          </EmptyContent>
        </Empty>
      ) : (
        <section aria-labelledby={`${ids}-heading`} className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id={`${ids}-heading`} className="text-lg font-semibold">
                {VIEWS[view].label}
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {shown.length} {shown.length === 1 ? "story" : "stories"}, {formatPoints(totalPoints(shown))} points
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`${ids}-view`} className="text-sm font-medium">
                Show
              </label>
              <NativeSelect id={`${ids}-view`} value={view} onChange={(event) => setView(event.target.value as View)}>
                {(Object.keys(VIEWS) as View[]).map((key) => (
                  <NativeSelectOption key={key} value={key}>
                    {VIEWS[key].label} ({all.filter(VIEWS[key].keep).length})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No stories here. Choose another view above.
            </p>
          ) : (
            <StoryTable projectId={project.id} stories={shown} sprints={sprints.data ?? []} caption={`Backlog: ${VIEWS[view].label}`} />
          )}
        </section>
      )}

      <StoryFormDialog projectId={project.id} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export function BacklogView() {
  return <ProjectGate>{(project) => <Backlog key={project.id} project={project} />}</ProjectGate>;
}
