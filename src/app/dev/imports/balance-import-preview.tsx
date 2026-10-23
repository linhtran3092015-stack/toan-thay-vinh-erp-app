"use client";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SessionBalanceBatchDetailPage } from "@/features/imports/session-balances/session-balance-batch-detail-page";
import type { SessionBalanceImportActionOverrides } from "@/features/imports/session-balances/session-balance-import-action-overrides";
import { SessionBalanceImportPage } from "@/features/imports/session-balances/session-balance-import-page";
import type { SessionBalanceImportActionFailure } from "@/features/imports/session-balances/types";

import {
  BALANCE_PREVIEW_DRY_RUN,
  BALANCE_PREVIEW_MAPPING,
  BALANCE_PREVIEW_WORKBOOK,
  getBalancePreviewBatches,
  getBalancePreviewBatchHref,
  getBalancePreviewDetail,
} from "./balance-import-fixtures";
import {
  getImportsPreviewPermissions,
  IMPORTS_PREVIEW_TODAY,
  IMPORTS_PREVIEW_USERS,
  type BalanceImportPreviewProps,
} from "./imports-preview-params";

const STUB = "Bản xem trước không ghi dữ liệu.";
const stubFailure: SessionBalanceImportActionFailure = { code: "invalid_request", message: STUB, ok: false };

/**
 * Inert stand-ins for every server action the two session-balance pages can
 * reach. Writes (create, exclude, reconcile, approve, post) answer with the
 * stub message, so nothing is written and no `router.refresh`/`push` runs;
 * the dry run (a read-only check) answers with the fixture result so the
 * wizard can be walked to its review step.
 */
export const previewBalanceImportActions: Required<SessionBalanceImportActionOverrides> = {
  approveSessionBalanceImportBatch: async () => stubFailure,
  createSessionBalanceImportBatch: async () => stubFailure,
  dryRunSessionBalanceImport: async () => ({ data: BALANCE_PREVIEW_DRY_RUN, ok: true }),
  excludeSessionBalanceImportRow: async () => stubFailure,
  postSessionBalanceImportBatch: async () => stubFailure,
  reconcileSessionBalanceImportBatch: async () => stubFailure,
};

/** The /dev page of the session ledger (the posted batch's "Xem sổ buổi"). */
export const BALANCE_PREVIEW_LEDGER_HREF = "/dev/lists?view=session-ledger";

/**
 * /dev/imports `view=balances` (states file | review | list) and
 * `view=balance-batch` (reconcile | approve | approve-own | post | posted)
 * (design 17c); rendered inside the AppShell by ImportsPreview. The role's
 * permission codes decide what the route would pass: owner = import +
 * approve, maker = import only (cannot approve or post), viewer = the
 * route's denial. Every link stays under /dev.
 */
export function BalanceImportPreviewBody(props: BalanceImportPreviewProps) {
  const { role } = props;
  const permissions = getImportsPreviewPermissions(role);
  const canImport = permissions.includes("imports.session_balances");
  const canApprove = permissions.includes("imports.session_balances.approve");
  const currentUserId = IMPORTS_PREVIEW_USERS[role].id;

  if (!canImport && !canApprove) {
    return (
      <PermissionDeniedState
        description={
          props.view === "balances"
            ? "Tài khoản hiện tại không có quyền xem hoặc duyệt import số dư buổi."
            : "Tài khoản hiện tại không có quyền xem chi tiết batch import số dư."
        }
        title="Không có quyền truy cập"
      />
    );
  }

  if (props.view === "balances") {
    const seeded =
      props.state === "review"
        ? {
            initialDryRun: BALANCE_PREVIEW_DRY_RUN,
            initialMapping: BALANCE_PREVIEW_MAPPING,
            initialStep: "review" as const,
            initialWorkbook: BALANCE_PREVIEW_WORKBOOK,
          }
        : {};
    return (
      <SessionBalanceImportPage
        actions={previewBalanceImportActions}
        batches={props.state === "file" ? [] : getBalancePreviewBatches(role)}
        canApprove={canApprove}
        canImport={canImport}
        currentUserId={currentUserId}
        getBatchHref={(batchId) => getBalancePreviewBatchHref(batchId, role)}
        key={`${role}-${props.state}`}
        today={IMPORTS_PREVIEW_TODAY}
        {...seeded}
      />
    );
  }

  return (
    <SessionBalanceBatchDetailPage
      actions={previewBalanceImportActions}
      canApprove={canApprove}
      canReconcile={canImport}
      currentUserId={currentUserId}
      detail={getBalancePreviewDetail(props.state, role)}
      key={`${role}-${props.state}`}
      ledgerHref={BALANCE_PREVIEW_LEDGER_HREF}
      listHref={`/dev/imports?view=balances&state=list&role=${role}`}
    />
  );
}
