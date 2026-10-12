"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

export type ThemeName = "light" | "dark";

/** Reads and toggles the html `dark` class/`data-theme` set by the root layout. */
export function useTheme(): { isClient: boolean; theme: ThemeName; toggle: () => void } {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [themeState, setThemeState] = useState<ThemeName | null>(null);

  const theme: ThemeName =
    themeState ??
    (isClient &&
    (document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark")
      ? "dark"
      : "light");

  const toggle = () => {
    const nextTheme: ThemeName = theme === "light" ? "dark" : "light";
    setThemeState(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  };

  return { isClient, theme, toggle };
}
