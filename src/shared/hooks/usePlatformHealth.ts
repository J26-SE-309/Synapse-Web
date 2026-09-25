"use client";

import { useQuery } from "@tanstack/react-query";

import { gatewayFetch, type PlatformHealth } from "@/shared/api/gateway";

/** Gateway and component status, refreshed every 15 seconds. */
export function usePlatformHealth() {
  return useQuery({
    queryKey: ["platform-health"],
    queryFn: () => gatewayFetch<PlatformHealth>("health"),
    refetchInterval: 15_000,
    retry: false,
  });
}
