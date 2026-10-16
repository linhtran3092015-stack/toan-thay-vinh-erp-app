import type { GradingCreditDashboardEntry } from "@/features/grading-credits/read-models";

const graders = [
  ["grader-1", "Trần Thu Hà"],
  ["grader-2", "Nguyễn Hoàng Phúc"],
] as const;

const creditClasses = [
  ["L-9A26", "Toán 9A tối 2-4-6"],
  ["L-8B26", "Toán 8B chiều 3-5-7"],
  ["L-10NC26", "Toán 10 nâng cao tối 2-6 · nhóm luyện đề chuyên đề hình học"],
] as const;

const creditStudents = [
  ["TTV-00100", "Nguyễn Minh Anh"],
  ["TTV-00107", "Trần Gia Bảo"],
  ["TTV-00114", "Lê Hoàng Nam"],
  ["TTV-00121", "Phạm Thu Hà"],
  ["TTV-00128", "Vũ Đức Huy"],
  ["TTV-00135", "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh"],
] as const;

// [session date, credited at (UTC), class index, student index, grader index]
const creditRows: Array<[string, string, number, number, number]> = [
  ["2026-10-14", "2026-10-15T02:10:00Z", 0, 0, 0],
  ["2026-10-14", "2026-10-15T02:12:00Z", 0, 1, 0],
  ["2026-10-14", "2026-10-15T02:15:00Z", 0, 2, 1],
  ["2026-10-13", "2026-10-14T13:40:00Z", 1, 3, 1],
  ["2026-10-13", "2026-10-14T13:42:00Z", 1, 4, 1],
  ["2026-10-12", "2026-10-12T15:05:00Z", 2, 5, 0],
  ["2026-10-12", "2026-10-12T15:07:00Z", 2, 0, 0],
  ["2026-10-10", "2026-10-11T01:30:00Z", 0, 1, 0],
  ["2026-10-10", "2026-10-11T01:32:00Z", 0, 2, 1],
  ["2026-10-08", "2026-10-09T12:20:00Z", 1, 3, 1],
  ["2026-10-08", "2026-10-09T12:22:00Z", 1, 4, 0],
  ["2026-10-07", "2026-10-07T14:50:00Z", 2, 5, 1],
  ["2026-10-06", "2026-10-06T16:10:00Z", 0, 0, 0],
  ["2026-10-06", "2026-10-06T16:12:00Z", 0, 1, 0],
  ["2026-10-03", "2026-10-04T03:00:00Z", 1, 2, 1],
  ["2026-10-03", "2026-10-04T03:05:00Z", 1, 3, 1],
  ["2026-10-01", "2026-10-01T14:00:00Z", 2, 4, 0],
  // 00:30 on 1 Oct in Vietnam: counted in October although the UTC date is 30 Sep.
  ["2026-09-30", "2026-09-30T17:30:00Z", 0, 5, 0],
  ["2026-09-30", "2026-09-30T16:59:00Z", 0, 0, 1],
  ["2026-09-29", "2026-09-29T13:15:00Z", 1, 1, 1],
  ["2026-09-26", "2026-09-27T02:00:00Z", 2, 2, 0],
  ["2026-09-24", "2026-09-24T15:30:00Z", 0, 3, 0],
  ["2026-09-22", "2026-09-22T14:45:00Z", 1, 4, 1],
  ["2026-09-19", "2026-09-20T01:20:00Z", 2, 5, 1],
];

export const creditEntries: GradingCreditDashboardEntry[] = creditRows.map(
  ([sessionDate, creditedAt, classIndex, studentIndex, graderIndex], index) => {
    const [classCode, className] = creditClasses[classIndex];
    const [studentPublicCode, studentFullName] = creditStudents[studentIndex];
    const [graderId, graderDisplayName] = graders[graderIndex];

    return {
      classCode,
      className,
      classSessionId: `session-${sessionDate}-${classIndex}`,
      creditUnits: 1,
      creditedAt,
      graderDisplayName,
      graderId,
      id: `credit-${index}`,
      sessionDate,
      sessionResultId: `result-${index}`,
      studentFullName,
      studentId: `student-${studentIndex}`,
      studentPublicCode,
    };
  },
);

/** A TA only sees the credits they earned themselves. */
export const ownCreditEntries = creditEntries.filter((entry) => entry.graderId === "grader-1");
