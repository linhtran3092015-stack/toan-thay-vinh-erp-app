"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

export function ThemeToggle() {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [themeState, setThemeState] = useState<"light" | "dark" | null>(null);

  const currentTheme =
    themeState ??
    (isClient &&
    (document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark")
      ? "dark"
      : "light");

  const toggleTheme = () => {
    const nextTheme = currentTheme === "light" ? "dark" : "light";
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

  if (!isClient) {
    return (
      <button
        aria-label="Chuyển chế độ giao diện"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-ink-muted transition-colors hover:bg-surface-2"
        type="button"
      >
        <span className="text-base">☀️</span>
      </button>
    );
  }

  return (
    <button
      aria-label={
        currentTheme === "dark"
          ? "Chuyển sang Giao diện Sáng"
          : "Chuyển sang Giao diện Tối"
      }
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-ink transition-all hover:border-hairline-strong hover:bg-surface-2 active:scale-95"
      onClick={toggleTheme}
      title={
        currentTheme === "dark"
          ? "Giao diện Tối (Bật)"
          : "Giao diện Sáng (Bật)"
      }
      type="button"
    >
      <span className="text-base transition-transform duration-200">
        {currentTheme === "dark" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
