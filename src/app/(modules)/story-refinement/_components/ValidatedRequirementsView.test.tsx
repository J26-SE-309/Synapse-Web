import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValidatedRequirementsView } from "./ValidatedRequirementsView";

describe("ValidatedRequirementsView", () => {
  it("searches validated requirement IDs and text", () => {
    render(<ValidatedRequirementsView />);

    fireEvent.change(screen.getByLabelText("Search requirements"), { target: { value: "REQ-129" } });

    expect(screen.getByText("REQ-129")).toBeInTheDocument();
    expect(screen.queryByText("REQ-104")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1 requirements")).toBeInTheDocument();
  });

  it("filters by Component 1 validation status and quality band", () => {
    render(<ValidatedRequirementsView />);

    fireEvent.change(screen.getByLabelText("Validation status"), { target: { value: "Validated with notes" } });
    expect(screen.getByText("REQ-117")).toBeInTheDocument();
    expect(screen.getByText("REQ-141")).toBeInTheDocument();
    expect(screen.queryByText("REQ-104")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Validation status"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Quality score"), { target: { value: "high" } });
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.queryByText("88%")).not.toBeInTheDocument();
  });

  it("paginates the table and carries the selected requirement ID into refinement", () => {
    render(<ValidatedRequirementsView />);

    expect(screen.getByText("Showing 1–5 of 9 requirements")).toBeInTheDocument();
    const firstRow = screen.getByText("REQ-104").closest("tr");
    expect(firstRow).not.toBeNull();
    expect(within(firstRow!).getByRole("link", { name: /Refine User Story/ })).toHaveAttribute(
      "href",
      "/story-refinement/refine?requirementId=REQ-104",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 6–9 of 9 requirements")).toBeInTheDocument();
    expect(screen.getByText("REQ-173")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("REQ-104")).toBeInTheDocument();
  });
});