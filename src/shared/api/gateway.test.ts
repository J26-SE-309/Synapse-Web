import { afterEach, describe, expect, it, vi } from "vitest";

import { GatewayError, gatewayFetch, gatewayUrl } from "@/shared/api/gateway";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gatewayUrl", () => {
  it("joins paths without doubling slashes", () => {
    expect(gatewayUrl("/api/v1/traceability/coverage")).toBe("http://localhost:8000/api/v1/traceability/coverage");
    expect(gatewayUrl("health")).toBe("http://localhost:8000/health");
  });
});

describe("gatewayFetch", () => {
  it("returns the parsed JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
    await expect(gatewayFetch("health")).resolves.toEqual({ status: "ok" });
  });

  it("sends JSON bodies with a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await gatewayFetch("api/v1/effort-estimation/estimate", { method: "POST", body: "{}" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("throws a GatewayError carrying the status when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const error = await gatewayFetch("health").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GatewayError);
    expect((error as GatewayError).status).toBe(503);
  });
});
