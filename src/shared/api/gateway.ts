import type { ModuleSlug } from "@/shared/modules";

/**
 * Every request from the web app goes through the API gateway (gateway/ in this repository).
 * A component's own endpoints are reached at `api/v1/<module-slug>/...`,
 * e.g. gatewayFetch("api/v1/effort-estimation/estimate", { method: "POST", body }).
 */
export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** One problem FastAPI found in a request body: where (`loc`) and what (`msg`). */
export interface ValidationProblem {
  loc: (string | number)[];
  msg: string;
  type?: string;
}

export class GatewayError extends Error {
  readonly status: number;
  /** The service's `detail`: usually a message, or FastAPI's list of validation problems for a 422; a service
   * may also answer with its own object (e.g. effort-estimation's CSV import problems). */
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.detail = detail;
  }

  /** The validation problems of a 422 response, if any. */
  get problems(): ValidationProblem[] {
    return Array.isArray(this.detail) ? (this.detail as ValidationProblem[]) : [];
  }
}

export function gatewayUrl(path: string): string {
  return `${GATEWAY_URL}/${path.replace(/^\/+/, "")}`;
}

async function readDetail(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      return (body as { detail: unknown }).detail;
    }
  } catch {
    // not JSON: the status says enough
  }
  return undefined;
}

export async function gatewayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(gatewayUrl(path), { ...init, headers });
  if (!response.ok) {
    const detail = await readDetail(response);
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string"
          ? detail.message
          : `${init.method ?? "GET"} ${path} failed with status ${response.status}`;
    throw new GatewayError(response.status, message, detail);
  }
  if (response.status === 204) return undefined as T; // e.g. a DELETE: nothing to read
  return (await response.json()) as T;
}

/**
 * A sentence for people, for any error a gateway call can end with: the gateway or a component being down, a
 * rejected request, or the browser being offline.
 */
export function describeError(error: unknown): string {
  if (error instanceof GatewayError) {
    if (error.status === 503 || error.status === 502 || error.status === 504) {
      return typeof error.detail === "string" ? error.detail : "The service is not reachable right now. Try again shortly.";
    }
    if (error.status === 422 && error.problems.length > 0) {
      return error.problems.map((problem) => `${problem.loc.slice(1).join(".") || "request"}: ${problem.msg}`).join("; ");
    }
    if (typeof error.detail === "string" || (error.detail && typeof error.detail === "object" && !Array.isArray(error.detail))) {
      return error.message;
    }
    return `The request failed (status ${error.status}).`;
  }
  if (error instanceof TypeError) {
    return `Cannot reach the API gateway at ${GATEWAY_URL}. Is it running?`;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
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
