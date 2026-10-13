import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationHistoryView } from "./GenerationHistoryView";
import { createDemoGeneration, MOCK_REQUIREMENTS } from "../_lib/mock-service";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

function seedHistory() {
  const base = createDemoGeneration(MOCK_REQUIREMENTS[0]);
  const earlier = {
    ...base,
    id: "generation-earlier",
    createdAt: "2026-09-20T10:00:00.000Z",
    status: "Draft" as const,
    draft: { ...base.draft, userStory: "Earlier story version for comparison." },
    reviewMetadata: {
      reviewer: "Prototype reviewer",
      decision: "Changes Requested" as const,
      decidedAt: "2026-09-20T10:30:00.000Z",
      persistence: "prototype" as const,
    },
  };
  const approved = {
    ...base,
    id: "generation-approved",
    createdAt: "2026-09-25T12:00:00.000Z",
    status: "Approved" as const,
    approvedAt: "2026-09-25T12:30:00.000Z",
    approvedDraft: base.draft,
    draft: { ...base.draft, userStory: "Approved version for review." },
  };
  window.localStorage.setItem("synapse.story-refinement.history.v1", JSON.stringify([approved, earlier]));
}

beforeEach(() => {
  window.localStorage.clear();
  mockPush.mockClear();
  seedHistory();
});

describe("GenerationHistoryView", () => {
  it("displays all requested generation metadata", () => {
    render(<GenerationHistoryView />);

    expect(screen.getByRole("heading", { name: "Generation History" })).toBeInTheDocument();
    expect(screen.getByText("generation-approved")).toBeInTheDocument();
    expect(screen.getAllByText("REQ-104").length).toBeGreaterThan(0);
    expect(screen.getAllByText("REQ-104-S1").length).toBeGreaterThan(0);
    expect(screen.getByText("Approved version for review.")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByText("Acceptance Criteria Count")).toBeInTheDocument();
    expect(screen.getByText(/Prototype decision: Changes Requested/)).toBeInTheDocument();
  });

  it("filters by requirement, status, date range, and quality band", () => {
    render(<GenerationHistoryView />);

    fireEvent.change(screen.getByLabelText("Requirement ID"), { target: { value: "REQ-104" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Draft" } });
    fireEvent.change(screen.getByLabelText("Generated from"), { target: { value: "2026-09-19" } });
    fireEvent.change(screen.getByLabelText("Quality score"), { target: { value: "high" } });

    expect(screen.getByText("generation-earlier")).toBeInTheDocument();
    expect(screen.queryByText("generation-approved")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 generations")).toBeInTheDocument();
  });

  it("compares two versions and restores a version into review", async () => {
    const user = userEvent.setup();
    render(<GenerationHistoryView />);

    await user.click(screen.getByRole("button", { name: "Actions for generation-approved" }));
    await user.click(await screen.findByRole("menuitem", { name: "Compare versions" }));
    expect(screen.getByText(/Select a second generation/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actions for generation-earlier" }));
    await user.click(await screen.findByRole("menuitem", { name: "Compare with selected" }));
    expect(screen.getByRole("heading", { name: "Compare saved versions" })).toBeInTheDocument();
    expect(screen.getAllByText("Earlier story version for comparison.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved version for review.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Actions for generation-earlier" }));
    await user.click(await screen.findByRole("menuitem", { name: "Restore version" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledOnce());
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/story-refinement\/review\?requirementId=REQ-104&candidateId=REQ-104-S1&resumeId=restore-\d+$/);
    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].status).toBe("Draft");
    expect(saved[0].draft.userStory).toBe("Earlier story version for comparison.");
  });

  it("provides view, evaluation, and acceptance-criteria actions for a saved version", async () => {
    const user = userEvent.setup();
    render(<GenerationHistoryView />);
    await user.click(screen.getByRole("button", { name: "Actions for generation-approved" }));

    expect(await screen.findByRole("menuitem", { name: "View" })).toHaveAttribute(
      "href",
      "/story-refinement/review?requirementId=REQ-104&candidateId=REQ-104-S1&resumeId=generation-approved",
    );
    expect(screen.getByRole("menuitem", { name: "View evaluation" })).toHaveAttribute(
      "href",
      "/story-refinement/evaluation?requirementId=REQ-104&candidateId=REQ-104-S1",
    );
    expect(screen.getByRole("menuitem", { name: "View acceptance criteria" })).toHaveAttribute(
      "href",
      "/story-refinement/acceptance-criteria?requirementId=REQ-104&candidateId=REQ-104-S1&resumeId=generation-approved",
    );
  });
});