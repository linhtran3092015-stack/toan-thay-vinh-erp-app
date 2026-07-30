import "server-only";

import { createCsvDocument } from "@/features/reports/csv";
import type { CsvCell } from "@/features/reports/csv";
import type {
  SessionDirectoryItem,
  SessionKind,
  SessionLearningMode,
  SessionStatus,
} from "@/features/sessions/read-models";

export interface SessionExportFilters {
  dateFrom: string | null;
  dateTo: string | null;
}

export interface SessionCsvOptions {
  includeAttendanceCounts: boolean;
  includeResultCounts: boolean;
}

const sessionKindLabels: Record<
  SessionKind,
  string
> = {
  additional: "Buổi bổ sung",
  makeup: "Buổi bù",
  regular: "Buổi chính",
};

const learningModeLabels: Record<
  SessionLearningMode,
  string
> = {
  hybrid: "Kết hợp",
  offline: "Offline",
  online: "Online",
};

const sessionStatusLabels: Record<
  SessionStatus,
  string
> = {
  cancelled: "Đã hủy",
  completed: "Đã hoàn thành",
  in_progress: "Đang học",
  scheduled: "Đã lên lịch",
};

export function filterSessionsForExport(
  sessions: readonly SessionDirectoryItem[],
  filters: SessionExportFilters,
): SessionDirectoryItem[] {
  return sessions.filter((session) => {
    const matchesDateFrom =
      filters.dateFrom === null ||
      session.sessionDate >= filters.dateFrom;

    const matchesDateTo =
      filters.dateTo === null ||
      session.sessionDate <= filters.dateTo;

    return matchesDateFrom && matchesDateTo;
  });
}

export function createSessionsCsv(
  sessions: readonly SessionDirectoryItem[],
  options: SessionCsvOptions,
): string {
  const headers = [
    "Ngày",
    "Giờ bắt đầu",
    "Giờ kết thúc",
    "Mã lớp",
    "Tên lớp",
    "Khối",
    "Trình độ",
    "Hình thức",
    "Loại buổi",
    "Phòng",
    "Trạng thái",
  ];

  if (options.includeAttendanceCounts) {
    headers.push("Số học viên điểm danh");
  }

  if (options.includeResultCounts) {
    headers.push("Số học viên có kết quả");
  }

  const rows: CsvCell[][] =
    sessions.map((session) => {
      const row: CsvCell[] = [
        formatDate(session.sessionDate),
        formatTime(session.startTime),
        formatTime(session.endTime),
        session.classCode,
        session.className,
        session.grade,
        session.level,
        learningModeLabels[
          session.learningMode
        ],
        sessionKindLabels[
          session.sessionKind
        ],
        session.roomName ?? "",
        session.lockedAt
          ? "Đã khóa"
          : sessionStatusLabels[
              session.status
            ],
      ];

      if (options.includeAttendanceCounts) {
        row.push(
          session.attendanceCount ?? 0,
        );
      }

      if (options.includeResultCounts) {
        row.push(session.resultCount ?? 0);
      }

      return row;
    });

  return createCsvDocument(headers, rows);
}

function formatDate(value: string): string {
  const [year, month, day] =
    value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
