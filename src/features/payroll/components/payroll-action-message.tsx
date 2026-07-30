import type { PayrollActionState } from "@/features/payroll/forms/payroll-action-types";

export function PayrollActionMessage({
  actionState,
}: {
  actionState: PayrollActionState | null;
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
