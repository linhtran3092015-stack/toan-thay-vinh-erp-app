/**
 * Pure models for the class page's tuition tab (design 03, step 5b part 2).
 * Owner decisions: the tab is read-only (payment requests are still created by
 * locking the period on the tuition-period page, which bills every class), and
 * each row shows only this class's part of the student's period charge.
 */

/**
 * Permissions behind the tuition tab: sessions.view tells this class's lines
 * apart on a locked period, students.view reads the names (students RLS). The
 * route and the period-switch action share them.
 */
export const CLASS_TUITION_PERMISSIONS = ["classes.view", "sessions.view", "students.view", "tuition_periods.view"] as const;

export interface ClassTuitionPeriodOption {
  dueOn: string | null;
  endsOn: string;
  id: string;
  name: string;
  startsOn: string;
  status: "draft" | "locked";
}

export interface ClassTuitionPayment {
  /** student_payment_requests.status */
  status: string;
  expectedVnd: number;
  paidVnd: number;
}

export interface ClassTuitionRow {
  studentId: string;
  fullName: string;
  publicCode: string | null;
  /** Chargeable sessions of this class in the period (locked: after the opening credit). */
  sessions: number;
  /** This class's part of the charge (draft: sessions × rate, before the opening credit). */
  amountVnd: number;
  /** Locked: the student's whole period charge, across classes and opening debt. */
  itemAmountVnd: number | null;
  /** Locked: the charge also holds other classes' sessions or an opening debt. */
  includesOtherCharges: boolean;
  /** Locked with payments.view: the payment request created when the period was locked. */
  payment: ClassTuitionPayment | null;
  /** Draft: session balance carried into the period (credit is used first when locking). */
  openingBalanceSessions: number | null;
  /** Draft: blocker codes that stop the period from locking. */
  blockers: string[];
  /** Locked: the student's item was reissued; amount and payment are the replacement's. */
  reissued?: boolean;
}

export interface ClassTuitionView {
  period: ClassTuitionPeriodOption;
  rows: ClassTuitionRow[];
  /** Whether payment columns were read (payments.view) for a locked period. */
  paymentsVisible: boolean;
}

export interface ClassTuitionTotals {
  amountVnd: number;
  remainingVnd: number;
  sessions: number;
  studentCount: number;
}

/** Outstanding part of a request; cancelled or expired requests owe nothing. */
export function getPaymentRemaining(payment: ClassTuitionPayment | null): number {
  if (!payment || (payment.status !== "pending" && payment.status !== "partially_paid")) return 0;
  return Math.max(payment.expectedVnd - payment.paidVnd, 0);
}

export function summarizeClassTuition(view: ClassTuitionView): ClassTuitionTotals {
  return view.rows.reduce<ClassTuitionTotals>(
    (totals, row) => ({
      amountVnd: totals.amountVnd + row.amountVnd,
      remainingVnd: totals.remainingVnd + getPaymentRemaining(row.payment),
      sessions: totals.sessions + row.sessions,
      // A student whose sessions were all covered by opening credit is not charged.
      studentCount: totals.studentCount + (row.sessions > 0 ? 1 : 0),
    }),
    { amountVnd: 0, remainingVnd: 0, sessions: 0, studentCount: 0 },
  );
}

/**
 * The period the tab opens on: the one covering today, else the latest that
 * already started, else the earliest upcoming. `periods` is newest first.
 */
export function pickDefaultTuitionPeriod(periods: readonly ClassTuitionPeriodOption[], today: string): ClassTuitionPeriodOption | null {
  return (
    periods.find((period) => period.startsOn <= today && period.endsOn >= today) ??
    periods.find((period) => period.startsOn <= today) ??
    periods.at(-1) ??
    null
  );
}

/** Shape the server action returns when the viewer switches period. */
export type ClassTuitionViewResult =
  | { status: "success"; view: ClassTuitionView }
  | { status: "error"; message: string };
