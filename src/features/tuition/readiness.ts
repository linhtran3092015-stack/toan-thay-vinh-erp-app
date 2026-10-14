import type { TuitionPreviewRow, TuitionSystemBlocker } from "./data";

export const tuitionBlockerLabels: Record<string, string> = {
  MISSING_EFFECTIVE_TUITION_RATE: "Thiếu đơn giá có hiệu lực vào ngày học",
  MISSING_ACQUISITION_SOURCE: "Chưa có nguồn học viên",
  MISSING_PRIMARY_GUARDIAN: "Chưa có phụ huynh chính",
};

export function summarizeTuitionPreview(rows: TuitionPreviewRow[]) {
  const students = new Map<string, { studentId: string; sessions: number; missingRateFrom: string | null; issues: Set<string> }>();
  for (const row of rows) {
    const student = students.get(row.studentId) ?? { studentId: row.studentId, sessions: 0, missingRateFrom: null, issues: new Set<string>() };
    student.sessions += 1;
    if (row.unitPriceVnd === null) {
      student.issues.add("MISSING_EFFECTIVE_TUITION_RATE");
      if (!student.missingRateFrom || row.sessionDate < student.missingRateFrom) student.missingRateFrom = row.sessionDate;
    }
    if (!row.acquisitionSourceId) student.issues.add("MISSING_ACQUISITION_SOURCE");
    if (row.blockerCode) student.issues.add(row.blockerCode);
    students.set(row.studentId, student);
  }
  return [...students.values()].map(student => ({ ...student, issues: [...student.issues] }));
}

const knownStudentIssues = new Set(["MISSING_EFFECTIVE_TUITION_RATE", "MISSING_ACQUISITION_SOURCE", "MISSING_PRIMARY_GUARDIAN"]);

export interface TuitionLockReadiness {
  /** Students in the preview (one per student, many sessions each). */
  studentCount: number;
  /** Preview rows: one per student × chargeable session. */
  sessionCount: number;
  missingRates: number;
  missingSources: number;
  missingGuardians: number;
  /** Students blocked by a code without a dedicated condition. */
  otherIssues: number;
  systemBlockers: TuitionSystemBlocker[];
  previewUnavailable: boolean;
  /** No eligible session and nothing failed to load: nothing to lock. */
  isEmpty: boolean;
  /** Same rule the period list always used to disable the lock button. */
  hasBlockers: boolean;
  /** Unmet lock conditions, for the list's derived status text. */
  unmetCount: number;
  /** Sessions × rate before the opening credit; null while a rate is missing or the preview failed. */
  estimatedTotalVnd: number | null;
}

/**
 * Lock readiness of a draft period, shared by the period list and the period
 * page so both show the same conditions and disable the lock the same way.
 */
export function getTuitionLockReadiness(rows: TuitionPreviewRow[], systemBlockers: TuitionSystemBlocker[]): TuitionLockReadiness {
  const students = summarizeTuitionPreview(rows);
  const count = (code: string) => students.filter((student) => student.issues.includes(code)).length;
  const missingRates = count("MISSING_EFFECTIVE_TUITION_RATE");
  const missingSources = count("MISSING_ACQUISITION_SOURCE");
  const missingGuardians = count("MISSING_PRIMARY_GUARDIAN");
  const otherIssues = students.filter((student) => student.issues.some((code) => !knownStudentIssues.has(code))).length;
  const previewUnavailable = systemBlockers.some((blocker) => blocker.code === "PREVIEW_UNAVAILABLE");
  const isEmpty = rows.length === 0 && systemBlockers.length === 0;
  const hasBlockers = students.some((student) => student.issues.length > 0) || systemBlockers.length > 0 || rows.length === 0;
  const unmetCount =
    [missingRates, missingSources, missingGuardians, otherIssues].filter((value) => value > 0).length +
    systemBlockers.length +
    (isEmpty ? 1 : 0);

  return {
    estimatedTotalVnd: previewUnavailable || missingRates > 0 ? null : rows.reduce((sum, row) => sum + (row.unitPriceVnd ?? 0), 0),
    hasBlockers,
    isEmpty,
    missingGuardians,
    missingRates,
    missingSources,
    otherIssues,
    previewUnavailable,
    sessionCount: rows.length,
    studentCount: students.length,
    systemBlockers,
    unmetCount,
  };
}
