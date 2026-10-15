"use client";

import { useMemo } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { AttendanceExceptionReview } from "@/features/timekeeping/attendance-exception-schemas";
import type {
  TimekeepingActionOverrides,
  TimekeepingGeolocation,
} from "@/features/timekeeping/timekeeping-action-overrides";
import { TimekeepingPage } from "@/features/timekeeping/timekeeping-page";
import type {
  AttendanceVerificationPolicy,
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentRequest,
  TimekeepingMonthlyEntry,
  TimekeepingMyEntry,
} from "@/features/timekeeping/types";
import { addDays, getVietnamToday } from "@/lib/datetime";
import type { PermissionCode } from "@/lib/permissions/types";

export type TimekeepingPreviewState =
  | "idle"
  | "blocked"
  | "open"
  | "open-online"
  | "ended"
  | "unconfigured"
  | "wifi";

const STUB = "Bản xem trước không ghi dữ liệu.";
// Same copy the real check-in action maps TIME_ENTRY_OUTSIDE_GEOFENCE to.
const OUTSIDE_CENTER = "Bạn đang ở ngoài khu vực Trung tâm. Vui lòng di chuyển vào Trung tâm để chấm công.";

const entryStub = async (): Promise<{ message: string; status: "error" }> => ({ message: STUB, status: "error" });

