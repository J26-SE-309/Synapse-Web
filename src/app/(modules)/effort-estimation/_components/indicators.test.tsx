import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfidenceIndicator, ReasonList, RiskBadge } from "./indicators";

describe("indicators", () => {
  it.each([
    ["low", "Low risk"],
    ["medium", "Medium risk"],
    ["high", "High risk"],
  ] as const)("spell out the %s risk level instead of relying on colour", (level, text) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("say when the risk is unknown", () => {
    render(<RiskBadge level={null} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("show the confidence band in words with its score", () => {
    render(<ConfidenceIndicator level="medium" score={0.42} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("(42%)")).toBeInTheDocument();
  });

  it("say which way each factor pushes the risk, for screen readers too", () => {
    render(
      <ReasonList
        reasons={[
          { factor: "Requirement ambiguity", direction: "increases", weight: 0.4 },
          { factor: "Team history", direction: "decreases", weight: 0.1 },
        ]}
      />,
    );
    expect(screen.getByText("(raises the risk)")).toBeInTheDocument();
    expect(screen.getByText("(lowers the risk)")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
