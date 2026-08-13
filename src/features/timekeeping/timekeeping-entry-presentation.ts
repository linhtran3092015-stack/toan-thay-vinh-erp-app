import type { TimeEntryStatus } from "@/features/timekeeping/types";

type TimekeepingEntryTone = "info" | "neutral" | "success" | "danger" | "warning";

export interface TimekeepingEntryStatusPresentation {
  label: string;
  tone: TimekeepingEntryTone;
}

const modeLabels = {
  offline: "Tại trung tâm",
  online: "Trực tuyến",
} as const;

/**
 * Presentation-only entry helpers shared by server and client timekeeping
 * components. Keep this module free of a "use client" boundary.
 */
export function getTimekeepingEntryStatusPresentation(
  status: TimeEntryStatus,
): TimekeepingEntryStatusPresentation {
  switch (status) {
    case "open":
      return { label: "Đang trong ca", tone: "info" };
    case "checked_out":
      return { label: "Đã check-out", tone: "success" };
    case "auto_ended":
      return { label: "Tự động kết thúc", tone: "neutral" };
  }
}

export function getTimekeepingModeLabel(mode: "online" | "offline"): string {
  return modeLabels[mode];
}

export function getEvidencePresenceLabel(hasEvidence: boolean): string {
  return hasEvidence ? "Có dữ liệu" : "Không có dữ liệu";
}

export function getClockOutReasonLabel(reason?: string | null): string {
  switch (reason) {
    case "manual":
      return "Tự check-out";
    case "left_geofence":
      return "Rời khỏi Trung tâm";
    case "location_lost":
      return "Mất kết nối vị trí (>90s)";
    case "daily_cutoff":
      return "Hết giờ ca (23:30)";
    default:
      return "Hệ thống tự động";
  }
}
