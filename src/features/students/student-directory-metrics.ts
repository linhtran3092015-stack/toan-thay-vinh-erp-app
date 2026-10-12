import { isSessionAttendanceStatus } from "@/features/sessions/detail-read-models";

/**
 * Per-student columns of the students directory (design 06): attendance rate,
 * session balance and open tuition debt. Pure helpers only; the loader lives in
 * `data.ts`. A column the viewer may not read, or whose query failed, carries no
 * values at all so the table shows "—" with the reason instead of a false 0.
 */

/** Attendance rate covers sessions dated within this many days, today included. */
export const STUDENT_ATTENDANCE_WINDOW_DAYS = 30;

export type StudentDirectoryMetricUnavailableReason = "forbidden" | "failed";

export type StudentDirectoryMetricColumn<T> =
  | { status: "ready"; byStudentId: Record<string, T> }
  | { status: "unavailable"; reason: StudentDirectoryMetricUnavailableReason };

export interface StudentDirectoryMetrics {
  /** Percent over main sessions in the window; a student without any is absent. */
  attendanceRate: StudentDirectoryMetricColumn<number>;
  /** Ledger balance; a student without ledger entries is absent (balance 0). */
  balanceSessions: StudentDirectoryMetricColumn<number>;
  /** Expected minus paid over pending and partially paid requests; absent = no debt. */
  outstandingVnd: StudentDirectoryMetricColumn<number>;
}

export const unavailableStudentDirectoryMetrics: StudentDirectoryMetrics = {
  attendanceRate: { reason: "forbidden", status: "unavailable" },
  balanceSessions: { reason: "forbidden", status: "unavailable" },
  outstandingVnd: { reason: "forbidden", status: "unavailable" },
};

export interface DirectoryAttendanceRow {
  attendance_status: string;
  student_id: string;
}

/**
 * Same rate as the profile: present / (present + excused + unexcused).
 * Additional study is extra, never part of the rate; unknown statuses are skipped.
 */
export function summarizeDirectoryAttendance(rows: readonly DirectoryAttendanceRow[]): Record<string, number> {
  const tallies = new Map<string, { main: number; present: number }>();

  for (const row of rows) {
    if (!isSessionAttendanceStatus(row.attendance_status) || row.attendance_status === "additional_study") {
      continue;
    }

    const tally = tallies.get(row.student_id) ?? { main: 0, present: 0 };
    tally.main += 1;
    if (row.attendance_status === "present") tally.present += 1;
    tallies.set(row.student_id, tally);
  }

  const rates: Record<string, number> = {};

  for (const [studentId, tally] of tallies) {
    rates[studentId] = Math.round((tally.present / tally.main) * 100);
  }

  return rates;
}

export interface DirectoryPaymentRequestRow {
  expected_amount_vnd: number | string;
  paid_amount_vnd: number | string;
  status: string;
  /** Requests not tied to a student carry no directory debt. */
  student_id: string | null;
}

/** Open debt per student, matching `summarizePaymentRequests` on the profile. */
export function summarizeDirectoryDebt(rows: readonly DirectoryPaymentRequestRow[]): Record<string, number> {
  const debt: Record<string, number> = {};

  for (const row of rows) {
    if (!row.student_id || (row.status !== "pending" && row.status !== "partially_paid")) {
      continue;
    }

    const outstanding = Math.max(Number(row.expected_amount_vnd) - Number(row.paid_amount_vnd), 0);

    if (outstanding > 0) {
      debt[row.student_id] = (debt[row.student_id] ?? 0) + outstanding;
    }
  }

  return debt;
}

export type StudentDirectoryMetricCell =
  | { kind: "value"; value: number }
  | { kind: "empty"; reason: string }
  | { kind: "unavailable"; reason: string };

const unavailableCopy: Record<keyof StudentDirectoryMetrics, Record<StudentDirectoryMetricUnavailableReason, string>> = {
  attendanceRate: {
    failed: "Không tải được dữ liệu điểm danh",
    forbidden: "Không có quyền xem điểm danh",
  },
  balanceSessions: {
    failed: "Không tải được số dư buổi",
    forbidden: "Không có quyền xem số dư buổi",
  },
  outstandingVnd: {
    failed: "Không tải được công nợ",
    forbidden: "Không có quyền xem công nợ",
  },
};

/** Resolves one cell: a value, "no data in the window", or why the column is blank. */
export function getStudentDirectoryMetricCell(
  metrics: StudentDirectoryMetrics,
  key: keyof StudentDirectoryMetrics,
  studentId: string,
): StudentDirectoryMetricCell {
  const column = metrics[key];

  if (column.status === "unavailable") {
    return { kind: "unavailable", reason: unavailableCopy[key][column.reason] };
  }

  const value = column.byStudentId[studentId];

  if (value !== undefined) {
    return { kind: "value", value };
  }

  if (key === "attendanceRate") {
    return { kind: "empty", reason: `Chưa có buổi điểm danh trong ${STUDENT_ATTENDANCE_WINDOW_DAYS} ngày qua` };
  }

  return { kind: "value", value: 0 };
}
