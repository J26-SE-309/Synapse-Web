"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useProjects, type Project } from "@/shared/projects/api";
import { PROJECT_COOKIE, PROJECT_COOKIE_MAX_AGE } from "@/shared/projects/cookie";

// The project the pages work on is kept in a cookie, so the server renders the same choice on the next visit.

interface ProjectContextValue {
  /** The chosen project's id, even before the list has loaded (or when it no longer exists). */
  projectId: string | null;
  /** The chosen project, once the list has loaded and if it still exists. */
  project: Project | undefined;
  projects: ReturnType<typeof useProjects>;
  selectProject: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ initialProjectId, children }: { initialProjectId: string | null; children: ReactNode }) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const projects = useProjects();

  const selectProject = useCallback((id: string | null) => {
    setProjectId(id);
    document.cookie = id
      ? `${PROJECT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${PROJECT_COOKIE_MAX_AGE}; SameSite=Lax`
      : `${PROJECT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId,
      project: projects.data?.find((entry) => entry.id === projectId),
      projects,
      selectProject,
    }),
    [projectId, projects, selectProject],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider.");
  }
  return context;
}
