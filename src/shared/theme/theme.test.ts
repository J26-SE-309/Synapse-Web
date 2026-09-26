import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_SCRIPT, THEME_STORAGE_KEY } from "@/shared/theme/script";
import { setThemePreference } from "@/shared/theme/theme";

function prefersDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("theme", () => {
  it("follows the system until someone chooses", () => {
    prefersDark(true);
    new Function(THEME_SCRIPT)();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    prefersDark(false);
    new Function(THEME_SCRIPT)();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("keeps a chosen theme over the system's, and forgets it for 'system'", () => {
    prefersDark(true);
    setThemePreference("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    new Function(THEME_SCRIPT)(); // as on the next page load
    expect(document.documentElement).not.toHaveClass("dark");

    setThemePreference("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).toHaveClass("dark");
  });
});
