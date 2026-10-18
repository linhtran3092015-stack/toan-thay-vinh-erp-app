"use client";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { FinanceActionResultState } from "@/features/finance/forms/finance-action-types";
import type { PaymentRequestActionOverrides } from "@/features/finance/payment-request-action-overrides";
import { PaymentRequestDirectory } from "@/features/finance/payment-request-directory";
import { PAYMENT_REQUESTS_DENIED_TITLE } from "@/features/finance/payment-request-directory-models";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

import { cappedPaymentRequestFixtures, paymentRequestFixtures } from "./payment-request-fixtures";
import { sessionPreviewNowTime, sessionPreviewToday } from "./session-fixtures";

export type PaymentRequestsPreviewRole = "owner" | "ta" | "accountant";
export type PaymentRequestsPreviewState = "normal" | "capped" | "empty";

const STUB = "Bản xem trước không ghi dữ liệu.";

/** The fixture clock (16/10/2026 12:00 in Vietnam) as the route's `now`, for "chờ quá 14 ngày". */
export const paymentRequestPreviewNow = new Date(`${sessionPreviewToday}T${sessionPreviewNowTime}+07:00`).toISOString();

/**
 * Inert stand-in for every server action the list can reach ("Hủy phiếu"). The
 * preview runs on localhost where .env.local may point at production, so the
 * cancel dialog never reaches the real action: the stub answers with an error,
 * which keeps the dialog open and never refreshes.
 */
export const previewPaymentRequestActions: Required<PaymentRequestActionOverrides> = {
  cancelPaymentRequest: async (): Promise<FinanceActionResultState> => ({ message: STUB, status: "error" }),
};

/**
 * The route's flags per role (permission codes per the migrations, map-rules-data §D):
 * - owner: every code, so cancel, "Tạo yêu cầu" and profile links.
 * - accountant: `payments.view/manage/create_request` but not `students.view`, so
 *   cancel yes, no "Tạo yêu cầu" (the create page refuses without
 *   `students.view`) and no profile links. Names still show here; production
 *   would show the loader fallback "Học viên" unless the owner granted
 *   `students.view` (see the fixtures).
 */
const roleFlags: Record<Exclude<PaymentRequestsPreviewRole, "ta">, { canCancel: boolean; canCreate: boolean; canViewStudents: boolean }> = {
  accountant: { canCancel: true, canCreate: false, canViewStudents: false },
  owner: { canCancel: true, canCreate: true, canViewStudents: true },
};

/**
 * /dev/lists?view=payment-requests body (the controller wraps it in AppShell).
 * Fixed clock `sessionPreviewToday`; filter and page writes stay on `/dev/lists`
 * (the serializer keeps `view`/`role`/`state`). A teaching assistant holds no
 * payment code, so it gets the route's own denial.
 */
export function PaymentRequestsPreviewBody({ role, state }: { role: PaymentRequestsPreviewRole; state: PaymentRequestsPreviewState }) {
  if (role === "ta") {
    return <PermissionDeniedState description={permissionDeniedDescription("payments.view")} title={PAYMENT_REQUESTS_DENIED_TITLE} />;
  }

  const flags = roleFlags[role];
  const items = state === "empty" ? [] : state === "capped" ? cappedPaymentRequestFixtures : paymentRequestFixtures;

  return (
    <PaymentRequestDirectory
      actions={previewPaymentRequestActions}
      basePath="/dev/lists"
      canCancelPaymentRequests={flags.canCancel}
      canCreatePaymentRequests={flags.canCreate}
      canViewStudents={flags.canViewStudents}
      items={items}
      now={paymentRequestPreviewNow}
      today={sessionPreviewToday}
    />
  );
}
