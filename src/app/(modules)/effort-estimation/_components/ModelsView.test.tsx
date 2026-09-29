import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "@/shared/projects/ProjectProvider";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { accessibilityProblems } from "@/test/axe";

import models from "../../../../../contracts/effort-estimation/examples/models.json";
import { ModelsView, relativeScore } from "./ModelsView";

const PROJECT = { id: "TUTOR", name: "Tutoring app", description: "", data_source: "platform", created_at: "2026-09-10T09:00:00Z" };

function gateway(requests: { url: string; method: string; body?: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    requests.push({ url, method, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith("/api/v1/projects")) return json([PROJECT]);
    if (url.endsWith("/effort-estimation/models")) return json(models);
    if (url.endsWith("/projects/TUTOR/pin")) {
      return json({ project_id: "TUTOR", configuration_id: method === "PUT" ? body.configuration_id : null });
    }
    return json({ detail: "Not Found" }, 404);
  });
}

function renderModels() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ProjectProvider initialProjectId="TUTOR">
          <ModelsView />
        </ProjectProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the models page", () => {
  it("scales each meter between the worst and the best pair", () => {
    expect(relativeScore(30, [20, 25, 30], true)).toBe(1);
    expect(relativeScore(20, [20, 25, 30], true)).toBeCloseTo(0.15);
    expect(relativeScore(0.02, [0.02, 0.04], false)).toBe(1);
    // speed on a log scale: 0.1 s is halfway between 0.01 s and 1 s
    expect(relativeScore(0.1, [0.01, 1], false, true)).toBeCloseTo(0.575);
    expect(relativeScore(undefined, [1, 2], true)).toBeNull();
  });

  it("shows a card for every pair and chooses one for the project", async () => {
    const requests: { url: string; method: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(requests));
    const { container } = renderModels();
    const user = userEvent.setup();

    await screen.findByText(/In use: automatic selection/);
    const available = models.configurations.filter((model) => model.status === "available");
    expect(screen.getAllByRole("button", { name: "Use this model" })).toHaveLength(available.length);
    expect(screen.getByRole("heading", { level: 3, name: "Automatic" })).toBeInTheDocument();
    expect(await accessibilityProblems(container)).toEqual([]);

    const first = available[0];
    const card = screen.getByRole("heading", { level: 3, name: first.label }).closest("[data-slot=card]") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Use this model" }));
    await waitFor(() =>
      expect(requests.find((request) => request.method === "PUT")).toMatchObject({ body: { configuration_id: first.configuration_id } }),
    );
    expect(await within(card).findByText("In use for this project")).toBeInTheDocument();
  });

  it("sorts the leaderboard by a column", async () => {
    vi.stubGlobal("fetch", gateway([]));
    renderModels();
    const user = userEvent.setup();

    const table = await screen.findByRole("table");
    await user.click(within(table).getByRole("button", { name: /Speed/ }));
    const fastest = [...models.configurations]
      .filter((model) => model.metrics.latency_p95 != null)
      .sort((a, b) => a.metrics.latency_p95! - b.metrics.latency_p95!)[0];
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent(fastest.label);
    expect(within(table).getByRole("columnheader", { name: /Speed/ })).toHaveAttribute("aria-sort", "ascending");
  });
});
