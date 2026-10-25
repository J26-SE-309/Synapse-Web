import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserStoryQualityEvaluationView } from "./UserStoryQualityEvaluationView";
import { createDemoGeneration, MOCK_REQUIREMENTS } from "../_lib/mock-service";

describe("UserStoryQualityEvaluationView", () => {
  it("evaluates the selected story and displays quality, INVEST, assumptions, and recommendations", () => {
    render(<UserStoryQualityEvaluationView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    expect(screen.getByText(/REQ-104-S2/)).toBeInTheDocument();
    expect(screen.getByText("As a student, I need to book an available tutoring session so I can achieve the intended outcome.")).toBeInTheDocument();
    expect(screen.getByLabelText("Clarity score")).toHaveAttribute("aria-valuenow", "82");
    expect(screen.getByLabelText("Completeness score")).toHaveAttribute("aria-valuenow", "76");
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(screen.getAllByText("Not Assessed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Warning").length).toBeGreaterThan(0);
    expect(screen.getByText(/Students already have an account/)).toBeInTheDocument();
    expect(screen.getByText("Define what happens when no session is available.")).toBeInTheDocument();
    expect(screen.getByText(/final decision belongs to the human reviewer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Optimize User Story" })).toBeInTheDocument();
  });


  it("links Improve User Story back to the same selected requirement and candidate", () => {
    render(<UserStoryQualityEvaluationView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    expect(screen.getByRole("link", { name: "Improve User Story" })).toHaveAttribute(
      "href",
      "/story-refinement?requirementId=REQ-104&candidateId=REQ-104-S2",
    );
  });

  it("optimizes a selected story using only validated requirement fields", () => {
    render(<UserStoryQualityEvaluationView initialRequirementId="REQ-104" initialCandidateId="REQ-104-S2" />);

    fireEvent.click(screen.getByRole("button", { name: "Optimize User Story" }));

    expect(screen.getByText("As a student, I want to book an available tutoring session, so that I can attend a lesson at a suitable time.")).toBeInTheDocument();
    expect(screen.getByText(/using only the validated requirement/)).toBeInTheDocument();
  });

  it("flags unresolved bank policy assumptions instead of showing an empty assessment", () => {
    expect(createDemoGeneration(MOCK_REQUIREMENTS.find((item) => item.id === "REQ-BANK-001")!).candidates[0].unsupportedAssumptions).toHaveLength(1);
    render(<UserStoryQualityEvaluationView initialRequirementId="REQ-BANK-001" initialCandidateId="REQ-BANK-001-S1" />);

    expect(screen.queryByText("No unsupported assumptions detected in the current mock assessment.")).not.toBeInTheDocument();
  });
});