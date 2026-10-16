import type { SessionDirectoryItem, SessionKind, SessionLearningMode, SessionStatus } from "@/features/sessions/read-models";
import type { UnlockedSessionQueue, UnlockedSessionQueueItem } from "@/features/sessions/unlocked-sessions-data";

/** Friday 16/10/2026 at noon (Vietnam): the preview clock for "Hôm nay", "Tuần này" and the overdue captions. */
export const sessionPreviewToday = "2026-10-16";
export const sessionPreviewNowTime = "12:00:00";

const sessionClasses = [
  { code: "L-9A26", grade: 9, id: "class-0", level: "A", name: "Toán 9A tối 2-4-6" },
  { code: "L-8B26", grade: 8, id: "class-3", level: "B", name: "Toán 8B chiều 3-5-7" },
  { code: "L-10NC26", grade: 10, id: "class-7", level: "CLC", name: "Toán 10 nâng cao tối 2-6" },
  { code: "L-7BO26", grade: 7, id: "class-9", level: "A", name: "Toán 7B online tối 3-5" },
] as const;

interface SessionRow {
  attendance?: number;
  cancellationReason?: string;
  classIndex: number;
  component?: string;
  date: string;
  eligible?: number;
  end: string;
  id: string;
  kind?: SessionKind;
  locked?: boolean;
  marked?: number;
  /** The online session has a meeting link (the list only gets the flag). */
  meetingLink?: boolean;
  mode?: SessionLearningMode;
  results?: number;
  room?: string | null;
  start: string;
  status: SessionStatus;
}

const rows: SessionRow[] = [
  { classIndex: 0, date: "2026-10-19", end: "20:00", id: "s-next-week", room: "P.102", start: "18:00", status: "scheduled" },
  { classIndex: 1, date: "2026-10-17", end: "16:00", id: "s-tomorrow", room: "P.201", start: "14:00", status: "scheduled" },
  { classIndex: 0, date: "2026-10-16", end: "20:00", id: "s-today-later", room: "P.102", start: "18:00", status: "scheduled" },
  // Ended this morning but never started: "Chưa bắt đầu", needs attendance.
  { classIndex: 3, date: "2026-10-16", end: "10:00", id: "s-today-not-started", mode: "online", start: "08:00", status: "scheduled" },
  // Started, ended at 11:30, never completed: "Chưa hoàn thành".
  { attendance: 9, classIndex: 2, date: "2026-10-16", eligible: 8, end: "11:30", id: "s-today-running", marked: 9, mode: "hybrid", results: 3, room: "P.101", start: "09:30", status: "in_progress" },
  // The most recently completed session: in the queue (one roster student unmarked) in `state=normal`;
  // in `state=capped` the full queue page cuts it, so no readiness is claimed, "x đã ghi" only.
  { attendance: 11, classIndex: 3, date: "2026-10-15", eligible: 11, end: "21:00", id: "s-unqueued", marked: 11, meetingLink: true, mode: "online", results: 10, start: "19:00", status: "completed" },
  // Lock queue: every roster student marked, ready to lock (a walk-in makes 16 attendance rows).
  { attendance: 16, classIndex: 0, component: "ĐS-12", date: "2026-10-14", eligible: 15, end: "20:00", id: "s-lockable", marked: 15, results: 15, room: "P.102", start: "18:00", status: "completed" },
  // Lock queue: two roster students still unmarked.
  { attendance: 16, classIndex: 1, date: "2026-10-15", eligible: 14, end: "16:00", id: "s-missing", marked: 16, results: 9, room: "P.201", start: "14:00", status: "completed" },
  // Lock queue: a makeup session with nobody on the roster.
  { attendance: 0, classIndex: 2, date: "2026-10-13", eligible: 0, end: "21:00", id: "s-no-roster", kind: "makeup", marked: 0, results: 0, room: "P.101", start: "19:00", status: "completed" },
  { cancellationReason: "Thầy Vinh đi tập huấn chuyên môn cả ngày, lớp học bù vào thứ 7 tuần sau theo lịch đã báo phụ huynh qua Zalo.", classIndex: 0, date: "2026-10-12", end: "20:00", id: "s-cancelled", room: "P.102", start: "18:00", status: "cancelled" },
  { attendance: 12, classIndex: 3, date: "2026-10-10", eligible: 12, end: "21:00", id: "s-online-locked", locked: true, marked: 12, meetingLink: true, mode: "online", results: 12, start: "19:00", status: "completed" },
  { attendance: 14, classIndex: 2, date: "2026-10-09", eligible: 13, end: "21:00", id: "s-hybrid-locked", kind: "additional", locked: true, marked: 14, mode: "hybrid", results: 13, room: "P.101", start: "19:00", status: "completed" },
  ...Array.from({ length: 12 }, (_, index): SessionRow => {
    const day = 8 - Math.floor(index / 3);
    const classIndex = index % 3;
    const roster = [18, 16, 14][classIndex];
    return {
      attendance: roster,
      classIndex,
      date: `2026-10-0${day}`,
      eligible: roster - (index % 2),
      end: classIndex === 1 ? "16:00" : "20:00",
      id: `s-older-${index}`,
      locked: true,
      marked: roster,
      results: roster - (index % 2),
      room: ["P.102", "P.201", "P.101"][classIndex],
      start: classIndex === 1 ? "14:00" : "18:00",
      status: "completed",
    };
  }),
];

