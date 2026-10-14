/**
 * What the /finance/sepay screen may offer, from the viewer's permission codes.
 * The page gates on sepay.view before calling this; the server actions re-check.
 */
export interface SepayScreenAccess {
  /** sepay.allocate or payments.manage: manual allocation and suggestions. */
  canAllocate: boolean;
  /** Allocation, payments.manage or history sync: the reconciliation dialog. */
  canReconcile: boolean;
  /** payments.manage: undo a matched or allocated transaction. */
  canReverse: boolean;
  /** sepay.sync_history.manage: history sync panel and receiving accounts read. */
  canSyncHistory: boolean;
}

export function getSepayScreenAccess(permissions: readonly string[]): SepayScreenAccess {
  const canSyncHistory = permissions.includes("sepay.sync_history.manage");
  const canAllocate = permissions.includes("sepay.allocate") || permissions.includes("payments.manage");
  return {
    canAllocate,
    canReconcile: canSyncHistory || canAllocate,
    canReverse: permissions.includes("payments.manage"),
    canSyncHistory,
  };
}
