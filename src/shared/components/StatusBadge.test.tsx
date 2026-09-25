import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/shared/components/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["up", "Running"],
    ["down", "Not reachable"],
    ["unknown", "Checking…"],
  ] as const)("spells out the %s status instead of relying on colour", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
