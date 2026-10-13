import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StoryRefinementWorkspace } from "./StoryRefinementWorkspace";
import { createDemoGeneration, MOCK_REQUIREMENTS, saveGeneration } from "../_lib/mock-service";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("@/shared/projects/ProjectProvider", () => ({
  useProject: () => ({ projectId: "SYN", project: { id: "SYN", name: "Synapse" } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  window.localStorage.clear();
  mockPush.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryRefinementWorkspace", () => {
  it("opens the requirement selected from the validated-requirements list", () => {
    render(<StoryRefinementWorkspace initialRequirementId="REQ-129" />);

    expect(screen.getAllByText(/REQ-129/).length).toBeGreaterThan(0);
    expect(screen.getByText("A tutor can add or remove available dates and time slots so students can book sessions that fit their schedule.")).toBeInTheDocument();
  });

  it("keeps the chosen candidate selected after mock generation", async () => {
    render(<StoryRefinementWorkspace initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate User Story" }));
    expect(await screen.findByText("Three candidates generated and saved to browser history. Review the evidence before approval.")).toBeInTheDocument();

    const selectedButton = screen.getByRole("button", { name: "Selected for review" });
    const candidateCard = selectedButton.closest('[data-slot="card"]') as HTMLElement | null;
    expect(candidateCard).not.toBeNull();
    expect(candidateCard).toHaveTextContent("REQ-104-S2");
  });

  it("restores criteria from the acceptance criteria generator into human review", async () => {
    const base = createDemoGeneration(MOCK_REQUIREMENTS[0]);
    const selectedCandidate = base.candidates[1];
    const criteria = [{
      id: "AC-01",
      given: "the student is logged in",
      when: "they submit the booking",
      then: "the booking is confirmed",
    }];
    saveGeneration({
      ...base,
      id: "criteria-resume-test",
      selectedCandidateId: selectedCandidate.id,
      draft: { userStory: selectedCandidate.userStory, acceptanceCriteria: criteria },
    });

    render(<StoryRefinementWorkspace initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" initialResumeId="criteria-resume-test" />);

    expect(await screen.findByText(/Acceptance criteria restored from the generator/)).toBeInTheDocument();
    expect(screen.getByLabelText("given", { selector: "textarea#AC-01-given" })).toHaveValue("the student is logged in");
    expect(screen.getByLabelText("User story")).toHaveValue(selectedCandidate.userStory);
  });

  it("shows multiple research candidates with rationales and assumptions", () => {
    render(<StoryRefinementWorkspace />);

    expect(screen.getByText(/ambiguity analysis is not repeated here/)).toBeInTheDocument();
    expect(screen.getByLabelText("User / Actor")).toBeInTheDocument();
    expect(screen.getByLabelText("Feature / Module")).toBeInTheDocument();
    expect(screen.getByLabelText("Business Goal")).toBeInTheDocument();
    expect(screen.getByLabelText("Related Requirements")).toBeInTheDocument();
    expect(screen.getByLabelText("Existing System Context")).toBeInTheDocument();
    expect(screen.getByLabelText("Additional Constraints")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate User Story" })).toBeInTheDocument();
    expect(document.getElementById("generated-story")).not.toBeInTheDocument();
  });

  it("shows the specified story after its loading state, with generation actions", async () => {
    render(<StoryRefinementWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Generate User Story" }));
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing context and generating user story...");
    expect(await screen.findAllByText("As a student, I want to book an available tutoring session, so that I can attend a lesson at a suitable time.", { selector: "blockquote" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare Candidates" })).toHaveAttribute(
      "href",
      "/story-refinement/candidates?requirementId=REQ-104",
    );
    expect(screen.getByRole("button", { name: "Generate Acceptance Criteria" })).toBeInTheDocument();
  });

  it("shows candidate assessments and assumptions after generation", async () => {
    render(<StoryRefinementWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Generate User Story" }));

    expect(await screen.findByText("Why this candidate scored this way")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Review this candidate/ })).toHaveLength(2);
    expect(screen.getAllByText("Unsupported Assumptions").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Generate Acceptance Criteria" })).toBeInTheDocument();
  });

  it("saves the selected and edited draft before opening human review", async () => {
    render(<StoryRefinementWorkspace />);
    fireEvent.change(screen.getByLabelText("Business Goal"), {
      target: { value: "Help students book tutoring" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate User Story" }));

    expect(await screen.findByText(/Three candidates generated and saved/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("1 saved")).toBeInTheDocument());
    expect(screen.getByLabelText("Business Goal")).toHaveValue("Help students book tutoring");
    fireEvent.click(screen.getByRole("button", { name: "Generate Acceptance Criteria" }));
    expect(await screen.findByLabelText("given", { selector: "textarea#AC1-given" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("User story"), {
      target: { value: "As a student, I want a reviewed booking flow, so I can plan my tutoring." },
    });
    fireEvent.change(screen.getByLabelText("given", { selector: "textarea#AC1-given" }), {
      target: { value: "the student is signed in" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Human Review & Approval" }));

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/story-refinement\/review\?requirementId=REQ-104&candidateId=REQ-104-S1&resumeId=generation-/));
    const saved = JSON.parse(window.localStorage.getItem("synapse.story-refinement.history.v1") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].projectId).toBe("SYN");
    expect(saved[0].context.businessGoal).toBe("Help students book tutoring");
    expect(saved[0].draft.userStory).toBe("As a student, I want a reviewed booking flow, so I can plan my tutoring.");
    expect(saved[0].draft.acceptanceCriteria[0].given).toBe("the student is signed in");
    expect(saved[0].status).toBe("Draft");
  });
});