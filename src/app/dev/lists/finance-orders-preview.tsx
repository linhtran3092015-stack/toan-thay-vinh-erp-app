"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { FinanceOrderReviewActionResult } from "@/features/finance/actions/finance-actions";
import { FinanceOrdersPage } from "@/features/finance/components/finance-orders-page";
import type { FinanceOrderActionOverrides } from "@/features/finance/finance-order-action-overrides";
import { FINANCE_ORDERS_ACCESS } from "@/features/finance/finance-orders-models";
import { parseFinanceOrdersFilters } from "@/features/finance/finance-orders-url-state";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

import { financeOrderPreviewNow, financeOrderPreviewOrders, runFinanceOrdersPreviewRpc } from "./finance-order-fixtures";
import { sessionPreviewToday } from "./session-fixtures";

export type FinanceOrdersPreviewRole = "owner" | "ta" | "accountant";
export type FinanceOrdersPreviewState = "normal" | "capped" | "empty";

const STUB = "Bản xem trước không ghi dữ liệu.";
const stub = async (): Promise<FinanceOrderReviewActionResult> => ({ message: STUB, status: "error" });

/**
 * Inert stand-in for the only server action the orders page reaches (the
 * review tick). The preview runs on localhost where .env.local may point at
 * production: the stub answers with an error, so no override is recorded and
 * nothing refreshes.
 */
export const previewFinanceOrderActions: Required<FinanceOrderActionOverrides> = {
  setFinanceOrderReview: stub,
};

/**
 * /dev/lists?view=finance-orders body (the controller wraps it in AppShell).
 *
 * Filters come from the URL like the real route: the body parses the current
 * search params with the fixture clock (`sessionPreviewToday` → default month
 * 10/2026), runs the fixture "RPC" and the page writes back to `/dev/lists`
 * (`basePath`), keeping `view/role/state`.
 *
 * - owner: every code: review toggle (`payments.manage`) and student links (`students.view`).
 * - accountant: `finance.view` + `payments.manage` (review) but no `students.view`, so
 *   names show without profile links. Names stay visible in production too: the
 *   orders RPC is security definer, unlike the RLS-bound ledger and payment requests.
 * - ta: no finance code, so the route's real denial.
 * - capped: the same rows as normal: the RPC returns the whole filtered month (no row
 *   cap, no limit argument), so there is no truncated state to show.
 * - empty: a month without orders (in-frame empty state, settlement empty state).
 */
export function FinanceOrdersPreviewBody({
  role,
  state,
}: {
  role: FinanceOrdersPreviewRole;
  state: FinanceOrdersPreviewState;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(
    () => parseFinanceOrdersFilters(new URLSearchParams(query), financeOrderPreviewNow),
    [query],
  );
  const dashboard = useMemo(
    () => runFinanceOrdersPreviewRpc(state === "empty" ? [] : financeOrderPreviewOrders, filters),
    [filters, state],
  );

  if (role === "ta") {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription(FINANCE_ORDERS_ACCESS.permission)}
        title={FINANCE_ORDERS_ACCESS.deniedTitle}
      />
    );
  }

  return (
    <FinanceOrdersPage
      actions={previewFinanceOrderActions}
      basePath="/dev/lists"
      canReview
      canViewStudents={role === "owner"}
      dashboard={dashboard}
      filters={filters}
      today={sessionPreviewToday}
    />
  );
}
