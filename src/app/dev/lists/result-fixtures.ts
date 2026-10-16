import {
  LEARNING_RESULTS_LIMIT,
  type LearningResultDirectoryItem,
  type LearningResultNotebookStatus,
} from "@/features/learning-results/read-models";

const resultClasses = [
  ["class-0", "L-9A26", "Toán 9A tối 2-4-6", 9, "A"],
  ["class-3", "L-8B26", "Toán 8B chiều 3-5-7", 8, "B"],
  ["class-7", "L-10NC26", "Toán 10 nâng cao tối 2-6", 10, "CLC"],
] as const;

const resultStudents = [
  ["student-0", "TTV-00100", "Nguyễn Minh Anh"],
  ["student-1", "TTV-00107", "Trần Gia Bảo"],
  ["student-2", "TTV-00114", "Lê Hoàng Nam"],
  ["student-3", "TTV-00121", "Phạm Thu Hà"],
  ["student-4", "TTV-00128", "Vũ Đức Huy"],
  ["student-5", "TTV-00135", "Đỗ Khánh Linh"],
  ["student-6", "TTV-00142", "Bùi Quang Minh"],
  ["student-7", "TTV-00149", "Tôn Nữ Hoàng Bảo Ngọc"],
] as const;

const longComment =
  "Em làm đúng phần đại số nhưng còn nhầm dấu khi chuyển vế ở bài 3; phần hình chưa vẽ hình phụ nên chưa chứng minh được câu b. Cần ôn lại hệ thức lượng trong tam giác vuông trước buổi sau.";

// [session date, class, student, test score, notebook status, notebook score, comment, graded at (UTC), locked]
type ResultRow = [string, number, number, number | null, LearningResultNotebookStatus, number | null, string | null, string | null, boolean];

const resultRows: ResultRow[] = [
  ["2026-10-14", 0, 0, 9, "submitted", 9, "Làm bài cẩn thận.", "2026-10-14T14:20:00Z", false],
  ["2026-10-14", 0, 1, 4.5, "not_submitted", null, "Chưa nộp vở, cần nhắc phụ huynh.", "2026-10-14T14:22:00Z", false],
  ["2026-10-14", 0, 2, null, "submitted", 7, null, null, false],
  ["2026-10-14", 0, 7, 3, "submitted", 4, longComment, "2026-10-14T14:30:00Z", false],
  ["2026-10-13", 1, 3, 8.5, "not_required", null, null, "2026-10-13T11:05:00Z", true],
  ["2026-10-13", 1, 4, 6, "submitted", 6.5, "Tiến bộ so với tuần trước.", "2026-10-13T11:07:00Z", true],
  ["2026-10-13", 1, 5, null, "not_submitted", null, "Vắng phần kiểm tra cuối giờ.", null, true],
  ["2026-10-12", 2, 6, 10, "submitted", 10, null, "2026-10-12T15:00:00Z", true],
  ["2026-10-12", 2, 0, 7.5, "submitted", 8, null, "2026-10-12T15:02:00Z", true],
  ["2026-10-12", 2, 1, 2.5, "not_submitted", null, "Cần kèm thêm phần phân số.", "2026-10-12T15:04:00Z", true],
  ["2026-10-10", 0, 2, 8, "submitted", 7.5, null, "2026-10-10T14:10:00Z", true],
  ["2026-10-10", 0, 3, 5, "submitted", 5, null, "2026-10-10T14:12:00Z", true],
  ["2026-10-10", 0, 4, 9.5, "not_required", null, "Xuất sắc.", "2026-10-10T14:14:00Z", true],
  ["2026-10-08", 1, 5, 6.5, "submitted", 6, null, "2026-10-08T11:00:00Z", true],
  ["2026-10-08", 1, 6, 4, "submitted", 3.5, "Vở trình bày cẩu thả.", "2026-10-08T11:02:00Z", true],
  ["2026-10-08", 1, 7, 7, "not_submitted", null, null, "2026-10-08T11:04:00Z", true],
  ["2026-10-07", 2, 0, 8, "submitted", 8.5, null, "2026-10-07T15:20:00Z", true],
  ["2026-10-07", 2, 1, null, "not_required", null, null, null, true],
  ["2026-10-06", 0, 2, 6, "submitted", 7, null, "2026-10-06T14:00:00Z", true],
  ["2026-10-06", 0, 3, 7.5, "submitted", 7, null, "2026-10-06T14:02:00Z", true],
  ["2026-10-06", 0, 4, 1.5, "not_submitted", null, "Không làm bài kiểm tra.", "2026-10-06T14:04:00Z", true],
  ["2026-10-03", 1, 5, 9, "submitted", 9, null, "2026-10-03T11:30:00Z", true],
  ["2026-10-03", 1, 6, 8, "submitted", 8, null, "2026-10-03T11:32:00Z", true],
  ["2026-10-01", 2, 7, 5.5, "submitted", 6, null, "2026-10-01T15:10:00Z", true],
];

function toItem([sessionDate, classIndex, studentIndex, testScore, notebookStatus, notebookScore, resultComment, gradedAt, locked]: ResultRow, index: number): LearningResultDirectoryItem {
  const [classId, classCode, className, classGrade, classLevel] = resultClasses[classIndex];
  const [studentId, studentCode, studentName] = resultStudents[studentIndex];

  return {
    classCode,
    classGrade,
    classId,
    classLevel,
    className,
    classSessionId: `session-${sessionDate}-${classIndex}`,
    currentGrade: classGrade,
    gradedAt,
    lockedAt: locked ? `${sessionDate}T16:00:00Z` : null,
    notebookScore,
    notebookStatus,
    resultComment,
    resultId: `result-${index}`,
    sessionDate,
    sessionStatus: "completed",
    studentCode,
    studentId,
    studentName,
    testScore,
  };
}

export const resultItems: LearningResultDirectoryItem[] = resultRows.map(toItem);

/** Exactly the loader's cap, so the page shows its "500 kết quả mới nhất" caption. */
export const cappedResultItems: LearningResultDirectoryItem[] = Array.from({ length: LEARNING_RESULTS_LIMIT }, (_, index) => ({
  ...toItem(resultRows[index % resultRows.length], index),
}));
