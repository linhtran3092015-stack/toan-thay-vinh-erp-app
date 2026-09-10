import type { SessionKind, SessionLearningMode } from "@/features/sessions/read-models";
import type { BatchSessionDraftItem } from "./forms/session-batch-schema";

export interface BatchClassOption {
  id: string;
  code: string;
  name: string;
  grade: number;
  level: string;
  defaultLearningMode: SessionLearningMode;
  academicYearId: string | null;
}

export interface BatchScheduleOption {
  id: string;
  classId: string;
  weekday: number; // 1 (Mon) .. 7 (Sun)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  learningMode: SessionLearningMode;
  roomName: string | null;
  meetingUrl: string | null;
  componentCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ExistingSessionSnapshot {
  sessionDate: string;
  startTime: string;
  endTime: string;
  scheduleTemplateId: string | null;
}

export const VIETNAMESE_WEEKDAY_NAMES: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

export const VIETNAMESE_SHORT_WEEKDAYS: Record<number, string> = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
};

export interface BatchCalculationSlot {
  scheduleTemplateId?: string | null;
  weekday: number; // 1..7
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  learningMode: SessionLearningMode;
  roomName?: string | null;
  meetingUrl?: string | null;
  componentCode?: string | null;
  sessionKind?: Extract<SessionKind, "regular" | "additional">;
}

export interface BatchCalculationParams {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  rangeMode: "date_range" | "count";
  count?: number;
  slots: BatchCalculationSlot[];
  namingPattern?: string; // default "Buổi {n}"
  startNumber?: number; // default 1
  existingSessions?: ExistingSessionSnapshot[];
  today?: string; // YYYY-MM-DD
}

export function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getIsoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function parseDateUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function calculateBatchOccurrences(params: BatchCalculationParams): BatchSessionDraftItem[] {
  const {
    startDate,
    endDate,
    rangeMode,
    count = 10,
    slots,
    namingPattern = "Buổi {n}",
    startNumber = 1,
    existingSessions = [],
    today = formatUtcDate(new Date()),
  } = params;

  if (!startDate || slots.length === 0) {
    return [];
  }

  // Sort slots by weekday, then startTime
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.startTime.localeCompare(b.startTime);
  });

  const activeWeekdays = new Set(sortedSlots.map((s) => s.weekday));

  const results: BatchSessionDraftItem[] = [];
  const currentDate = parseDateUtc(startDate);
  const targetEndDate = endDate ? parseDateUtc(endDate) : null;

  const maxDaysSafety = 366;
  let daysIterated = 0;
  let sessionIndex = 0;

  while (daysIterated < maxDaysSafety) {
    daysIterated++;
    const dateStr = formatUtcDate(currentDate);

    // If date_range mode and exceeded endDate, stop
    if (rangeMode === "date_range" && targetEndDate && currentDate.getTime() > targetEndDate.getTime()) {
      break;
    }

    const currentIsoWeekday = getIsoWeekday(currentDate);

    if (activeWeekdays.has(currentIsoWeekday)) {
      const matchingSlots = sortedSlots.filter((s) => s.weekday === currentIsoWeekday);

      for (const slot of matchingSlots) {
        const sessionNumber = startNumber + sessionIndex;
        const notes = namingPattern.replace(/\{n\}/g, String(sessionNumber));

        // Check conflicts against existing sessions
        const isDuplicate = existingSessions.some((ex) => {
          if (ex.sessionDate !== dateStr) return false;
          if (slot.scheduleTemplateId && ex.scheduleTemplateId === slot.scheduleTemplateId) {
            return true;
          }
          // Same time overlap check
          return ex.startTime.slice(0, 5) === slot.startTime.slice(0, 5);
        });

        const isPast = dateStr < today;

        let statusConflict: "none" | "duplicate" | "past" = "none";
        let conflictDetail: string | undefined = undefined;

        if (isDuplicate) {
          statusConflict = "duplicate";
          conflictDetail = "Đã có buổi học của lớp vào ngày/giờ này";
        } else if (isPast) {
          statusConflict = "past";
          conflictDetail = "Ngày học trong quá khứ";
        }

        results.push({
          id: `batch-${dateStr}-${slot.startTime}-${sessionIndex}`,
          sessionNumber,
          sessionDate: dateStr,
          weekday: currentIsoWeekday,
          weekdayLabel: VIETNAMESE_WEEKDAY_NAMES[currentIsoWeekday] || `Thứ ${currentIsoWeekday}`,
          startTime: slot.startTime.slice(0, 5),
          endTime: slot.endTime.slice(0, 5),
          learningMode: slot.learningMode,
          sessionKind: slot.sessionKind ?? (slot.scheduleTemplateId ? "regular" : "additional"),
          scheduleTemplateId: slot.scheduleTemplateId ?? null,
          componentCode: slot.componentCode ?? null,
          roomName: slot.roomName ?? null,
          meetingUrl: slot.meetingUrl ?? null,
          notes,
          selected: !isDuplicate,
          statusConflict,
          conflictDetail,
        });

        sessionIndex++;

        // If count mode and reached requested count, stop
        if (rangeMode === "count" && results.length >= count) {
          return results;
        }
      }
    }

    // Advance 1 day in UTC
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return results;
}
