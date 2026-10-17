"use client";

import type { AdvanceActionOverrides } from "@/features/advances/advance-action-overrides";
import { AdvanceListPage } from "@/features/advances/advance-list-page";
import type { AdvanceActionState } from "@/features/advances/forms/advance-action-types";

import { advancePreviewEntries, advancePreviewPeople } from "./advance-fixtures";
import { sessionPreviewToday } from "./session-fixtures";

export type AdvancesPreviewRole = "owner" | "ta" | "accountant";
export type AdvancesPreviewState = "normal" | "capped" | "empty";

const STUB = "Bản xem trước không ghi dữ liệu.";
const stub = async (): Promise<AdvanceActionState> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for every salary advance server action (request, review,
 * approve). The preview runs on localhost where .env.local may point at
 * production, so no dialog may reach a server action: each answers with the
 * stub message as an error, which keeps the dialog open and never refreshes.
 */
export const previewAdvanceActions: Required<AdvanceActionOverrides> = {
  approveSalaryAdvance: stub,
  requestSalaryAdvance: stub,
  reviewSalaryAdvance: stub,
};

/** The route's flags per role: owner holds every advance permission and payroll.view. */
const roleFlags: Record<
  AdvancesPreviewRole,
  { canApprove: boolean; canRequest: boolean; canReview: boolean; canViewPayroll: boolean }
> = {
  /** Kế toán: đối soát + gửi yêu cầu của mình; `payroll.view` like every role in the migrations. */
  accountant: { canApprove: false, canRequest: true, canReview: true, canViewPayroll: true },
  owner: { canApprove: true, canRequest: true, canReview: true, canViewPayroll: true },
  /** Trợ giảng: only requests, and the RPC returns only their own rows; `payroll.view` like every role. */
  ta: { canApprove: false, canRequest: true, canReview: false, canViewPayroll: true },
};

/**
 * /dev/lists?view=advances body (the controller wraps it in AppShell). Fixed
 * clock `sessionPreviewToday`. "capped" renders the same rows as "normal":
 * `get_salary_advances_dashboard` takes no limit, so the only cap is PostgREST
 * `max_rows` (1000 rows), which a fixture set would have to fill to show.
 */
export function AdvancesPreviewBody({ role, state }: { role: AdvancesPreviewRole; state: AdvancesPreviewState }) {
  const viewer = advancePreviewPeople[role];
  const scoped =
    role === "ta" ? advancePreviewEntries.filter((entry) => entry.staffId === viewer.id) : advancePreviewEntries;

  return (
    <AdvanceListPage
      actions={previewAdvanceActions}
      {...roleFlags[role]}
      entries={state === "empty" ? [] : scoped}
      today={sessionPreviewToday}
      viewerId={viewer.id}
    />
  );
}
