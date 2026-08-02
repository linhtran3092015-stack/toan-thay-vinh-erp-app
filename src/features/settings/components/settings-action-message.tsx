import type { SettingsActionState } from "@/features/settings/action-types";
import { cn } from "@/lib/utils";

export function SettingsActionMessage({
  state,
}: {
  state: SettingsActionState;
}) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-medium leading-5",
        state.status === "success"
          ? "border-success-border bg-success-bg text-success"
          : "border-danger-border bg-danger-bg text-danger",
      )}
      role="status"
    >
      {state.message}
    </p>
  );
}
