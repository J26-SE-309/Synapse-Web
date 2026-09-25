import type { ModuleSlug } from "@/shared/modules";

/**
 * Every request from the web app goes through the API gateway (gateway/ in this repository).
 * A component's own endpoints are reached at `api/v1/<module-slug>/...`,
 * e.g. gatewayFetch("api/v1/effort-estimation/estimate", { method: "POST", body }).
 */
export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class GatewayError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

export function gatewayUrl(path: string): string {
  return `${GATEWAY_URL}/${path.replace(/^\/+/, "")}`;
}

export async function gatewayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(gatewayUrl(path), { ...init, headers });
  if (!response.ok) {
    throw new GatewayError(response.status, `${init.method ?? "GET"} ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface ComponentStatus {
  status: "up" | "down";
  version: string | null;
}

/** Response of the gateway's GET /health. */
export interface PlatformHealth {
  status: "ok";
  version: string;
  database: "ok" | "unavailable";
  components: Record<ModuleSlug, ComponentStatus>;
}
