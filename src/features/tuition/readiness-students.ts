import type { TuitionPreviewRow } from "./data";
import { summarizeTuitionPreview } from "./readiness";

/**
 * Per-student figures of a draft period as `lock_tuition_collection_period`
 * would compute them now (migration 20261012130100, lines 148-178), from the
 * preview rows alone. Pure and client-safe: the period page builds them on the
 * server, the readiness table and the /dev preview read them.
 *
 * - `exact`: what the lock would bill, as of page load.
 * - `upper_bound`: a negative opening balance. The lock subtracts sessions
 *   already pending on other periods' notices, which the preview does not
 *   return, so the debit part can only shrink.
 * - `unknown`: a rate the lock needs is missing (the lock is blocked anyway).
 */
export type TuitionPayableEstimate =
  | { kind: "exact"; amountVnd: number }
  | { kind: "upper_bound"; amountVnd: number }
  | { kind: "unknown" };

export interface TuitionLockFigures {
  /** B: the student's opening balance in sessions (identical on every row; negative = owed). */
  openingBalanceSessions: number;
  /** Distinct known rates in lock order (session date, then session id). */
  rates: number[];
  /** Enrollment classes in lock order; the first one is what the notice snapshot keeps. */
  classIds: string[];
  /** B ≥ N: the balance covers every session, so the lock creates no payment request. */
  noPayment: boolean;
  payable: TuitionPayableEstimate;
}

export interface TuitionRenewalAccount {
  accountNumber: string;
  bankCode: string;
}

/**
 * Read-only context shown beside a draft period's readiness table. Declared
 * here (client-safe) so the table can type its props without importing the
 * server-only loader in readiness-data.ts.
 */
export interface TuitionReadinessContext {
  /** Enrollment class names by id; `{}` without classes.view (RLS) or on a failed read. */
  classNames: Record<string, string>;
  /** Version the lock would snapshot if it ran now (latest by published_at); null = unknown. */
  templateVersion: number | null;
  /** The one active renewal account effective on `ends_on` (the lock's own rule); null when none, several or unknown. */
  renewalAccount: TuitionRenewalAccount | null;
}

/** `summarizeTuitionPreview` fields (unchanged derivation) plus the lock figures. */
export interface TuitionReadinessStudent extends TuitionLockFigures {
  studentId: string;
  /** N: preview rows, one per student × chargeable session ("lượt học"). */
  sessions: number;
  missingRateFrom: string | null;
  issues: string[];
}

/**
 * The lock walks a student's rows by `session_date`, then `class_session_id`.
 * PostgREST returns canonical lowercase uuids; a plain code-unit compare of
 * that form matches Postgres uuid ordering (not `localeCompare`).
 */
export function compareLockOrder(a: TuitionPreviewRow, b: TuitionPreviewRow): number {
  if (a.sessionDate !== b.sessionDate) return a.sessionDate < b.sessionDate ? -1 : 1;
  const left = a.classSessionId.toLowerCase();
  const right = b.classSessionId.toLowerCase();
  return left === right ? 0 : left < right ? -1 : 1;
}

/**
 * One student's rows → the lock formula:
 * C = max(B, 0) earliest rows are offset for free; the rest are billed at
 * their own rate; a negative B adds (−B) × the earliest row's rate.
 */
export function computeLockFigures(rows: readonly TuitionPreviewRow[]): TuitionLockFigures {
  const ordered = [...rows].sort(compareLockOrder);
  const sessions = ordered.length;
  // The lock reads min(opening_balance_sessions); the preview repeats the same value per row.
  const balance = sessions > 0 ? Math.min(...ordered.map((row) => row.openingBalanceSessions)) : 0;
  const rates: number[] = [];
  const classIds: string[] = [];
  for (const row of ordered) {
    if (row.unitPriceVnd !== null && !rates.includes(row.unitPriceVnd)) rates.push(row.unitPriceVnd);
    if (row.classId && !classIds.includes(row.classId)) classIds.push(row.classId);
  }

  const noPayment = balance >= sessions;
  const base = { classIds, noPayment, openingBalanceSessions: balance, rates };
  if (noPayment) return { ...base, payable: { amountVnd: 0, kind: "exact" } };

  const credit = Math.max(balance, 0);
  const billed = ordered.slice(credit);
  if (billed.some((row) => row.unitPriceVnd === null)) return { ...base, payable: { kind: "unknown" } };
  const sessionsAmount = billed.reduce((sum, row) => sum + (row.unitPriceVnd ?? 0), 0);
  if (balance >= 0) return { ...base, payable: { amountVnd: sessionsAmount, kind: "exact" } };
  // B < 0: no credit, so every row (the first included) has a known rate here.
  const firstRate = ordered[0].unitPriceVnd ?? 0;
  return { ...base, payable: { amountVnd: sessionsAmount + -balance * firstRate, kind: "upper_bound" } };
}

/** One entry per student in the preview, in `summarizeTuitionPreview` order. */
export function buildReadinessStudents(rows: readonly TuitionPreviewRow[]): TuitionReadinessStudent[] {
  const byStudent = new Map<string, TuitionPreviewRow[]>();
  for (const row of rows) {
    const list = byStudent.get(row.studentId);
    if (list) list.push(row);
    else byStudent.set(row.studentId, [row]);
  }
  return summarizeTuitionPreview([...rows]).map((student) => ({
    ...student,
    ...computeLockFigures(byStudent.get(student.studentId) ?? []),
  }));
}

export interface TuitionReadinessTotals {
  total: number;
  /** Students without any issue. */
  ready: number;
  /** Distinct students with at least one issue (the per-code counts overlap). */
  blocked: number;
  /** Students whose balance covers the period (B ≥ N). */
  noPayment: number;
  /** Students the lock would bill (B < N): one payment request each. */
  requestsAtLock: number;
  /** Σ exact and upper-bound amounts; incomplete while `unknown` > 0. */
  payableVnd: number;
  unknown: number;
  upperBound: number;
  /** False when a caller passed students without lock figures (e.g. bare summarizeTuitionPreview output). */
  hasFigures: boolean;
}

type ReadinessLike = Pick<TuitionReadinessStudent, "issues"> & Partial<TuitionLockFigures>;

export function summarizeReadinessStudents(students: readonly ReadinessLike[]): TuitionReadinessTotals {
  const totals: TuitionReadinessTotals = {
    blocked: 0,
    hasFigures: students.every((student) => student.payable !== undefined),
    noPayment: 0,
    payableVnd: 0,
    ready: 0,
    requestsAtLock: 0,
    total: students.length,
    unknown: 0,
    upperBound: 0,
  };
  for (const student of students) {
    if (student.issues.length > 0) totals.blocked += 1;
    else totals.ready += 1;
    if (student.noPayment === true) totals.noPayment += 1;
    if (student.noPayment === false) totals.requestsAtLock += 1;
    const payable = student.payable;
    if (!payable) continue;
    if (payable.kind === "unknown") totals.unknown += 1;
    else {
      totals.payableVnd += payable.amountVnd;
      if (payable.kind === "upper_bound") totals.upperBound += 1;
    }
  }
  return totals;
}