/** Fixed ids with a per-feature prefix so fixtures never collide with other previews. */
const id = (n: number) => `d1200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STAFF_ID = id(1);
const STAFF_NAME = "Lê Ngọc";
const CENTER_NAME = "Cơ sở Cầu Giấy";

/** A teaching assistant: personal timekeeping only (no view/manage permissions). */
const permissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "notifications.view",
  "sessions.view",
  "attendance.view",
  "attendance.mark",
  "timekeeping.check",
];

function policyFor(state: TimekeepingPreviewState): AttendanceVerificationPolicy {
  return {
    attendanceRadiusM: 100,
    centerName: CENTER_NAME,
    configured: state !== "unconfigured",
    continuousGpsTrackingRequired: false,
    exceptionReviewEnabled: true,
    gpsMaxAccuracyM: 50,
    gpsRequiredForOffline: true,
    wifiRequiredForOffline: state === "wifi",
  };
}

/** A device that answers every location request after a short delay. */
function fakeGeolocation(accuracyM: number): TimekeepingGeolocation {
  const position = () => ({
    coords: {
      accuracy: accuracyM,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: 21.0362,
      longitude: 105.7906,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  }) as unknown as GeolocationPosition;

  return {
    clearWatch: () => undefined,
    getCurrentPosition: (success) => {
      window.setTimeout(() => success(position()), 500);
    },
    watchPosition: (success) => {
      window.setTimeout(() => success(position()), 500);
      return 1;
    },
  };
}

/** ISO instant for a Vietnam wall-clock time on a work date. */
function at(workDate: string, time: string): string {
  return new Date(`${workDate}T${time}:00+07:00`).toISOString();
}

function minutesBetween(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

interface Fixtures {
  adjustableEntries: TimekeepingAdjustableEntry[];
  currentMonth: number;
  currentYear: number;
  exceptionReviews: AttendanceExceptionReview[];
  monthlyEntries: TimekeepingMonthlyEntry[];
  myEntries: TimekeepingMyEntry[];
  requests: TimekeepingAdjustmentRequest[];
}

const noEvidence = {
  hasCheckInGpsEvidence: false,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: false,
};

function monthlyEntry(
  n: number,
  workDate: string,
  checkIn: string,
  checkOut: string,
  overrides: Partial<TimekeepingMonthlyEntry> = {},
): TimekeepingMonthlyEntry {
  const checkInAt = at(workDate, checkIn);
  const checkOutAt = at(workDate, checkOut);
  return {
    adjustedCheckInAt: null,
    adjustedCheckOutAt: null,
    adjustmentStatus: "none",
    autoEndedAt: null,
    checkInAt,
    checkInMode: "offline",
    checkOutAt,
    checkOutMode: "offline",
    clockOutReason: "manual",
    hasCheckInGpsEvidence: true,
    hasCheckInWifiEvidence: false,
    hasCheckOutGpsEvidence: true,
    hasCheckOutWifiEvidence: false,
    id: id(100 + n),
    isUnscheduled: false,
    status: "checked_out",
    totalMinutes: minutesBetween(checkInAt, checkOutAt),
    workDate,
    workShiftCode: "CC",
    workShiftName: "Ca chiều",
    ...overrides,
  };
}

function buildFixtures(now: string, state: TimekeepingPreviewState): Fixtures {
  const today = getVietnamToday(new Date(now));
  const [year, month] = today.split("-").map(Number);
  const day = (offset: number) => addDays(today, -offset);
  const shift = {
    scheduledEndTime: "21:30:00",
    scheduledStartTime: "17:00:00",
    workShiftCode: "CC",
    workShiftName: "Ca chiều",
  };

  const autoEnded = monthlyEntry(3, day(4), "19:12", "22:30", {
    autoEndedAt: at(day(4), "22:30"),
    checkOutMode: "auto_end",
    clockOutReason: "daily_cutoff",
    hasCheckOutGpsEvidence: false,
    status: "auto_ended",
    workShiftCode: "CT",
    workShiftName: "Ca tối",
  });
  const pending = monthlyEntry(2, day(3), "16:58", "21:05", {
    adjustedCheckInAt: at(day(3), "16:58"),
    adjustedCheckOutAt: at(day(3), "21:35"),
    adjustmentStatus: "pending",
  });
  const monthlyEntries: TimekeepingMonthlyEntry[] = [
    monthlyEntry(1, day(1), "17:21", "21:50", { hasCheckInWifiEvidence: true, hasCheckOutWifiEvidence: true }),
    pending,
    autoEnded,
    monthlyEntry(4, day(6), "16:55", "21:20", {
      adjustedCheckInAt: at(day(6), "16:55"),
      adjustedCheckOutAt: at(day(6), "21:31"),
      adjustmentStatus: "approved",
    }),
    monthlyEntry(5, day(7), "16:58", "21:29", { adjustmentStatus: "rejected" }),
    monthlyEntry(6, day(8), "08:30", "10:35", {
      ...noEvidence,
      checkInMode: "online",
      checkOutMode: "online",
      isUnscheduled: true,
      workShiftCode: null,
      workShiftName: null,
    }),
  ];

  const adjustableEntries: TimekeepingAdjustableEntry[] = monthlyEntries.map((entry) => ({
    adjustmentStatus: entry.adjustmentStatus === "none" ? null : entry.adjustmentStatus,
    checkInAt: entry.checkInAt,
    checkInMode: entry.checkInMode,
    checkOutAt: entry.checkOutAt as string,
    checkOutMode: entry.checkOutMode ?? "offline",
    id: entry.id,
    status: entry.status === "auto_ended" ? "auto_ended" : "checked_out",
    workDate: entry.workDate,
    workShiftCode: entry.workShiftCode,
    workShiftName: entry.workShiftName,
  }));

  const request = (
    n: number,
    entry: TimekeepingMonthlyEntry,
    status: TimekeepingAdjustmentRequest["status"],
    requestedOut: string,
    reason: string,
    decisionReason: string | null,
  ): TimekeepingAdjustmentRequest => ({
    createdAt: at(entry.workDate, "22:10"),
    decisionReason,
    id: id(200 + n),
    originalCheckInAt: entry.checkInAt,
    originalCheckInMode: entry.checkInMode,
    originalCheckOutAt: entry.checkOutAt as string,
    originalCheckOutMode: entry.checkOutMode ?? "offline",
    requestReason: reason,
    requestedCheckInAt: entry.checkInAt,
    requestedCheckInMode: entry.checkInMode,
    requestedCheckOutAt: at(entry.workDate, requestedOut),
    requestedCheckOutMode: "offline",
    reviewedAt: status === "pending" ? null : at(addDays(entry.workDate, 1), "09:15"),
    reviewerDisplayName: status === "pending" ? null : "Nguyễn Văn Vinh",
    status,
    timeEntryId: entry.id,
    workDate: entry.workDate,
  });
  const requests = [
    request(1, pending, "pending", "21:35", "Điện thoại hết pin lúc 21:00, vẫn dạy tới 21:30.", null),
    request(2, monthlyEntries[3], "approved", "21:31", "Quên bấm ra ca sau buổi học.", "Đã đối chiếu với lịch dạy."),
    request(3, monthlyEntries[4], "rejected", "22:15", "Ở lại chấm bài.", "Không có buổi học sau 21:30."),
  ];

  const exceptionReviews: AttendanceExceptionReview[] = [
    {
      check_in_at: at(day(2), "14:52"),
      check_in_reason: "Điện thoại báo sai vị trí trong phòng học tầng 3.",
      check_out_at: at(day(2), "17:04"),
      check_out_reason: null,
      decision_reason: null,
      entry_status: "checked_out",
      has_check_in_gps: false,
      has_check_out_gps: true,
      id: id(300),
      requested_at: at(day(2), "14:53"),
      staff_id: STAFF_ID,
      staff_name: STAFF_NAME,
      status: "pending",
      work_date: day(2),
    },
  ];

  const myEntryBase = { ...noEvidence, autoEndedAt: null, clockOutReason: null, isUnscheduled: false, lastLocationAt: null, workDate: today };
  const myEntries: TimekeepingMyEntry[] = state === "open"
    ? [{
        ...myEntryBase,
        ...shift,
        checkInAt: new Date(new Date(now).getTime() - (2 * 60 + 14) * 60_000).toISOString(),
        checkInMode: "offline",
        checkOutAt: null,
        checkOutMode: null,
        hasCheckInGpsEvidence: true,
        id: id(10),
        lastLocationAt: new Date(new Date(now).getTime() - (2 * 60 + 14) * 60_000).toISOString(),
        status: "open",
      }]
    : state === "open-online"
      ? [{
          ...myEntryBase,
          ...shift,
          checkInAt: new Date(new Date(now).getTime() - 47 * 60_000).toISOString(),
          checkInMode: "online",
          checkOutAt: null,
          checkOutMode: null,
          id: id(11),
          status: "open",
        }]
      : state === "ended"
        ? [{
            ...myEntryBase,
            ...shift,
            autoEndedAt: at(today, "22:30"),
            checkInAt: at(today, "17:02"),
            checkInMode: "offline",
            checkOutAt: at(today, "22:30"),
            checkOutMode: "auto_end",
            clockOutReason: "daily_cutoff",
            hasCheckInGpsEvidence: true,
            id: id(12),
            status: "auto_ended",
          }]
        : [];

  return {
    adjustableEntries,
    currentMonth: month,
    currentYear: year,
    exceptionReviews,
    monthlyEntries,
    myEntries,
    requests,
  };
}

/**
 * Inert stand-ins for every timekeeping server action the staff page can
 * reach, plus a fake device location. The preview runs on localhost where
 * .env.local may point at production, so nothing may reach a server action.
 */
function buildPreviewActions(
  state: TimekeepingPreviewState,
  fixtures: Fixtures,
): Required<TimekeepingActionOverrides> {
  return {
    checkInTimeEntry: state === "blocked"
      ? async () => ({ message: OUTSIDE_CENTER, status: "error" })
      : entryStub,
    checkOutTimeEntry: entryStub,
    decideAttendanceException: entryStub,
    fetchMyMonthlyTimesheet: async (month, year) => ({
      entries: month === fixtures.currentMonth && year === fixtures.currentYear ? fixtures.monthlyEntries : [],
      ok: true,
    }),
    geolocation: fakeGeolocation(state === "blocked" ? 85 : 12),
    getAttendanceExceptionReviews: async () => ({ ok: true as const, reviews: fixtures.exceptionReviews }),
    requestAttendanceException: entryStub,
    requestTimeEntryAdjustment: entryStub,
    submitAttendanceHeartbeat: async () => ({ distanceM: 38, sessionActive: true, verifiedInside: true }),
  };
}

export function TimekeepingPreview({ now, state }: { now: string; state: TimekeepingPreviewState }) {
  const fixtures = useMemo(() => buildFixtures(now, state), [now, state]);
  // Stable per state: the heartbeat and review effects depend on it.
  const actions = useMemo(() => buildPreviewActions(state, fixtures), [fixtures, state]);

  return (
    <AppShell
      authUser={{ displayName: STAFF_NAME, email: "preview@example.com", id: "dev-user", initials: "LN" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname="/timekeeping"
      unreadNotificationCount={2}
    >
      <TimekeepingPage
        actions={actions}
        adjustmentApprovalQueue={[]}
        adjustmentEntries={fixtures.adjustableEntries}
        attendancePolicy={policyFor(state)}
        canApproveAdjustments={false}
        canCheck
        canManage={false}
        canManageVerification={false}
        canView={false}
        currentMonth={fixtures.currentMonth}
        currentYear={fixtures.currentYear}
        dayEntries={[]}
        entries={[]}
        myAdjustmentRequests={fixtures.requests}
        myEntries={fixtures.myEntries}
        myMonthlyEntries={fixtures.monthlyEntries}
        staffOptions={[]}
        workShifts={[]}
      />
    </AppShell>
  );
}
