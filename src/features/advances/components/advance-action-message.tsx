import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";

export function AdvanceActionMessage({
  actionState,
}: {
  actionState: AdvanceActionState | null;
}) {
  if (!actionState?.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        actionState.status === "error"
          ? "rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
          : "rounded-md border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
      }
    >
      {actionState.message}
    </p>
  );
}
