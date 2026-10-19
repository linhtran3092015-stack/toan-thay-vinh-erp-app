import type { BalanceImportPreviewProps } from "./imports-preview-params";

// Lane I3 replaces this body.
/** /dev/imports `view=balances` and `view=balance-batch` body (design 17c); rendered inside the AppShell by ImportsPreview. */
export function BalanceImportPreviewBody({ role, state, view }: BalanceImportPreviewProps) {
  return (
    <p className="text-body text-text-muted" data-role={role} data-state={state} data-view={view}>
      Đang dựng bản xem trước…
    </p>
  );
}
