import { VIETNAM_TIME_ZONE } from "@/lib/datetime";
import type {
  AttendanceVerificationPolicy,
  TimeEntryMode,
  TimekeepingMyEntry,
} from "@/features/timekeeping/types";

/**
 * Copy for the staff side of /timekeeping (design 14). Only facts the client
 * really knows: the policy it receives has radius, accuracy limit and centre
 * name but no coordinates, browsers cannot read the Wi-Fi network, and since
 * the 2026-09-15 endpoint-verification migration the location is checked only
 * when checking in and out (the server alone auto-ends a shift, at the daily
 * cutoff). Eligibility stays server-owned: nothing here claims a check passed.
 * Keep this module free of a "use client" boundary.
 */

/**
 * Daily cutoff enforced by the server (migration 20261012120000): no check-in
 * at or after it, and an open shift is closed at it. Shared by every line
 * that mentions it so the copy cannot drift apart.
 */
export const DAILY_CUTOFF_TEXT = "22:30 (trợ giảng) hoặc 22:45 (vị trí khác)";

/** Online check-in window around an assigned shift (owner decision 3). */
export const ONLINE_SHIFT_WINDOW_MINUTES = 15;

const checkInCutoffItem: ShiftConditionItem = {
  icon: "schedule",
  id: "checkin-cutoff",
  text: `Không vào ca được sau ${DAILY_CUTOFF_TEXT}.`,
  tone: "info",
};

export type ShiftConditionTone = "info" | "warning";
export type ShiftConditionIcon = "location" | "wifi" | "schedule" | "verification" | "warning";

export interface ShiftConditionItem {
  icon: ShiftConditionIcon;
  id: string;
  text: string;
  tone: ShiftConditionTone;
}

/** Rules shown on the check-in card before "Vào ca", per chosen mode. */
export function getShiftConditionItems(
  policy: AttendanceVerificationPolicy,
  mode: TimeEntryMode,
): ShiftConditionItem[] {
  if (mode === "online") {
    return [
      {
        icon: "schedule",
        id: "online-schedule",
        text: `Trực tuyến chỉ nhận khi bạn có ca được xếp hôm nay, trong ${ONLINE_SHIFT_WINDOW_MINUTES} phút trước hoặc sau giờ ca.`,
        tone: "info",
      },
      {
        icon: "verification",
        id: "online-location",
        text: "Không cần lấy vị trí khi chấm công trực tuyến.",
        tone: "info",
      },
      checkInCutoffItem,
    ];
  }

  const items: ShiftConditionItem[] = [];

  if (!policy.configured) {
    items.push({
      icon: "warning",
      id: "center-not-configured",
      // Without saved coordinates the server either refuses on-site check-in
      // (config row without a location) or skips the location check (no
      // config row), so the card says "may be refused", not a fixed outcome.
      text: "Chưa cấu hình vị trí Trung tâm: chấm công tại Trung tâm có thể bị từ chối cho đến khi chủ trung tâm lưu tọa độ.",
      tone: "warning",
    });
  } else {
    items.push({
      icon: "location",
      id: "location-rule",
      text: `Vị trí: trong bán kính ${policy.attendanceRadiusM} m quanh ${policy.centerName}, sai số tối đa ${policy.gpsMaxAccuracyM} m. Kiểm tra khi bấm Vào ca.`,
      tone: "info",
    });
  }

  if (policy.wifiRequiredForOffline) {
    items.push({
      icon: "wifi",
      id: "wifi-rule",
      text: "Wi-Fi: nhập tên mạng Trung tâm đã đăng ký khi xác nhận.",
      tone: "info",
    });
  }

  if (policy.configured) {
    items.push({
      icon: "verification",
      id: "verification-timing",
      text: policy.continuousGpsTrackingRequired
        ? "Vị trí được theo dõi liên tục trong ca."
        : "Vị trí chỉ được xác minh lúc vào ca và lúc ra ca.",
      tone: "info",
    });
  }

  items.push(checkInCutoffItem);

  return items;
}

/** Evidence line for an open shift, from the flags the entry carries. */
export function getOpenShiftEvidenceText(entry: TimekeepingMyEntry): string {
  if (entry.checkInMode === "online") {
    return "Trực tuyến · theo ca được xếp";
  }

  return entry.hasCheckInGpsEvidence
    ? `Đã ghi nhận vị trí lúc vào ca${entry.hasCheckInWifiEvidence ? " và thông tin Wi-Fi" : ""}`
    : "Vào ca không kèm dữ liệu vị trí";
}

/** Rule reminders under an open shift. */
export function getOpenShiftRuleNotes(
  entry: TimekeepingMyEntry,
  policy: AttendanceVerificationPolicy,
): string[] {
  const notes: string[] = [];

  if (entry.checkInMode === "offline" && policy.configured) {
    notes.push(`Ra ca tại Trung tâm cần lấy lại vị trí trong bán kính ${policy.attendanceRadiusM} m.`);
  }

  notes.push(`Quên ra ca? Hệ thống tự kết thúc ca lúc ${DAILY_CUTOFF_TEXT}.`);

  return notes;
}

const weekdayLongFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  weekday: "long",
});

const clockPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase("vi-VN") + value.slice(1);
}

/** "Thứ Hai, 12/10/2026 · 16:58" in Vietnam time. */
export function formatVietnamClockLine(epochMs: number): string {
  const date = new Date(epochMs);
  const parts = Object.fromEntries(
    clockPartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekday = capitalizeFirst(weekdayLongFormatter.format(date));

  return `${weekday}, ${parts.day}/${parts.month}/${parts.year} · ${parts.hour}:${parts.minute}`;
}

const shortWeekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/** "T7 10/10" for a YYYY-MM-DD work date (a calendar date, no time zone shift). */
export function formatShortWorkDate(workDate: string): string {
  const [year, month, day] = workDate.split("-").map(Number);

  if (!year || !month || !day) {
    return workDate;
  }

  const weekday = shortWeekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** "HH:MM" in Vietnam time for an ISO timestamp ("—" when it cannot be read). */
export function formatVietnamClockTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const parts = Object.fromEntries(
    clockPartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.hour}:${parts.minute}`;
}
