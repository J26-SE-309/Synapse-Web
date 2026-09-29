import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "@/shared/projects/ProjectProvider";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { accessibilityProblems } from "@/test/axe";
import { ACTIVE, story } from "@/test/backlog-fixtures";

import { BacklogView } from "./BacklogView";
import type { Sprint } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/backlog" }));

const PROJECT = { id: "TUTOR", name: "Tutoring app", description: "", data_source: "platform", created_at: "2026-09-10T09:00:00Z" };
const PLANNED: Sprint = {
  ...ACTIVE,
  sprint_id: "TUTOR-S5",
  name: "Sprint 5",
  status: "planned",
  started_at: null,
  planned_end: null,
  items: [],
  effort_sync: { status: "not_sent", sent_at: null, error: null },
};
const STORIES = [
  story("TUTOR-1", { title: "Book a session", epic: "Booking", priority: "Major", acceptance_criteria: ["Given a free slot, when I book it, then it is mine"] }),
  story("TUTOR-2", { title: "Pay for a session", status: "in_progress" }),
  story("TUTOR-7", { title: "Cancel a booking", sprint_id: null, rank: 7 }),
  story("TUTOR-8", { title: "Rate a tutor", sprint_id: null, rank: 8, issue_type: "Improvement" }),
];

function gateway(requests: { url: string; method: string; body?: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    requests.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith("/api/v1/projects")) return json([PROJECT]);
    if (url.endsWith("/projects/TUTOR/stories")) return json(STORIES);
    if (url.endsWith("/projects/TUTOR/sprints")) return json([PLANNED, ACTIVE]);
    if (method === "PATCH") return json({ ...STORIES[3], ...(init?.body ? JSON.parse(init.body as string) : {}) });
    if (url.includes("/predictions")) return json({ project_id: "TUTOR", predictions: [], next_offset: null });
    return json({ detail: "Not Found" }, 404);
  });
}

function renderBacklog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ProjectProvider initialProjectId="TUTOR">
          <BacklogView />
        </ProjectProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the backlog page", () => {
  it("shows the sprints above the ranked backlog, with a story's details beside the page", async () => {
    const requests: { url: string; method: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(requests));
    const { container } = renderBacklog();
    const user = userEvent.setup();

    const sprint = await screen.findByRole("list", { name: "Stories in Sprint 4" });
    expect(within(sprint).getByText("Book a session")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Stories in Sprint 5" })).toHaveTextContent("Drag stories here");
    const backlog = screen.getByRole("list", { name: "Stories in the backlog" });
    expect(within(backlog).getAllByRole("button", { name: /^Drag/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Drag TUTOR-7: Cancel a booking",
      "Drag TUTOR-8: Rate a tutor",
    ]);
    // 3 + 3 points against a capacity of 30
    expect(screen.getByText("6 of 30 points")).toBeInTheDocument();
    expect(await accessibilityProblems(container)).toEqual([]);

    await user.click(within(sprint).getByTitle("Book a session"));
    const details = await screen.findByRole("dialog", { name: "Book a session" });
    expect(within(details).getByText("Given a free slot, when I book it, then it is mine")).toBeInTheDocument();
    expect(within(details).getByText("Major priority")).toBeInTheDocument();
  });

  it("moves a story into a sprint from its menu, at the end of that sprint", async () => {
    const requests: { url: string; method: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", gateway(requests));
    renderBacklog();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Actions for TUTOR-8" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sprint 4 (active)" }));
    await waitFor(() => {
      const patch = requests.find((request) => request.method === "PATCH");
      expect(patch?.url).toMatch(/\/stories\/TUTOR-8$/);
      expect(patch?.body).toEqual({ sprint_id: "TUTOR-S4", rank: 3 });
    });
  });
});