export const previewSessions: SessionDirectoryItem[] = rows.map((row) => {
  const classInfo = sessionClasses[row.classIndex];
  const counted = row.status !== "scheduled" && row.status !== "cancelled";

  return {
    attendanceCount: counted ? (row.attendance ?? 0) : 0,
    cancellationReason: row.cancellationReason ?? null,
    classCode: classInfo.code,
    classId: classInfo.id,
    className: classInfo.name,
    componentCode: row.component ?? null,
    endTime: `${row.end}:00`,
    grade: classInfo.grade,
    hasMeetingUrl: row.meetingLink ?? false,
    id: row.id,
    learningMode: row.mode ?? "offline",
    level: classInfo.level,
    lockedAt: row.locked ? `${row.date}T15:00:00Z` : null,
    markedRosterCount: counted ? (row.marked ?? 0) : 0,
    resultCount: counted ? (row.results ?? 0) : 0,
    resultEligibleCount: counted ? (row.eligible ?? 0) : 0,
    roomName: row.room ?? null,
    sessionDate: row.date,
    sessionKind: row.kind ?? "regular",
    startTime: `${row.start}:00`,
    status: row.status,
  };
});

function queueItem(id: string, missingAttendanceCount: number, rosterCount: number, daysSinceCompleted: number, completedAtUtc = "13:30:00"): UnlockedSessionQueueItem {
  const session = previewSessions.find((item) => item.id === id);
  if (!session) throw new Error(`Unknown preview session ${id}`);

  return {
    attendanceCount: session.attendanceCount ?? 0,
    autoLockOn: null,
    classCode: session.classCode,
    classId: session.classId,
    className: session.className,
    completedAt: `${session.sessionDate}T${completedAtUtc}Z`,
    completedByName: "Phạm Thu Hạnh",
    daysSinceCompleted,
    endTime: session.endTime,
    id,
    missingAttendanceCount,
    rosterCount,
    sessionDate: session.sessionDate,
    sessionKind: session.sessionKind,
    startTime: session.startTime,
  };
}

const queueItems = [
  queueItem("s-no-roster", 0, 0, 3),
  queueItem("s-lockable", 0, 15, 2),
  queueItem("s-missing", 2, 18, 1),
  // Completed at 21:30 Vietnam time, after s-missing: the newest item, so the first a full page cuts.
  queueItem("s-unqueued", 1, 12, 1, "14:30:00"),
];

/** `state=normal`: every completed, unlocked fixture session, oldest completed first as the RPC returns it. */
export const previewSessionQueue: UnlockedSessionQueue = { autoLockAfterDays: 0, items: queueItems };

/**
 * `state=capped`: stands in for a full RPC page (`queueStatus="partial"`), which
 * drops the most recently completed sessions; here `s-unqueued` is the one cut.
 */
export const cappedPreviewSessionQueue: UnlockedSessionQueue = { autoLockAfterDays: 0, items: queueItems.slice(0, -1) };
