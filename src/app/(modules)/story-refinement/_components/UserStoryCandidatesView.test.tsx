import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserStoryCandidatesView } from "./UserStoryCandidatesView";

describe("UserStoryCandidatesView", () => {
  it("compares three candidates and recommends the highest-scoring option", () => {
    render(<UserStoryCandidatesView initialRequirementId="REQ-104" />);

    expect(screen.getByText("Candidate 1")).toBeInTheDocument();
    expect(screen.getByText("Candidate 2")).toBeInTheDocument();
    expect(screen.getByText("Candidate 3")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("Recommended because this candidate has the highest overall quality score and fewer unsupported assumptions.")).toBeInTheDocument();
    expect(screen.getByText(/Students already have an account/)).toBeInTheDocument();
    expect(screen.getAllByText("Clarity", { exact: true })).toHaveLength(3);
    expect(screen.getAllByText(/Overall Quality Score/)).toHaveLength(3);
  });

  it("links a selected candidate to refinement with both IDs", () => {
    render(<UserStoryCandidatesView initialRequirementId="REQ-104" />);

    expect(screen.getAllByRole("link", { name: /Select Candidate/ })[0]).toHaveAttribute(
      "href",
      "/story-refinement?requirementId=REQ-104&candidateId=REQ-104-S1",
    );
  });

  it("supports local edits and individual mock regeneration", async () => {
    render(<UserStoryCandidatesView initialRequirementId="REQ-104" />);

    const firstCandidate = screen.getByText("Candidate 1").closest('[data-slot="card"]') as HTMLElement | null;
    expect(firstCandidate).not.toBeNull();
    fireEvent.click(within(firstCandidate!).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(firstCandidate!).getByRole("textbox", { name: "Edit Candidate 1 story" }), {
      target: { value: "As a student, I want to review a candidate before selecting it." },
    });
    fireEvent.click(within(firstCandidate!).getByRole("button", { name: "Save Edit" }));
    expect(screen.getByText("As a student, I want to review a candidate before selecting it.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Regenerate Candidate 2" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Candidate 2 regenerated."));
    expect(screen.getByText("Candidate 1")).toBeInTheDocument();
  });
});