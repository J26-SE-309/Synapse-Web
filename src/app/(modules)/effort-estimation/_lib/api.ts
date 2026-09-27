"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gatewayFetch } from "@/shared/api/gateway";

import type {
  CompareRequest,
  CompareResponse,
  EstimateRequest,
  FeedbackInput,
  HistoryImport,
  HistorySummary,
  ModelsResponse,
  Pin,
  PredictionDetail,
  PredictionPage,
  ProjectSummary,
  Recorded,
  SprintRiskResponse,
} from "./types";

/** This component's endpoints, through the gateway (contracts/effort-estimation). */
const BASE = "api/v1/effort-estimation";
const project = (id: string) => `${BASE}/projects/${encodeURIComponent(id)}`;
const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const effortKeys = {
  all: ["effort"] as const,
  models: () => [...effortKeys.all, "models"] as const,
  pin: (projectId: string) => [...effortKeys.all, projectId, "pin"] as const,
  history: (projectId: string) => [...effortKeys.all, projectId, "history"] as const,
  summary: (projectId: string) => [...effortKeys.all, projectId, "summary"] as const,
  predictions: (projectId: string, filters: PredictionFilters) =>
    [...effortKeys.all, projectId, "predictions", filters] as const,
  prediction: (predictionId: string) => [...effortKeys.all, "prediction", predictionId] as const,
};

export function useModels() {
  return useQuery({
    queryKey: effortKeys.models(),
    queryFn: () => gatewayFetch<ModelsResponse>(`${BASE}/models`),
    staleTime: 5 * 60_000,
  });
}

export function usePin(projectId: string) {
  return useQuery({ queryKey: effortKeys.pin(projectId), queryFn: () => gatewayFetch<Pin>(`${project(projectId)}/pin`) });
}

/** Choose a configuration for the project (FR12), or null for automatic selection again (FR11). */
export function useChooseModel(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (configurationId: string | null) =>
      configurationId
        ? gatewayFetch<Pin>(`${project(projectId)}/pin`, { method: "PUT", ...json({ configuration_id: configurationId }) })
        : gatewayFetch<Pin>(`${project(projectId)}/pin`, { method: "DELETE" }),
    onSuccess: (pin) => queryClient.setQueryData(effortKeys.pin(projectId), pin),
  });
}

export function useHistory(projectId: string) {
  return useQuery({
    queryKey: effortKeys.history(projectId),
    queryFn: () => gatewayFetch<HistorySummary>(`${project(projectId)}/history`),
  });
}

/** Replace the project's sprint history with a CSV file's (the import's columns: contracts/effort-estimation). */
export function useImportHistory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      gatewayFetch<HistoryImport>(`${project(projectId)}/history`, {
        method: "POST",
        body: csv,
        headers: { "Content-Type": "text/csv" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: effortKeys.history(projectId) }),
  });
}

export function useSummary(projectId: string) {
  return useQuery({
    queryKey: effortKeys.summary(projectId),
    queryFn: () => gatewayFetch<ProjectSummary>(`${project(projectId)}/summary`),
  });
}

export interface PredictionFilters {
  sprintId?: string;
  storyId?: string;
}

const PAGE_SIZE = 25;

export function usePredictionPages(projectId: string, filters: PredictionFilters) {
  return useInfiniteQuery({
    queryKey: effortKeys.predictions(projectId, filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam) });
      if (filters.sprintId) params.set("sprint_id", filters.sprintId);
      if (filters.storyId) params.set("story_id", filters.storyId);
      return gatewayFetch<PredictionPage>(`${project(projectId)}/predictions?${params}`);
    },
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
}

export function usePrediction(predictionId: string) {
  return useQuery({
    queryKey: effortKeys.prediction(predictionId),
    queryFn: () => gatewayFetch<PredictionDetail>(`${BASE}/predictions/${encodeURIComponent(predictionId)}`),
  });
}

/**
 * Story estimates and the sprint-level risk of committing to them (/risk: FR8, FR13-FR17). The service writes
 * its audit log just after answering, so the read-back views refresh a moment later.
 */
export function useSprintRisk(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: EstimateRequest) =>
      gatewayFetch<SprintRiskResponse>(`${BASE}/risk`, { method: "POST", ...json(request) }),
    onSuccess: () => {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [...effortKeys.all, projectId] });
      }, 1500);
    },
  });
}

/** The same stories through several configurations side by side (FR12); not recorded. */
export function useCompare() {
  return useMutation({
    mutationFn: (request: CompareRequest) =>
      gatewayFetch<CompareResponse>(`${BASE}/compare`, { method: "POST", ...json(request) }),
  });
}

/** Accept, adjust or reject an estimate (FR19). */
export function useFeedback(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedback: FeedbackInput) =>
      gatewayFetch<Recorded>(`${BASE}/feedback`, { method: "POST", ...json(feedback) }),
    onSuccess: (_recorded, feedback) => {
      void queryClient.invalidateQueries({ queryKey: [...effortKeys.all, projectId] });
      void queryClient.invalidateQueries({ queryKey: effortKeys.prediction(feedback.prediction_id) });
    },
  });
}
