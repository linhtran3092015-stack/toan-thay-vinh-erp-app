"use client";

import { Moon, Sun } from "lucide-react";
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
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
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
        currentTheme === "dark"
          ? "Chuyển sang Giao diện Sáng"
          : "Chuyển sang Giao diện Tối"
      }
      className="flex h-11 w-11 items-center justify-center rounded-md text-text-strong transition-colors duration-150 hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
      onClick={toggleTheme}
      title={
        currentTheme === "dark"
          ? "Giao diện Tối (Bật)"
          : "Giao diện Sáng (Bật)"
      }
      type="button"
    >
      {currentTheme === "dark" ? (
        <Moon aria-hidden="true" size={20} strokeWidth={1.8} />
      ) : (
        <Sun aria-hidden="true" size={20} strokeWidth={1.8} />
      )}
    </button>
  );
}
