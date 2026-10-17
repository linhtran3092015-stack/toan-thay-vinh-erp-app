import { CommissionListPage } from "@/features/commissions/commission-list-page";

import { commissionEntries, ownCommissionEntries } from "./commission-fixtures";

export type CommissionsPreviewRole = "owner" | "ta" | "accountant";
export type CommissionsPreviewState = "normal" | "capped" | "empty";

/**
 * /commissions body for /dev/lists?view=commissions (the controller wraps it in
 * the AppShell). The page is read-only: it has no server action, so nothing
 * needs a stub.
 *
 * - owner: `commissions.manage`, every sale's rows, the Sale column and filter.
 * - ta / accountant: own rows only, no manage (the RPC scope `sale_owner_id =
 *   auth.uid()`). In production neither a TA nor the accountant holds
 *   `commissions.view` (the migrations grant it to the sales roles), so the real
 *   route shows "Không có quyền xem hoa hồng Sale"; the preview still shows the
 *   own-scope view a sale without manage gets, to check that layout.
 * - capped: the rows fill the limit (passed as `limit`), so the header names the
 *   cap and picking the oldest month (08/2026) shows the "có thể chưa đủ" notice.
 * - empty: the in-frame empty state.
 */
export function CommissionsPreviewBody({
  role,
  state,
}: {
  role: CommissionsPreviewRole;
  state: CommissionsPreviewState;
}) {
  const canManage = role === "owner";
  const scoped = canManage ? commissionEntries : ownCommissionEntries;
  const entries = state === "empty" ? [] : scoped;

  return (
    <CommissionListPage
      canManage={canManage}
      entries={entries}
      limit={state === "capped" ? entries.length : undefined}
    />
  );
}
