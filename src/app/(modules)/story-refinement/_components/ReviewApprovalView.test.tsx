import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import { ReviewApprovalView } from "./ReviewApprovalView";

const { mockImportStories } = vi.hoisted(() => ({ mockImportStories: vi.fn() }));
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/shared/projects/ProjectProvider", () => ({
  useProject: () => ({ projectId: "SYN", project: { id: "SYN", name: "Synapse" } }),
}));

vi.mock("@/shared/backlog/api", () => ({
  useImportStories: () => ({ mutateAsync: mockImportStories, isPending: false }),
}));

beforeEach(() => {
  window.localStorage.clear();
  mockImportStories.mockReset();
});

describe("ReviewApprovalView", () => {
  it("shows the original requirement, generated story, criteria, evaluation, and assumptions", () => {
    render(<ReviewApprovalView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    expect(screen.getAllByText("Original Requirement").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A student can book an available tutoring session by selecting a tutor, date and time.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Generated User Story").length).toBeGreaterThan(0);
    expect(screen.getByText("AC1")).toBeInTheDocument();
    expect(screen.getByText("Quality Evaluation")).toBeInTheDocument();
    expect(screen.getByText("INVEST Checklist")).toBeInTheDocument();
    expect(screen.getAllByText("Not Assessed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recommended improvement:/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Students already have an account/)).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("requires explicit confirmation before saving an approved status", () => {
    render(<ReviewApprovalView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);

    fireEvent.change(screen.getByLabelText(/Reviewer name/), { target: { value: "Test Reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve User Story & Acceptance Criteria" }));
    expect(screen.getByText("Are you sure you want to approve this user story and acceptance criteria?")).toBeInTheDocument();
    expect(window.localStorage.getItem("synapse.story-refinement.history.v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.localStorage.getItem("synapse.story-refinement.history.v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Approve User Story & Acceptance Criteria" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));

    expect(screen.getByText("Approved", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve & Generate Sprint" })).toBeEnabled();
    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].status).toBe("Approved");
    expect(saved[0].approvedDraft.acceptanceCriteria).toHaveLength(2);
    expect(saved[0].approvedPackage.requirementId).toBe("REQ-104");
    expect(saved[0].approvedPackage.reviewer).toBe("Test Reviewer");
    expect(saved[0].reviewMetadata.persistence).toBe("prototype");
  });

  it("sends only the approved story and criteria to the sprint-planning integration", async () => {
    mockImportStories.mockResolvedValue({
      stories: [{ story_id: "SYN-101" }],
      sprint: null,
    });
    render(<ReviewApprovalView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);

    fireEvent.change(screen.getByLabelText(/Reviewer name/), { target: { value: "Test Reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve User Story & Acceptance Criteria" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Approval" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve & Generate Sprint" }));

    expect(await screen.findByText(/Approved story SYN-101 was added to the backlog/)).toBeInTheDocument();
    expect(mockImportStories).toHaveBeenCalledWith(expect.objectContaining({
      stories: [expect.objectContaining({
        title: "Book a tutoring session",
        description: "As a student, I want to book an available tutoring session, so that I can attend a lesson at a suitable time.",
        acceptance_criteria: expect.arrayContaining([
          expect.stringContaining("the student selects the tutor, date, and time"),
        ]),
      })],
      sprint: null,
    }));
    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].sprintIntegration.storyId).toBe("SYN-101");
  });

  it("saves edits as draft and records rejection without approval", () => {
    render(<ReviewApprovalView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Edit reviewed user story" }), {
      target: { value: "As a student, I want to review my booking before confirming it." },
    });
    const firstCriterion = screen.getByText("AC1").closest('[data-slot="card"]') as HTMLElement | null;
    expect(firstCriterion).not.toBeNull();
    fireEvent.click(within(firstCriterion!).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(firstCriterion!).getByLabelText("given"), {
      target: { value: "the student is logged in and ready to book" },
    });
    fireEvent.click(within(firstCriterion!).getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete AC2" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete criterion" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    let saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].status).toBe("Draft");
    expect(saved[0].draft.userStory).toBe("As a student, I want to review my booking before confirming it.");
    expect(saved[0].draft.acceptanceCriteria).toHaveLength(1);
    expect(saved[0].draft.acceptanceCriteria[0].given).toBe("the student is logged in and ready to book");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText("Reject this draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject draft" }));
    saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].status).toBe("Rejected");
    expect(saved[0].approvedAt).toBeUndefined();
    expect(saved[0].reviewMetadata.decision).toBe("Rejected");
  });

  it("blocks banking approval until flagged rules receive an explicit human decision", () => {
    render(<ReviewApprovalView initialRequirementId="REQ-BANK-001" initialCandidateId="REQ-BANK-001-S1" />);
    fireEvent.change(screen.getByLabelText(/Reviewer name/), { target: { value: "Bank reviewer" } });
    fireEvent.change(screen.getByLabelText(/Human decision notes/), { target: { value: "Product Owner confirmed the permitted transfer amount and eligible destination accounts." } });
    expect(screen.getByRole("button", { name: "Approve User Story & Acceptance Criteria" })).toBeDisabled();
    expect(screen.getAllByText(/record and save the approved decision before approval/i)).toHaveLength(2);

    for (const criterionId of ["AC3", "AC5"]) {
      const criterion = screen.getByText(criterionId).closest('[data-slot="card"]') as HTMLElement | null;
      expect(criterion).not.toBeNull();
      fireEvent.click(within(criterion!).getByRole("button", { name: "Edit" }));
      fireEvent.change(within(criterion!).getByLabelText(`Human decision ${criterionId}`), {
        target: { value: "Confirmed by the Product Owner for this prototype review." },
      });
      fireEvent.click(within(criterion!).getByRole("button", { name: "Save" }));
    }

    expect(screen.getByRole("button", { name: "Approve User Story & Acceptance Criteria" })).toBeEnabled();
    expect(screen.queryByText(/record and save the approved decision before approval/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Confirmed by the Product Owner for this prototype review.")).toHaveLength(2);
  });

  it("records a request for changes and returns to criteria editing", () => {
    render(<ReviewApprovalView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);
    fireEvent.change(screen.getByLabelText(/Reviewer name/), { target: { value: "Test Reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Request Changes" }));

    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].status).toBe("Draft");
    expect(saved[0].reviewMetadata.decision).toBe("Changes Requested");
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/story-refinement\/acceptance-criteria\?.*resumeId=demo-REQ-104$/));
  });
});