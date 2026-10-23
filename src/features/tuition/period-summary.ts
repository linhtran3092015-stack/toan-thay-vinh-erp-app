/**
 * Pure read model for the tuition period list and period page (design 07,
 * frames 7a/7b): one row per student's current item (a reissued item replaces
 * its original, never adds to it) and the period's collection totals derived
 * from the payment requests created when the period was locked.
 *
 * The period itself only knows draft | locked; "thu 74%", "Quá hạn · N HS" and
 * "Hoàn tất" are derived here from the payment requests, never stored.
 */
import { getPaymentRemaining } from "@/features/classes/detail/class-tuition-models";
import { resolveReissueChains } from "@/features/tuition/reissue-chains";
import type { PermissionCode } from "@/lib/permissions/types";
import { compareStudentNames } from "@/lib/student-order";

/** student_payment_requests RLS (split_finance_payment_permissions): any of these reads the requests. */
export const PAYMENT_READ_PERMISSIONS: readonly PermissionCode[] = ["finance.view", "payments.view", "payments.manage"];

export function canReadTuitionPayments(permissions: readonly string[]): boolean {
  return PAYMENT_READ_PERMISSIONS.some((code) => permissions.includes(code));
}

export type TuitionPaymentRequestStatus = "pending" | "partially_paid" | "paid" | "cancelled" | "expired";

const paymentRequestStatuses: readonly TuitionPaymentRequestStatus[] = ["pending", "partially_paid", "paid", "cancelled", "expired"];

/**
 * A request still in force: counted as payable and collected. Cancelled,
 * expired and unknown statuses are left out everywhere tuition progress is
 * shown (period list, period page, home dashboard).
 */
export function isTuitionRequestInForce(status: string | null | undefined): boolean {
  return status === "pending" || status === "partially_paid" || status === "paid";
}

interface PaymentRequestRelation {
  expected_amount_vnd: number | string;
  paid_amount_vnd: number | string;
  status: string;
}

/** tuition_collection_items as the read model selects them (payment_request only with payment permission). */
export interface TuitionPeriodItemQueryRow {
  id: string;
  payable_amount_vnd: number | string;
  payable_sessions?: number | null;
  payment_request?: PaymentRequestRelation | PaymentRequestRelation[] | null;
  period_id: string;
  reissued_from_item_id: string | null;
  student_id: string;
  student_snapshot?: {
    class_name?: string | null;
    current_grade?: number | null;
    full_name?: string | null;
    public_code?: string | null;
  } | null;
}

export interface TuitionItemPayment {
  expectedVnd: number;
  paidVnd: number;
  /** null when the database returned a status this screen does not know. */
  status: TuitionPaymentRequestStatus | null;
}

export interface TuitionPeriodItemRow {
  /** The current item: its notice, amount and payment request are the ones in force. */
  itemId: string;
  /** The first item of the chain (differs from itemId once reissued). */
  originalItemId: string;
  periodId: string;
  studentId: string;
  studentName: string;
  publicCode: string | null;
  /** Grade at lock time (snapshot); 0 when unknown, like the print controls expect. */
  grade: number;
  /** Class at lock time (snapshot). */
  className: string | null;
  payableSessions: number;
  payableAmountVnd: number;
  reissued: boolean;
  /** The current item's payment request; null = no request (nothing to pay) or not readable. */
  payment: TuitionItemPayment | null;
}

/** Current items only, one per student, sorted by name. */
export function toCurrentTuitionItemRows(items: readonly TuitionPeriodItemQueryRow[]): TuitionPeriodItemRow[] {
  return resolveReissueChains(items)
    .map(({ current, original }) => {
      const request = Array.isArray(current.payment_request) ? current.payment_request[0] ?? null : current.payment_request ?? null;
      const snapshot = current.student_snapshot ?? original.student_snapshot ?? null;
      const status = paymentRequestStatuses.find((value) => value === request?.status) ?? null;

      return {
        className: snapshot?.class_name ?? null,
        grade: Number(snapshot?.current_grade ?? 0) || 0,
        itemId: current.id,
        originalItemId: original.id,
        payableAmountVnd: Number(current.payable_amount_vnd),
        payableSessions: Number(current.payable_sessions ?? 0),
        payment: request ? { expectedVnd: Number(request.expected_amount_vnd), paidVnd: Number(request.paid_amount_vnd), status } : null,
        periodId: current.period_id,
        publicCode: snapshot?.public_code ?? null,
        reissued: current.id !== original.id,
        studentId: current.student_id,
        studentName: snapshot?.full_name ?? "Học sinh",
      } satisfies TuitionPeriodItemRow;
    })
    .sort((a, b) => compareStudentNames(a.studentName, b.studentName));
}

/**
 * Chip bucket of one row. `none` = nothing to pay (no request and no payable
 * amount: the opening credit covered the period). `unknown` = a payable amount
 * whose request could not be read, or a request status this screen does not
 * know: never shown as "nothing to pay" and never silently dropped.
 */
export type TuitionItemPaymentState = "paid" | "partial" | "unpaid" | "closed" | "none" | "unknown";

type PaymentStateInput = Pick<TuitionPeriodItemRow, "payment" | "payableAmountVnd">;

export function getTuitionItemPaymentState(row: PaymentStateInput): TuitionItemPaymentState {
  if (!row.payment) return row.payableAmountVnd > 0 ? "unknown" : "none";
  switch (row.payment.status) {
    case "paid":
      return "paid";
    case "partially_paid":
      return "partial";
    case "pending":
      return "unpaid";
    case "cancelled":
    case "expired":
      return "closed";
    default:
      return "unknown";
  }
}

