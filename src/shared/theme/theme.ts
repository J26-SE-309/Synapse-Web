"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DARK_QUERY, THEME_STORAGE_KEY } from "@/shared/theme/script";

/**
 * Light, dark, or whatever the operating system uses ("system", the default). The choice is a per-browser
 * convenience kept in localStorage. The inline script in the root layout (THEME_SCRIPT in script.ts) applies it
 * before the first paint, so a dark-mode user never sees a flash of the light page.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "dark" || (preference === "system" && systemIsDark()) ? "dark" : "light";
}

function apply(): void {
  const dark = resolve(readPreference()) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(listener: () => void): () => void {
  const onChange = () => {
    apply(); // the system switched, or another tab chose a theme
    listener();
  };
  const media = window.matchMedia(DARK_QUERY);
  listeners.add(listener);
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // storage blocked: the theme still changes for this page
  }
  apply();
  listeners.forEach((listener) => listener());
}

/** The chosen preference and the theme actually shown. On the server both are unknown: "system" and "light". */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => resolve(readPreference()),
    () => "light" as const,
  );
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);
  return { preference, resolvedTheme, setPreference };
}
