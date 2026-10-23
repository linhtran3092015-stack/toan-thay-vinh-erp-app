import type {
  TimeEntryMode,
  TimekeepingAdjustmentStatus,
  TimekeepingMonthlyEntry,
} from "@/features/timekeeping/types";

export function formatVietnamDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function formatVietnamDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(new Date(value));
}

export function formatVietnamDateTimeInput(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function vietnamDatetimeInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function getTimeEntryModeLabel(mode: TimeEntryMode | "auto_end"): string {
  const labels: Record<TimeEntryMode | "auto_end", string> = {
    auto_end: "Tự động kết thúc",
    offline: "Tại trung tâm",
    online: "Trực tuyến",
  };

  return labels[mode];
}

export function getAdjustmentStatusLabel(status: TimekeepingAdjustmentStatus): string {
  const labels: Record<TimekeepingAdjustmentStatus, string> = {
    approved: "Đã duyệt",
    pending: "Chờ duyệt",
    rejected: "Đã từ chối",
    superseded: "Đã thay thế",
  };

  return labels[status];
}

/**
 * The times an entry currently stands at. The monthly read models also return a
 * pending or rejected request's proposal as adjusted*, so only an approved
 * adjustment replaces the recorded check-in/check-out.
 */
export function getEffectiveEntryTimes(
  entry: Pick<TimekeepingMonthlyEntry, "adjustedCheckInAt" | "adjustedCheckOutAt" | "adjustmentStatus" | "checkInAt" | "checkOutAt">,
): { checkInAt: string; checkOutAt: string | null } {
  const isApproved = entry.adjustmentStatus === "approved";
  return {
    checkInAt: (isApproved && entry.adjustedCheckInAt) || entry.checkInAt,
    checkOutAt: (isApproved && entry.adjustedCheckOutAt) || entry.checkOutAt,
  };
}
