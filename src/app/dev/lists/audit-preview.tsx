"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AuditLogPage } from "@/features/audit/audit-log-page";
import { AUDIT_LOG_ACCESS, parseAuditFilters } from "@/features/audit/audit-log-models";
import { permissionDeniedDescription } from "@/lib/permissions/labels";
import type { PermissionCode } from "@/lib/permissions/types";

import { auditPreviewRows, cappedAuditPreviewRows, runAuditPreviewQuery } from "./audit-fixtures";
import type { ListsPreviewRole, ListsPreviewState } from "./lists-preview";

/** Where the preview's GET filter form and "Xóa lọc" go: never the production-backed /audit route. */
export const AUDIT_PREVIEW_FORM_ACTION = "/dev/lists";

/** The params the form and "Xóa lọc" keep besides the seven filters: `view`, + `role`/`state` when not the default. */
export function getAuditPreviewHiddenParams(
  role: ListsPreviewRole,
  state: ListsPreviewState,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (role !== "owner") params.role = role;
  if (state !== "normal") params.state = state;
  params.view = "audit";
  return params;
}

/**
 * /dev/lists?view=audit body (the controller wraps it in AppShell): the real
 * AuditLogPage over a fixture copy of `getAuditLogsResult`. Filters come from
 * the URL like the real route: a form submit is a full GET to /dev/lists
 * (`formAction`), keeping `view` (+ `role`/`state` when not the default) as
 * hidden inputs, and the body parses the current search params with
 * `parseAuditFilters`. The page has no server action, so nothing needs a stub;
 * the only client state is the before/after disclosures.
 *
 * The gate is the route's: the shell's `permissions` must hold `audit.view`
 * (owner-only per the migrations, so the owner gets the log and the TA and
 * the accountant the route's own denial); `role` only travels in the params.
 * - capped: 1.240 matching rows, the newest 100 shown (+ "Thu hẹp bộ lọc…").
 * - empty: no row at all (the in-frame "Chưa có nhật ký").
 */
export function AuditPreviewBody({
  permissions,
  role,
  state,
}: {
  permissions: readonly PermissionCode[];
  role: ListsPreviewRole;
  state: ListsPreviewState;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const model = useMemo(
    () =>
      runAuditPreviewQuery(
        state === "empty" ? [] : state === "capped" ? cappedAuditPreviewRows : auditPreviewRows,
        parseAuditFilters(new URLSearchParams(query)),
      ),
    [query, state],
  );

  if (!permissions.includes(AUDIT_LOG_ACCESS.permission)) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription(AUDIT_LOG_ACCESS.permission)}
        title={AUDIT_LOG_ACCESS.deniedTitle}
      />
    );
  }

  return (
    <AuditLogPage
      formAction={AUDIT_PREVIEW_FORM_ACTION}
      hiddenParams={getAuditPreviewHiddenParams(role, state)}
      model={model}
    />
  );
}