/** Outstanding part of a row's request (cancelled and expired owe nothing). */
export function getTuitionItemRemaining(row: Pick<TuitionPeriodItemRow, "payment">): number {
  return row.payment && row.payment.status ? getPaymentRemaining({ ...row.payment, status: row.payment.status }) : 0;
}

/** Collected part of a row's request, capped at what was asked (overpayment becomes session credit elsewhere). */
export function getTuitionItemCollected(row: PaymentStateInput): number {
  const state = getTuitionItemPaymentState(row);
  if (!row.payment || (state !== "paid" && state !== "partial")) return 0;
  return Math.min(row.payment.paidVnd, row.payment.expectedVnd);
}

export type TuitionItemFilter = "all" | "paid" | "partial" | "unpaid" | "closed";

export type TuitionItemFilterCounts = Record<TuitionItemFilter, number>;

export function countTuitionItemFilters(rows: readonly TuitionPeriodItemRow[]): TuitionItemFilterCounts {
  const counts: TuitionItemFilterCounts = { all: rows.length, closed: 0, paid: 0, partial: 0, unpaid: 0 };
  for (const row of rows) {
    const state = getTuitionItemPaymentState(row);
    if (state !== "none" && state !== "unknown") counts[state] += 1;
  }
  return counts;
}

export function matchesTuitionItemFilter(row: TuitionPeriodItemRow, filter: TuitionItemFilter): boolean {
  return filter === "all" || getTuitionItemPaymentState(row) === filter;
}

export interface TuitionPeriodPaymentSummary {
  /** Current items: each student once, replacements included in place of their originals. */
  studentCount: number;
  /** Whether payment requests were read (finance.view / payments.view / payments.manage). */
  paymentsVisible: boolean;
  /**
   * Visible: expected amount of the requests still in force (cancelled and
   * expired excluded). Hidden: the current items' payable amounts.
   */
  payableVnd: number;
  /** 0 when payments are hidden. */
  collectedVnd: number;
  /** 0 when payments are hidden. */
  remainingVnd: number;
  /** `unknown`: payable rows whose request was unreadable or had an unknown status (left out of the amounts). */
  counts: { paid: number; partial: number; unpaid: number; closed: number; none: number; unknown: number };
  /** True once today is after the due date. */
  isPastDue: boolean;
  /** Past due: students and amount still owed. */
  overdueStudents: number;
  overdueVnd: number;
  /** Floor of collected / payable; null when nothing is payable or payments are hidden. */
  collectedPercent: number | null;
}

export function summarizeTuitionPeriodRows(
  rows: readonly TuitionPeriodItemRow[],
  options: { dueOn: string | null; paymentsVisible: boolean; today: string },
): TuitionPeriodPaymentSummary {
  const isPastDue = options.dueOn !== null && options.today > options.dueOn;
  const counts = { closed: 0, none: 0, paid: 0, partial: 0, unknown: 0, unpaid: 0 };
  let payableVnd = 0;
  let collectedVnd = 0;
  let remainingVnd = 0;
  let overdueStudents = 0;
  let overdueVnd = 0;

  for (const row of rows) {
    if (!options.paymentsVisible) {
      payableVnd += row.payableAmountVnd;
      continue;
    }
    const state = getTuitionItemPaymentState(row);
    counts[state] += 1;
    if (state === "closed" || state === "none" || state === "unknown" || !row.payment) continue;
    const remaining = getTuitionItemRemaining(row);
    const collected = getTuitionItemCollected(row);
    payableVnd += collected + remaining;
    collectedVnd += collected;
    remainingVnd += remaining;
    if (isPastDue && remaining > 0) {
      overdueStudents += 1;
      overdueVnd += remaining;
    }
  }

  return {
    collectedPercent: options.paymentsVisible && payableVnd > 0 ? Math.floor((collectedVnd / payableVnd) * 100) : null,
    collectedVnd,
    counts,
    isPastDue,
    overdueStudents,
    overdueVnd,
    payableVnd,
    paymentsVisible: options.paymentsVisible,
    remainingVnd,
    studentCount: rows.length,
  };
}

/** Text shown beside the real status badge of a locked period. */
export type TuitionPeriodProgress =
  | { kind: "hidden" }
  | { kind: "complete"; label: "Hoàn tất" }
  | { kind: "inactive"; label: "Không còn yêu cầu hiệu lực" }
  | { kind: "unknown"; label: string }
  | { kind: "overdue"; label: string; percent: number | null }
  | { kind: "collecting"; label: string; percent: number };

export function getTuitionPeriodProgress(summary: TuitionPeriodPaymentSummary): TuitionPeriodProgress {
  if (!summary.paymentsVisible) return { kind: "hidden" };
  if (summary.remainingVnd === 0) {
    // Rows whose request could not be read may still be owed: never "Hoàn tất".
    if (summary.counts.unknown > 0) return { kind: "unknown", label: `Chưa rõ ${summary.counts.unknown} yêu cầu` };
    // Nothing owed: complete only when something was actually collected, not
    // when every request was cancelled or expired.
    return summary.collectedVnd > 0 || summary.counts.paid > 0
      ? { kind: "complete", label: "Hoàn tất" }
      : { kind: "inactive", label: "Không còn yêu cầu hiệu lực" };
  }
  // The percentage covers readable requests only: say how many are unknown so it is not read as complete.
  const unknownSuffix = summary.counts.unknown > 0 ? ` · chưa rõ ${summary.counts.unknown}` : "";
  if (summary.overdueStudents > 0) return { kind: "overdue", label: `Quá hạn · ${summary.overdueStudents} HS${unknownSuffix}`, percent: summary.collectedPercent };
  const percent = summary.collectedPercent ?? 0;
  return { kind: "collecting", label: `thu ${percent}%${unknownSuffix}`, percent };
}
