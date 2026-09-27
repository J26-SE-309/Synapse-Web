"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { gatewayFetch } from "@/shared/api/gateway";

import type {
  ImportResult,
  Sprint,
  SprintCreate,
  SprintUpdate,
  Story,
  StoryCreate,
  StoryImport,
  StoryUpdate,
} from "./types";

const project = (id: string) => `api/v1/projects/${encodeURIComponent(id)}`;
const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const backlogKeys = {
  project: (projectId: string) => ["platform", projectId] as const,
  stories: (projectId: string) => ["platform", projectId, "stories"] as const,
  sprints: (projectId: string) => ["platform", projectId, "sprints"] as const,
  sprint: (projectId: string, sprintId: string) => ["platform", projectId, "sprints", sprintId] as const,
};

/**
 * After a change the gateway sends an active sprint to the effort service in the background; the sprint's
 * "sent" status is read again a moment later.
 */
function refresh(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: backlogKeys.project(projectId) });
  window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: backlogKeys.sprints(projectId) }), 1500);
}

export function useStories(projectId: string) {
  return useQuery({
    queryKey: backlogKeys.stories(projectId),
    queryFn: () => gatewayFetch<Story[]>(`${project(projectId)}/stories`),
  });
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: backlogKeys.sprints(projectId),
    queryFn: () => gatewayFetch<Sprint[]>(`${project(projectId)}/sprints`),
  });
}

export function useSprint(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: backlogKeys.sprint(projectId, sprintId),
    queryFn: () => gatewayFetch<Sprint>(`${project(projectId)}/sprints/${encodeURIComponent(sprintId)}`),
  });
}

export function useCreateStory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (story: StoryCreate) =>
      gatewayFetch<Story>(`${project(projectId)}/stories`, { method: "POST", ...json(story) }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useImportStories(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: StoryImport) =>
      gatewayFetch<ImportResult>(`${project(projectId)}/stories/import`, { method: "POST", ...json(request) }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useUpdateStory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, update }: { storyId: string; update: StoryUpdate }) =>
      gatewayFetch<Story>(`${project(projectId)}/stories/${encodeURIComponent(storyId)}`, {
        method: "PATCH",
        ...json(update),
      }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useDeleteStory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      gatewayFetch<void>(`${project(projectId)}/stories/${encodeURIComponent(storyId)}`, { method: "DELETE" }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprint: SprintCreate) =>
      gatewayFetch<Sprint>(`${project(projectId)}/sprints`, { method: "POST", ...json(sprint) }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useUpdateSprint(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: SprintUpdate) =>
      gatewayFetch<Sprint>(`${project(projectId)}/sprints/${encodeURIComponent(sprintId)}`, {
        method: "PATCH",
        ...json(update),
      }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) =>
      gatewayFetch<void>(`${project(projectId)}/sprints/${encodeURIComponent(sprintId)}`, { method: "DELETE" }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}

/** Start, close, or send again to the effort service. */
export function useSprintAction(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "close" | "sync") =>
      gatewayFetch<Sprint>(`${project(projectId)}/sprints/${encodeURIComponent(sprintId)}/${action}`, { method: "POST" }),
    onSuccess: () => refresh(queryClient, projectId),
  });
}
