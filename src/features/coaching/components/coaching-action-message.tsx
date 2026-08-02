import type { CoachingManagementActionState } from "@/features/coaching/forms/coaching-action-types";

export function CoachingActionMessage({
  actionState,
}: {
  actionState: CoachingManagementActionState;
}) {
  if (actionState.status === "idle" || !actionState.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        actionState.status === "error"
          ? "rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm font-medium text-danger"
          : "rounded-md border border-success-border bg-success-bg px-3 py-2 text-sm font-medium text-success"
      }
      role="status"
    >
      {actionState.message}
    </p>
  );
}
