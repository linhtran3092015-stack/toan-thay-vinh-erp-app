import type { TimeEntryMode } from "@/features/timekeeping/types";

/** localStorage key for the mode of the last successful check-in/out. */
export const LAST_MODE_STORAGE_KEY = "timekeeping.lastMode";

/**
 * The remembered mode, or null when nothing (valid) is stored or storage is
 * unavailable. Remembering is a convenience: a failure only loses the default.
 */
export function readRememberedTimekeepingMode(): TimeEntryMode | null {
  try {
    const stored = window.localStorage.getItem(LAST_MODE_STORAGE_KEY);
    return stored === "online" || stored === "offline" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Called only after the server accepted a check-in/out, so the topbar pill and
 * the dashboard strip (which open the same sheet) default to a mode that was
 * actually used, not to one someone merely tapped.
 */
export function rememberTimekeepingMode(mode: TimeEntryMode): void {
  try {
    window.localStorage.setItem(LAST_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}
