import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModulePlaceholder } from "@/shared/components/ModulePlaceholder";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ModulePlaceholder", () => {
  it("shows the module, its owner and where to build it", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderWithQueryClient(<ModulePlaceholder slug="story-refinement" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("User Story Refinement");
    expect(screen.getByText("Owner: @lewkes")).toBeInTheDocument();
    expect(screen.getByText("src/app/(modules)/story-refinement/")).toBeInTheDocument();
    expect(screen.getByText("Checking…")).toBeInTheDocument();
  });

  it("reports the component as not reachable when the gateway is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderWithQueryClient(<ModulePlaceholder slug="traceability" />);
    expect(await screen.findByText("Not reachable")).toBeInTheDocument();
  });
});
