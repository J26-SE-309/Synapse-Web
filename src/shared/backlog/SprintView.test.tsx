import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "@/shared/projects/ProjectProvider";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { accessibilityProblems } from "@/test/axe";
import { ACTIVE, story } from "@/test/backlog-fixtures";

import estimate from "../../../contracts/effort-estimation/examples/estimate-response.json";
import models from "../../../contracts/effort-estimation/examples/models.json";
import { SprintView } from "./SprintView";
import type { Sprint } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sprints/TUTOR-S4" }));

const PROJECT = { id: "TUTOR", name: "Tutoring app", description: "", data_source: "platform", created_at: "2026-09-10T09:00:00Z" };
const PLANNED: Sprint = {
  ...ACTIVE,
  status: "planned",
  started_at: null,
  planned_end: null,
  items: ACTIVE.items.map((item) => ({ ...item, committed_at: null, added_mid_sprint: false })),
  effort_sync: { status: "not_sent", sent_at: null, error: null },
};
const SPRINT_RISK = {
  stories: 3,
  runs: 10000,
  committed_points: { p10: 8, p50: 10, p90: 14 },
  capacity_points: { p10: 26, p50: 30, p90: 34 },
  overcommit_probability: 0.02,
  sprint_risk_level: "low",
  expected_overflow_points: 0,
  overflow_if_over_p50: null,
  expected_stories_at_risk: 1.1,
  stories_at_risk_p90: 2,
  recommendations: [],
};
const STORIES = [
  story("TUTOR-1", {
    title: "As a student I want to book a session",
    description: "Pick a tutor and a time",
    acceptance_criteria: ["Given a free slot, when I book it, then it is mine"],
    epic: "Booking",
  }),
  story("TUTOR-2", { title: "Pay for a session", story_points: 5 }),
  story("TUTOR-3", { title: "Cancel a booking", story_points: 2 }),
  story("TUTOR-9", { title: "Waiting in the backlog", sprint_id: null }),
];

/** The gateway, answering for the platform and the effort service. */
function gateway(sprint: Sprint, requests: { url: string; method: string; body?: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    requests.push({ url, method, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith("/api/v1/projects")) return json([PROJECT]);
    if (url.endsWith("/projects/TUTOR/stories")) return json(STORIES);
    if (url.endsWith("/projects/TUTOR/sprints")) return json([sprint]);
    if (url.endsWith("/sprints/TUTOR-S4/start")) return json({ ...sprint, status: "active" });
    if (url.endsWith("/effort-estimation/models")) return json(models);
    if (url.endsWith("/projects/TUTOR/pin")) return json({ project_id: "TUTOR", configuration_id: null });
    if (url.endsWith("/effort-estimation/risk")) {
      const predictions = body.stories.map((entry: { story_id: string }) => ({ ...estimate.predictions[0], story_id: entry.story_id }));
      return json({ ...estimate, predictions, sprint: SPRINT_RISK });
    }
    return json({ detail: "Not Found" }, 404);
  });
}

function renderSprint() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ProjectProvider initialProjectId="TUTOR">
          <SprintView sprintId="TUTOR-S4" />
        </ProjectProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a sprint's page", () => {
  it("shows the sprint backlog with every story's details, and starts the sprint", async () => {
    const requests: { url: string; method: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(PLANNED, requests));
    const { container } = renderSprint();
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Sprint 4" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Stories in Sprint 4" });
    expect(within(table).queryByText("Waiting in the backlog")).not.toBeInTheDocument();
    // 3 + 5 + 2 committed against a capacity of 30
    expect(screen.getByText("20 points to spare")).toBeInTheDocument();

    const toggle = within(table).getByRole("button", { name: /As a student I want to book a session/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Given a free slot, when I book it, then it is mine")).toBeInTheDocument();
    expect(screen.getByText("Booking")).toBeInTheDocument();
    expect(await accessibilityProblems(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Start sprint" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Start Sprint 4?" });
    expect(dialog).toHaveTextContent("commits to 3 stories (10 points) for 14 days");
    await user.click(within(dialog).getByRole("button", { name: "Start sprint" }));
    await waitFor(() => expect(requests.some((request) => request.method === "POST" && request.url.endsWith("/sprints/TUTOR-S4/start"))).toBe(true));
  });

  it("estimates the sprint's stories with the effort service", async () => {
    const requests: { url: string; method: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(ACTIVE, requests));
    const { container } = renderSprint();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Estimate 3 stories" }));
    const heading = await screen.findByRole("heading", { name: "Results" });
    await waitFor(() => expect(heading).toHaveFocus());
    const sent = requests.find((request) => request.url.endsWith("/effort-estimation/risk"))?.body;
    expect(sent).toMatchObject({
      project_id: "TUTOR",
      sprint_id: "TUTOR-S4",
      sprint_context: { length_days: 14, capacity_points: 30 },
      stories: [{ story_id: "TUTOR-1" }, { story_id: "TUTOR-2", added_mid_sprint: true, days_into_sprint: 3 }, { story_id: "TUTOR-3" }],
    });
    expect(screen.getByRole("heading", { name: "Sprint risk" })).toBeInTheDocument();
    expect(screen.getByText(/Effort & Sprint Risk has this sprint/)).toBeInTheDocument();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});
