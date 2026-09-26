import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "@/shared/projects/ProjectProvider";
import { accessibilityProblems } from "@/test/axe";
import { TooltipProvider } from "@/shared/ui/tooltip";

import estimate from "../../../../../contracts/effort-estimation/examples/estimate-response.json";
import models from "../../../../../contracts/effort-estimation/examples/models.json";
import { PlanView } from "./PlanView";

const PROJECT = { id: "TUTOR", name: "Tutoring app", description: "", data_source: "platform", created_at: "2026-09-27T09:00:00Z" };
const SPRINT = {
  stories: 1,
  runs: 10000,
  committed_points: { p10: 2, p50: 4, p90: 8 },
  capacity_points: { p10: 20, p50: 25, p90: 30 },
  overcommit_probability: 0.02,
  sprint_risk_level: "low",
  expected_overflow_points: 0,
  overflow_if_over_p50: null,
  expected_stories_at_risk: 0.7,
  stories_at_risk_p90: 1,
  recommendations: [],
};

/** The gateway, answering from the contract examples. */
function gateway(requests: { url: string; body?: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    requests.push({ url, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith("/api/v1/projects")) return json([PROJECT]);
    if (url.endsWith("/effort-estimation/models")) return json(models);
    if (url.endsWith("/projects/TUTOR/pin")) return json({ project_id: "TUTOR", configuration_id: null });
    if (url.endsWith("/effort-estimation/risk")) {
      const prediction = { ...estimate.predictions[0], story_id: body.stories[0].story_id, project_id: "TUTOR" };
      return json({ ...estimate, predictions: [prediction], sprint: SPRINT });
    }
    return json({ detail: "Not Found" }, 404);
  });
}

function renderPlan() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ProjectProvider initialProjectId="TUTOR">
          <PlanView />
        </ProjectProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sprint planning", () => {
  it("lists the problems first, sends nothing, and takes you to each one", async () => {
    const requests: { url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(requests));
    renderPlan();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Planned capacity (points)"), "0");
    await user.click(screen.getByRole("button", { name: "Estimate the sprint" }));

    const summary = (await screen.findByText("There are 2 problems with the backlog")).closest("[role=alert]") as HTMLElement;
    expect(summary).toHaveTextContent("Planned capacity: Enter a number above 0.");
    expect(summary).toHaveTextContent("Story 1, Title: Enter the story's title.");
    await user.click(within(summary).getByRole("button", { name: /Story 1, Title/ }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());
    expect(requests.some((request) => request.url.endsWith("/risk"))).toBe(false);
  });

  it("estimates the backlog and shows the sprint and each story", async () => {
    const requests: { url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(requests));
    const { container } = renderPlan();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Title"), "As a student I want to book a session");
    await user.type(screen.getByLabelText(/Team's estimate/), "3");
    await user.type(screen.getByLabelText("Sprint id"), "TUTOR-S4");
    await user.click(screen.getByRole("button", { name: "Estimate the sprint" }));

    const heading = await screen.findByRole("heading", { name: "Results" });
    await waitFor(() => expect(heading).toHaveFocus());
    const sent = requests.find((request) => request.url.endsWith("/effort-estimation/risk"))?.body;
    expect(sent).toMatchObject({
      project_id: "TUTOR",
      sprint_id: "TUTOR-S4",
      pinned_configuration: null,
      stories: [{ story_id: "TUTOR-1", title: "As a student I want to book a session", story_points: 3 }],
    });
    expect(screen.getByRole("heading", { name: "Sprint risk" })).toBeInTheDocument();
    const results = screen.getByRole("region", { name: "Results" });
    const row = within(results).getByText("As a student I want to book a session").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("TUTOR-1");
    // risk in words, not colour alone (NFR11)
    expect(within(row).getByText(/High risk|Medium risk|Low risk/)).toBeInTheDocument();
    expect(within(row).getByRole("group", { name: /Review the estimate/ })).toBeInTheDocument();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});
