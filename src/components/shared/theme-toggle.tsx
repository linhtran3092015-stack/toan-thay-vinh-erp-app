"use client";

import { Moon, Sun } from "lucide-react";
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

export function ThemeToggle() {
  const { isClient, theme, toggle } = useTheme();

  if (!isClient) {
    return (
      <button
        aria-label="Chuyển chế độ giao diện"
        className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        title="Chuyển chế độ giao diện"
        type="button"
      >
        <Sun aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <button
      aria-label={
        theme === "dark"
          ? "Chuyển sang Giao diện Sáng"
          : "Chuyển sang Giao diện Tối"
      }
      className="flex h-10 w-10 items-center justify-center rounded-md text-text-strong hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      onClick={toggle}
      title={
        theme === "dark"
          ? "Giao diện Tối (Bật)"
          : "Giao diện Sáng (Bật)"
      }
      type="button"
    >
      {theme === "dark" ? (
        <Moon aria-hidden="true" size={20} strokeWidth={1.8} />
      ) : (
        <Sun aria-hidden="true" size={20} strokeWidth={1.8} />
      )}
    </button>
  );
}
