import { describe, expect, it } from "vitest";

import {
  getStudentDirectoryMetricCell,
  summarizeDirectoryAttendance,
  summarizeDirectoryDebt,
  type StudentDirectoryMetrics,
} from "@/features/students/student-directory-metrics";

describe("summarizeDirectoryAttendance", () => {
  it("rates present over main sessions and leaves additional study out", () => {
    const rates = summarizeDirectoryAttendance([
      { attendance_status: "present", student_id: "a" },
      { attendance_status: "present", student_id: "a" },
      { attendance_status: "present", student_id: "a" },
      { attendance_status: "excused_absence", student_id: "a" },
      { attendance_status: "additional_study", student_id: "a" },
      { attendance_status: "unexcused_absence", student_id: "b" },
      { attendance_status: "additional_study", student_id: "c" },
      { attendance_status: "something_new", student_id: "c" },
    ]);

    expect(rates).toEqual({ a: 75, b: 0 });
  });
});

describe("summarizeDirectoryDebt", () => {
  it("sums what is still owed on open requests only", () => {
    const debt = summarizeDirectoryDebt([
      { expected_amount_vnd: "2400000", paid_amount_vnd: "0", status: "pending", student_id: "a" },
      { expected_amount_vnd: 1_200_000, paid_amount_vnd: 200_000, status: "partially_paid", student_id: "a" },
      { expected_amount_vnd: 900_000, paid_amount_vnd: 900_000, status: "partially_paid", student_id: "b" },
      { expected_amount_vnd: 500_000, paid_amount_vnd: 0, status: "cancelled", student_id: "b" },
      { expected_amount_vnd: 100_000, paid_amount_vnd: 300_000, status: "pending", student_id: "c" },
    ]);

    expect(debt).toEqual({ a: 3_400_000 });
  });
});

describe("getStudentDirectoryMetricCell", () => {
  const metrics: StudentDirectoryMetrics = {
    attendanceRate: { byStudentId: { a: 90 }, status: "ready" },
    balanceSessions: { byStudentId: { a: -2 }, status: "ready" },
    outstandingVnd: { reason: "failed", status: "unavailable" },
  };

  it("reads values and treats a missing balance as zero", () => {
    expect(getStudentDirectoryMetricCell(metrics, "attendanceRate", "a")).toEqual({ kind: "value", value: 90 });
    expect(getStudentDirectoryMetricCell(metrics, "balanceSessions", "a")).toEqual({ kind: "value", value: -2 });
    expect(getStudentDirectoryMetricCell(metrics, "balanceSessions", "z")).toEqual({ kind: "value", value: 0 });
  });

  it("never turns a missing attendance rate or an unavailable column into zero", () => {
    expect(getStudentDirectoryMetricCell(metrics, "attendanceRate", "z")).toMatchObject({ kind: "empty" });
    expect(getStudentDirectoryMetricCell(metrics, "outstandingVnd", "a")).toEqual({
      kind: "unavailable",
      reason: "Không tải được công nợ",
    });
  });
});
