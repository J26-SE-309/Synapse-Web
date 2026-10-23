"use client";

import type { ReactNode } from "react";

import { describeError } from "@/shared/api/gateway";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorIllustration, ProjectIllustration } from "@/shared/illustrations";
import type { Project } from "@/shared/projects/api";
import { useProject } from "@/shared/projects/ProjectProvider";
import { ProjectSwitcher } from "@/shared/projects/ProjectSwitcher";
import { Button } from "@/shared/ui/button";
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
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (projects.isError) {
    return (
      <EmptyState
        illustration={ErrorIllustration}
        title="Projects could not be loaded"
        headingLevel="h1"
        description={describeError(projects.error)}
        actions={
          <Button variant="outline" onClick={() => projects.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      illustration={ProjectIllustration}
      title={projectId ? `Project ${projectId} no longer exists` : "Choose a project"}
      description="This page works on one project at a time. Choose one, or create a new project for your team."
      actions={<ProjectSwitcher />}
      headingLevel="h1"
    />
  );
}
