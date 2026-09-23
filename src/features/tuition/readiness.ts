import type { TuitionPreviewRow } from "./data";

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
