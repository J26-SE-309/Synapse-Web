import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewProjectDialog } from "@/shared/projects/NewProjectDialog";
import { accessibilityProblems } from "@/test/axe";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog(onCreated = vi.fn(), existingIds: string[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NewProjectDialog open onOpenChange={() => {}} existingIds={existingIds} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return onCreated;
}

const created = { id: "TUTORING-APP", name: "Tutoring app", description: "", data_source: "platform", created_at: "2026-09-27T09:00:00Z" };

describe("NewProjectDialog", () => {
  it("suggests a key from the name and creates the project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(created), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const onCreated = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Tutoring app");
    expect(screen.getByLabelText("Project key")).toHaveValue("TUTORING-APP");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/v1/projects");
    expect(JSON.parse(init.body as string)).toEqual({ id: "TUTORING-APP", name: "Tutoring app", description: "" });
  });

  it("shows what is wrong on the field and sends nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderDialog(vi.fn(), ["TUTOR"]);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Project key"), "tutor");
    expect(screen.getByLabelText("Project key")).toHaveValue("TUTOR"); // typed in capitals
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Enter a name for the project.")).toBeInTheDocument();
    expect(screen.getByText("A project with this key already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus(); // the first problem takes the focus
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts the gateway's 'already exists' on the key", async () => {
    const conflict = { detail: "A project with the id 'TUTOR' already exists" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(conflict), { status: 409 })));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Tutor");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("A project with this key already exists.")).toBeInTheDocument();
  });

  it("says so when the gateway cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Tutor");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("The project was not created")).toBeInTheDocument();
    expect(screen.getByText(/Cannot reach the API gateway/)).toBeInTheDocument();
  });

  it("has no accessibility problems", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderDialog();
    expect(await accessibilityProblems(screen.getByRole("dialog"))).toEqual([]);
  });
});
