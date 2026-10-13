import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptanceCriteriaGeneratorView } from "./AcceptanceCriteriaGeneratorView";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/shared/projects/ProjectProvider", () => ({
  useProject: () => ({ project: { id: "SYN", name: "Synapse" } }),
}));

beforeEach(() => {
  window.localStorage.clear();
  mockPush.mockClear();
});

describe("AcceptanceCriteriaGeneratorView", () => {
  it("shows the selected story and generated Given-When-Then examples", () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);

    expect(screen.getByText("As a student, I want to book an available tutoring session, so that I can attend a lesson at a suitable time.")).toBeInTheDocument();
    expect(screen.getByText("Generated Acceptance Criteria")).toBeInTheDocument();
    expect(screen.getByText("AC1")).toBeInTheDocument();
    expect(screen.getByText(/the student selects the tutor, date, and time/)).toBeInTheDocument();
    expect(screen.getByText("AC2")).toBeInTheDocument();
    expect(screen.getAllByText("Draft")).toHaveLength(2);
    expect(screen.getAllByText("Testable")).toHaveLength(2);
    expect(screen.getByText("Requirement description")).toBeInTheDocument();
    expect(screen.getByText("Validation status")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByLabelText("Select validated requirement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Acceptance Criteria" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Regenerate AC1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete AC1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Criterion" })).toBeInTheDocument();
    expect(screen.getByText("Local Optimization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Optimize Acceptance Criteria" })).toBeInTheDocument();
    expect(screen.getByText(/No local LLM, semantic engine, external service, or automated quality score is running/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Story refinement workflow" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acceptance criteria/ })).toHaveAttribute("aria-current", "step");
  });

  it("allows editing, adding, deleting, and reviewing local analysis findings", async () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S1" />);

    const firstCriterion = screen.getByText("AC1").closest('[data-slot="card"]') as HTMLElement | null;
    expect(firstCriterion).not.toBeNull();
    fireEvent.click(within(firstCriterion!).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(firstCriterion!).getByLabelText("then"), { target: { value: "the booking is confirmed to the student" } });
    fireEvent.click(within(firstCriterion!).getByRole("button", { name: "Save" }));
    expect(screen.getByText("the booking is confirmed to the student")).toBeInTheDocument();
    expect(within(firstCriterion!).getByText("Human Verified")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Criterion" }));
    expect(screen.getByText("AC3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete AC2" }));
    expect(screen.queryByText("AC2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Optimize Acceptance Criteria" }));
    expect(await screen.findByText("Analysis findings")).toBeInTheDocument();
    expect(screen.getByText(/Quality · Completeness/)).toBeInTheDocument();
    expect(screen.getAllByText("Needs Human Decision").length).toBeGreaterThan(0);
    expect(screen.getByText(/Prototype checks completed/)).toBeInTheDocument();
  });

  it("generates requirement-specific scenarios beyond three generic criteria", async () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-129" initialCandidateId="REQ-129-S1" />);

    expect(screen.getByText("AC3")).toBeInTheDocument();
    expect(screen.getByText("Add an available time slot")).toBeInTheDocument();
    expect(screen.getByText("Remove an unbooked time slot")).toBeInTheDocument();
    expect(screen.getByText("Protect a slot with an existing booking")).toBeInTheDocument();
    expect(screen.getAllByText("Business Rule").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Regenerate AC3" }));
    expect(await screen.findByText("AC3 regenerated from the selected requirement.")).toBeInTheDocument();
  });

  it("supports the banking example without inventing unapproved bank policy", () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-BANK-001" initialCandidateId="REQ-BANK-001-S1" />);

    expect(screen.getByText("An authenticated customer can transfer money from their bank account to another valid account, provided the account has sufficient available funds and the transfer complies with the bank's rules.")).toBeInTheDocument();
    expect(screen.getByText("As a banking customer, I want to transfer money to another bank account, so that I can make payments conveniently and securely.")).toBeInTheDocument();
    expect(screen.getByText("Not supplied")).toBeInTheDocument();
    expect(screen.getByText("Banking and money transfers")).toBeInTheDocument();
    expect(screen.getAllByText(/^AC\d+$/)).toHaveLength(5);
    expect(screen.getByText("Successful transfer")).toBeInTheDocument();
    expect(screen.getByText("Validate transfer amount")).toBeInTheDocument();
    expect(screen.queryByText("Prevent duplicate processing")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply configured transfer limits")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Confirm .*rules with the bank|Confirm which destination-account types/)).toHaveLength(2);
  });

  it("shows analysis and a comparison after optimizing the banking criteria", () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-BANK-001" initialCandidateId="REQ-BANK-001-S1" />);
    fireEvent.change(screen.getByLabelText("Reviewer feedback for this optimization"), {
      target: { value: "Confirm transfer threshold and transaction idempotency policy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Optimize Acceptance Criteria" }));

    expect(screen.getByText(/Prototype checks completed/)).toBeInTheDocument();
    expect(screen.getByText(/Security and validation/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported-assumption detection/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewer feedback: Confirm transfer threshold/)).toBeInTheDocument();
    expect(screen.getByText("Original and optimized comparison")).toBeInTheDocument();
    expect(screen.getByText("Show complete original and optimized sets")).toBeInTheDocument();
    expect(screen.queryByText(/validated successfully/i)).not.toBeInTheDocument();
  });

  it("saves edited criteria and continues to the existing review flow", async () => {
    render(<AcceptanceCriteriaGeneratorView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledOnce());
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/story-refinement\/review\?requirementId=REQ-104&candidateId=REQ-104-S2&resumeId=criteria-\d+$/);
    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved[0].draft.acceptanceCriteria[0].id).toBe("AC1");
    expect(saved[0].selectedCandidateId).toBe("demo-REQ-104-candidate-2");
  });
});