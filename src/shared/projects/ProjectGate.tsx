"use client";

import { FolderKanbanIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { describeError } from "@/shared/api/gateway";
import type { Project } from "@/shared/projects/api";
import { useProject } from "@/shared/projects/ProjectProvider";
import { ProjectSwitcher } from "@/shared/projects/ProjectSwitcher";
import { Button } from "@/shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * For pages that work on one project: renders `children` with the chosen project, or asks for one. The
 * choice itself lives in the top bar (ProjectSwitcher), so it carries across pages and components.
 */
export function ProjectGate({ children }: { children: (project: Project) => ReactNode }) {
  const { projectId, project, projects } = useProject();

  if (project) return <>{children(project)}</>;

  if (projects.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading the project">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (projects.isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Projects could not be loaded</EmptyTitle>
          <EmptyDescription>{describeError(projects.error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => projects.refetch()}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderKanbanIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{projectId ? `Project ${projectId} no longer exists` : "Choose a project"}</EmptyTitle>
        <EmptyDescription>
          This page works on one project at a time. Choose one, or create a new project for your team.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ProjectSwitcher />
      </EmptyContent>
    </Empty>
  );
}
