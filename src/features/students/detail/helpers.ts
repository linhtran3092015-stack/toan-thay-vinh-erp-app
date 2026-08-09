import type {
  AlertSeverity,
  CoachingPriority,
  CoachingStatus,
  DetailAttendanceKind,
  DetailAttendanceStatus,
  PaymentTopupStatus,
  ScoreStatus,
  SessionLedgerType,
  TopupType,
} from "./types";

export const attendanceStatusMeta: Record<
  DetailAttendanceStatus,
  { label: string; tone: "danger" | "info" | "success" | "warning" }
> = {
  additional_study: { label: "Học thêm", tone: "info" },
  excused_absence: { label: "Vắng CP", tone: "warning" },
  present: { label: "Có mặt", tone: "success" },
  unexcused_absence: { label: "Vắng KP", tone: "danger" },
};

export const attendanceKindMeta: Record<DetailAttendanceKind, string> = {
  additional: "Học thêm",
  main: "Học chính",
};

export const scoreStatusMeta: Record<
  ScoreStatus,
  { label: string; tone: "info" | "neutral" | "success" | "warning" }
> = {
  absent_not_applicable: { label: "Không áp dụng - Vắng", tone: "neutral" },
  exempt: { label: "Được miễn", tone: "info" },
  not_submitted: { label: "Chưa nộp", tone: "warning" },
  scored: { label: "Có điểm", tone: "success" },
};

export const topupTypeMeta: Record<TopupType, string> = {
  new_enrollment: "Tuyển mới",
  renewal: "Tái phí",
};

export const topupStatusMeta: Record<
  PaymentTopupStatus,
  { label: string; tone: "danger" | "neutral" | "success" | "warning" }
> = {
  confirmed: { label: "Đã xác nhận", tone: "success" },
  draft: { label: "Nháp", tone: "warning" },
  voided: { label: "Đã hủy", tone: "neutral" },
};

export const ledgerTypeMeta: Record<SessionLedgerType, string> = {
  adjustment: "Điều chỉnh",
  bonus_sessions: "Tặng buổi",
  cancelled_session_refund: "Hoàn do hủy buổi",
  fee_topup: "Nạp học phí",
  refund: "Hoàn phí",
  session_charge: "Trừ buổi học",
  transfer_in: "Chuyển đến",
  transfer_out: "Chuyển đi",
};

export const coachingPriorityMeta: Record<
  CoachingPriority,
  { label: string; tone: "danger" | "info" | "warning" }
> = {
  high: { label: "Cao", tone: "danger" },
  low: { label: "Thấp", tone: "info" },
  medium: { label: "Trung bình", tone: "warning" },
};

export const coachingStatusMeta: Record<
  CoachingStatus,
  { label: string; tone: "info" | "neutral" | "success" | "warning" }
> = {
  closed: { label: "Đã đóng", tone: "success" },
  in_progress: { label: "Đang xử lý", tone: "warning" },
  open: { label: "Mở", tone: "info" },
};

export const alertSeverityMeta: Record<
  AlertSeverity,
  { label: string; tone: "danger" | "info" | "warning" }
> = {
  danger: { label: "Cao", tone: "danger" },
  info: { label: "Theo dõi", tone: "info" },
  warning: { label: "Trung bình", tone: "warning" },
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

export function formatShortDate(value: string): string {
  return value;
}

export function getStudentDetailHref(
  student: { id: string },
  directoryQuery?: string,
): string {
  const pathname = `/students/${student.id}`;
  return directoryQuery ? `${pathname}?${directoryQuery}` : pathname;
}

export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const lastTwo = words.slice(-2);

  return lastTwo
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("vi");
}

export function formatDeltaSessions(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}
