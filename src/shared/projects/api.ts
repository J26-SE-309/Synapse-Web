"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gatewayFetch } from "@/shared/api/gateway";

/** Where a project's data comes from: created in Synapse, or development data (never used for evaluation). */
export type ProjectSource = "platform" | "tawos" | "synthetic";

/** contracts/common/project.schema.json: the platform's projects, served by the gateway. */
export interface Project {
  id: string;
  name: string;
  description: string;
  data_source: ProjectSource;
  created_at: string;
}

export interface ProjectCreate {
  id: string;
  name: string;
  description?: string;
}

export const SOURCE_LABELS: Record<Exclude<ProjectSource, "platform">, string> = {
  tawos: "TAWOS replay",
  synthetic: "Synthetic",
};

export function isDevelopmentData(project: Pick<Project, "data_source">): boolean {
  return project.data_source !== "platform";
}

export const PROJECTS_KEY = ["platform", "projects"] as const;

function byName(a: Project, b: Project): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => gatewayFetch<Project[]>("api/v1/projects"),
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreate) =>
      gatewayFetch<Project>("api/v1/projects", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(PROJECTS_KEY, (old) =>
        [...(old ?? []).filter((entry) => entry.id !== project.id), project].sort(byName),
      );
    },
  });
}
