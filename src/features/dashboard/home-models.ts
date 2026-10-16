import {
  findNextClassSession,
  getRecordedCount,
  type ClassDetailFeed,
  type ClassSessionAttendanceTally,
} from "@/features/classes/detail/class-detail-models";
import type {
  AttentionItem,
  DashboardSectionState,
  ReceivablesAgingDistribution,
  StudentStatusDistribution,
} from "@/features/dashboard/read-models";
import type { SessionStatus } from "@/features/sessions/read-models";
import { isTuitionRequestInForce } from "@/features/tuition/period-summary";
import type { AttendanceVerificationPolicy, TimekeepingMonthlyEntry } from "@/features/timekeeping/types";
import { addDays, formatDateTime, formatTime, formatWeekdayDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import type { PermissionCode } from "@/lib/permissions/types";

/**
 * Pure models for the home dashboard (design 02). The loader lives in
 * `home-data.ts`; everything here is plain data so the page, the dev preview
 * and unit tests share it.
 */

/** Same per-feed contract as the class page: a value, or why there is none. */
export type DashboardFeed<T> = ClassDetailFeed<T>;

export const forbiddenFeed = { reason: "forbidden", status: "unavailable" } as const;
export const failedFeed = { reason: "failed", status: "unavailable" } as const;

export function readyFeed<T>(value: T): DashboardFeed<T> {
  return { status: "ready", value };
}

/** Executive RPC sections → feeds: hidden = forbidden, error = failed. */
export function fromSection<T>(section: DashboardSectionState<T>): DashboardFeed<T> {
  if (section.status === "ready") return readyFeed(section.data);
  return section.status === "hidden" ? forbiddenFeed : failedFeed;
}

export function isForbidden(feed: DashboardFeed<unknown>): boolean {
  return feed.status === "unavailable" && feed.reason === "forbidden";
}

export function isFailed(feed: DashboardFeed<unknown>): boolean {
  return feed.status === "unavailable" && feed.reason === "failed";
}

/**
 * Two layouts, chosen from permission codes only (never role names):
 * `center` (2a) for anyone who oversees money, tuition, payroll, enrolment or
 * schedules; `personal` (2b) for everyone else, typically teaching assistants.
 */
export type DashboardLayout = "center" | "personal";

export const CENTER_OVERSIGHT_PERMISSIONS: readonly PermissionCode[] = [
  "finance.view",
  "payments.view",
  "sepay.view",
  "tuition_periods.view",
  "payroll.manage",
  "payroll.owner_approve",
  "payroll.accountant_reconcile",
  "students.manage_status",
  "classes.manage_schedule",
];

export function getDashboardLayout(permissions: readonly PermissionCode[]): DashboardLayout {
  return CENTER_OVERSIGHT_PERMISSIONS.some((code) => permissions.includes(code)) ? "center" : "personal";
}

/** Which feeds the loader reads for a viewer; the rest are `forbidden` and never queried. */
export interface DashboardFeedAccess {
  awaitingLock: boolean;
  careOverdue: boolean;
  crmFollowUps: boolean;
  missingResults: boolean;
  myMonth: boolean;
  newLeads: boolean;
  newStudents: boolean;
  sepay: boolean;
  timekeeping: boolean;
  todaySessions: boolean;
  tuition: boolean;
  unmarked: boolean;
  weekAttendance: boolean;
}

/**
 * Feed access from permission codes and layout: a feed is read only when the
 * viewer holds what its source requires and the layout shows it (centre-wide
 * money and week figures in 2a; own month and results work in 2b; the own
 * shift strip in both).
 */
export function getDashboardFeedAccess(permissions: readonly PermissionCode[]): DashboardFeedAccess {
  const has = (code: PermissionCode) => permissions.includes(code);
  const isCenter = getDashboardLayout(permissions) === "center";
  const sessions = has("sessions.view");

  return {
    awaitingLock: sessions && has("sessions.lock"),
    careOverdue: has("student_care.view") && has("student_care.handle"),
    // The item links to /crm, which needs crm.view.
    crmFollowUps: has("crm.view") && has("crm.update"),
    missingResults: !isCenter && sessions && has("attendance.view") && has("results.view") && has("results.manage"),
    myMonth: !isCenter && has("timekeeping.check"),
    newLeads: isCenter && has("crm.view"),
    newStudents: isCenter && has("students.view"),
    sepay: isCenter && has("sepay.view"),
    // Own shift check-in in both layouts: anyone who checks in had it on home before 2a/2b.
    timekeeping: has("timekeeping.check"),
    todaySessions: sessions,
    tuition: isCenter && has("tuition_periods.view") && has("payments.view"),
    // Shown as a centre cell, or as work rows to someone who can mark or start sessions.
    unmarked: sessions && (isCenter || has("attendance.mark") || has("sessions.manage")),
    weekAttendance: isCenter && sessions && has("attendance.view"),
  };
}

export interface DashboardSessionRow {
  attendance: ClassSessionAttendanceTally | null;
  classCode: string;
  classId: string;
  className: string;
  endTime: string;
  id: string;
  learningMode: string;
  lockedAt: string | null;
  roomName: string | null;
  /** `null` = roster not resolved (no permission, failed call or over the cap). */
  rosterCount: number | null;
  sessionDate: string;
  startTime: string;
  status: SessionStatus;
}

export interface UnmarkedSessionItem {
  classCode: string;
  className: string;
  id: string;
  /**
   * `not_started` = still scheduled after its end time; `not_completed` =
   * started but never completed after its end time (it never reaches the lock
   * queue); `incomplete` = completed, unlocked, roster students without a mark.
   */
  reason: "not_started" | "not_completed" | "incomplete";
  recorded: number | null;
  roster: number | null;
  sessionDate: string;
  startTime: string;
}

export interface UnmarkedSessions {
  items: UnmarkedSessionItem[];
  /** More overdue or queued sessions exist than were read. */
  truncated: boolean;
}

export interface MissingResultItem {
  classCode: string;
  className: string;
  id: string;
  /** Present students without a result row. */
  missing: number;
  present: number;
  sessionDate: string;
  startTime: string;
}

export interface SepayBacklog {
  count: number;
  oldestAt: string | null;
  totalVnd: number;
  /** More transactions than were summed: the total is a lower bound. */
  totalIsPartial: boolean;
}

export interface TuitionProgress {
  collectedVnd: number;
  dueOn: string | null;
  endsOn: string;
  name: string;
  /** Unpaid part of requests whose due date has passed. */
  overdueVnd: number;
  /** Unpaid part not yet due (or no due date). */
  notDueVnd: number;
  payableVnd: number;
  periodId: string;
  requestCount: number;
  startsOn: string;
  status: "draft" | "locked";
}

export interface TimekeepingToday {
  /** Latest check-out today when no shift is open: the strip says the day's shift is done. */
  lastCheckOutAt: string | null;
  openEntry: { checkInAt: string; checkInMode: "online" | "offline"; id: string; workShiftName: string | null } | null;
  policy: AttendanceVerificationPolicy | null;
}

export interface MyMonthTimekeeping {
  gpsShiftCount: number;
  /** `YYYY-MM`. */
  month: string;
  pendingAdjustmentCount: number;
  shiftCount: number;
  workedMinutes: number;
}

export interface WeekAttendance {
  absent: number;
  present: number;
}

/** Ended, fully marked sessions still waiting for a lock (from the lock queue). */
export interface AwaitingLockSessions {
  count: number;
  /** The queue hit its read limit: the count is a floor. */
  truncated: boolean;
}

export interface DashboardHomeReadModel {
  awaitingLock: DashboardFeed<AwaitingLockSessions>;
  executive: {
    attention: DashboardFeed<AttentionItem[]>;
    receivablesAging: DashboardFeed<ReceivablesAgingDistribution>;
    studentStatus: DashboardFeed<StudentStatusDistribution>;
  };
  careOverdue: DashboardFeed<number>;
  crmFollowUps: DashboardFeed<number>;
  layout: DashboardLayout;
  missingResults: DashboardFeed<MissingResultItem[]>;
  myMonth: DashboardFeed<MyMonthTimekeeping>;
  newLeads: DashboardFeed<number>;
  newStudents: DashboardFeed<number>;
  /** HH:MM:SS in Vietnam time when the page was built. */
  nowTime: string;
  permissions: readonly PermissionCode[];
  sepay: DashboardFeed<SepayBacklog>;
  timekeeping: DashboardFeed<TimekeepingToday>;
  today: string;
  todaySessions: DashboardFeed<{ rows: DashboardSessionRow[]; truncated: boolean }>;
  /** `null` = no period yet. */
  tuition: DashboardFeed<TuitionProgress | null>;
  unmarked: DashboardFeed<UnmarkedSessions>;
  /** The first scheduled session after today, within a week; for "no session left today". */
  upcomingSession: DashboardFeed<DashboardSessionRow | null>;
  weekAttendance: DashboardFeed<WeekAttendance>;
  weekEnd: string;
  weekStart: string;
}

const LONG_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;

/** `2026-10-12` → `Thứ Hai, 12/10/2026`. */
export function formatLongWeekdayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const weekday = LONG_WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).getUTCDay()];
  return `${weekday}, ${match[3]}/${match[2]}/${match[1]}`;
}

/** Monday of the date's week and the Sunday after it. */
export function getWeekRange(today: string): { weekEnd: string; weekStart: string } {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
  const weekStart = addDays(today, 1 - weekday);
  return { weekEnd: addDays(weekStart, 6), weekStart };
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** `Còn 1 giờ 25 phút` before a session starts today; `null` once it has started. */
export function formatTimeUntil(startTime: string, nowTime: string): string | null {
  const diff = toMinutes(startTime) - toMinutes(nowTime);
  return diff <= 0 ? null : `Còn ${formatWorkedMinutes(diff)}`;
}

/** `12 giờ 30 phút`. */
export function formatWorkedMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} phút`;
  return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
}

/** `13/18`, or `—` when the roster or attendance is unknown, or the session is cancelled. */
export function formatAttendanceCount(row: Pick<DashboardSessionRow, "attendance" | "rosterCount" | "status">): string {
  if (row.status === "cancelled" || row.rosterCount === null || row.attendance === null) return "—";
  return `${getRecordedCount(row.attendance)}/${row.rosterCount}`;
}

export interface TodaySessionSummary {
  /** Non-cancelled sessions today. */
  total: number;
  /** Completed (locked or not). */
  finished: number;
  live: number;
}

export function summarizeTodaySessions(rows: readonly DashboardSessionRow[]): TodaySessionSummary {
  const summary: TodaySessionSummary = { finished: 0, live: 0, total: 0 };
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    summary.total += 1;
    if (row.status === "completed") summary.finished += 1;
    if (row.status === "in_progress") summary.live += 1;
  }
  return summary;
}

/**
 * The session to prepare for: one in progress or the next one today, else the
 * first scheduled session of the coming week. `null` when neither is known.
 */
export function pickNextSession(
  model: Pick<DashboardHomeReadModel, "nowTime" | "today" | "todaySessions" | "upcomingSession">,
): { isToday: boolean; row: DashboardSessionRow } | null {
  if (model.todaySessions.status === "ready") {
    const next = findNextClassSession(model.todaySessions.value.rows, model.today, model.nowTime);
    if (next) return { isToday: true, row: next };
  }
  if (model.upcomingSession.status === "ready" && model.upcomingSession.value) {
    return { isToday: false, row: model.upcomingSession.value };
  }
  return null;
}

/** The next-session card's state: a session, nothing ahead, or why it cannot tell. */
export function getNextSessionFeedState(model: Pick<DashboardHomeReadModel, "todaySessions" | "upcomingSession">): "ready" | "forbidden" | "failed" {
  if (isForbidden(model.todaySessions)) return "forbidden";
  if (isFailed(model.todaySessions) || isFailed(model.upcomingSession)) return "failed";
  return "ready";
}

// ---------------------------------------------------------------------------
// Summary strip (2a)

export interface SummaryCell {
  caption: string;
  key: "today" | "unmarked" | "debt" | "sepay";
  label: string;
  state: "ready" | "failed";
  tone: "default" | "warning" | "danger";
  value: string;
}

/** Thin strip of four numbers; a forbidden source drops its cell, a failed one says so. */
export function buildSummaryStrip(model: DashboardHomeReadModel): SummaryCell[] {
  const cells: SummaryCell[] = [];
  const failed = (key: SummaryCell["key"], label: string): SummaryCell => ({ caption: "Chưa tải được", key, label, state: "failed", tone: "default", value: "—" });

  if (model.todaySessions.status === "ready") {
    const summary = summarizeTodaySessions(model.todaySessions.value.rows);
    cells.push({
      caption: `${summary.finished} đã kết thúc · ${summary.live} đang diễn ra`,
      key: "today",
      label: "Buổi học hôm nay",
      state: "ready",
      tone: "default",
      value: String(summary.total),
    });
  } else if (isFailed(model.todaySessions)) {
    cells.push(failed("today", "Buổi học hôm nay"));
  }

  if (model.unmarked.status === "ready") {
    const { items, truncated } = model.unmarked.value;
    cells.push({
      caption: "Đã qua giờ kết thúc, chưa điểm danh đủ hoặc chưa hoàn thành",
      key: "unmarked",
      label: "Buổi chưa điểm danh",
      state: "ready",
      tone: items.length > 0 ? "danger" : "default",
      value: truncated ? `${items.length}+` : String(items.length),
    });
  } else if (isFailed(model.unmarked)) {
    cells.push(failed("unmarked", "Buổi chưa điểm danh"));
  }

  const aging = model.executive.receivablesAging;
  if (aging.status === "ready") {
    const overdue = getOverdueReceivablesVnd(aging.value);
    cells.push({
      caption: "Quá 30 ngày kể từ ngày lập yêu cầu",
      key: "debt",
      label: "Công nợ quá hạn",
      state: "ready",
      tone: overdue > 0 ? "danger" : "default",
      value: formatVnd(overdue),
    });
  } else if (isFailed(aging)) {
    cells.push(failed("debt", "Công nợ quá hạn"));
  }

  if (model.sepay.status === "ready") {
    const backlog = model.sepay.value;
    cells.push({
      caption:
        backlog.count === 0
          ? "Không có giao dịch chờ đối soát"
          : `Tổng ${formatVnd(backlog.totalVnd)}${backlog.totalIsPartial ? "+" : ""}${backlog.oldestAt ? ` · từ ${formatDateTime(backlog.oldestAt)}` : ""}`,
      key: "sepay",
      label: "Giao dịch SePay chưa khớp",
      state: "ready",
      tone: backlog.count > 0 ? "warning" : "default",
      value: String(backlog.count),
    });
  } else if (isFailed(model.sepay)) {
    cells.push(failed("sepay", "Giao dịch SePay chưa khớp"));
  }

  return cells;
}

// ---------------------------------------------------------------------------
// "Cần bạn xử lý" (2a) / "Việc của bạn" (2b)

export type NeedsActionKind =
  | "sessions"
  | "results"
  | "sepay"
  | "payroll"
  | "debt"
  | "advances"
  | "timekeeping"
  | "coaching"
  | "import"
  | "crm"
  | "care";

export interface NeedsActionItem {
  actionLabel: string;
  /** Text status next to the title: colour never carries the meaning alone. */
  badge: string;
  detail: string;
  href: string;
  key: string;
  kind: NeedsActionKind;
  title: string;
  tone: "danger" | "warning" | "info";
}

export interface NeedsActionList {
  /** Every permitted source loaded: only then may "Không có việc tồn" show. */
  complete: boolean;
  /** Work items including rows left out of the personal list (see `notes`). */
  total: number;
  /** Some source hit its read limit: `total` is a lower bound. */
  totalIsFloor: boolean;
  /** Labels of permitted sources that failed to load. */
  failed: string[];
  items: NeedsActionItem[];
  /** Short notes for rows left out (e.g. "Còn 3 buổi khác"). */
  notes: string[];
  /** Permitted sources; 0 hides the block. */
  sourceCount: number;
}

/** Rows per kind in the personal list; the rest are summarised. */
export const PERSONAL_ROWS_PER_KIND = 4;

function relativeDayLabel(date: string, today: string): string {
  if (date === today) return "hôm nay";
  if (date === addDays(today, -1)) return "hôm qua";
  return formatWeekdayDate(date, { year: false });
}

function sessionShortLabel(item: { className: string; sessionDate: string; startTime: string }, today: string): string {
  const day = relativeDayLabel(item.sessionDate, today);
  return item.sessionDate === today ? `${item.className} (${formatTime(item.startTime)} hôm nay)` : `${item.className} (${day})`;
}

/**
 * `permits` = the executive RPC's read permission for that count (without it
 * the count is a hidden null, not a real 0) plus the permission to act on it.
 */
const attentionRules: Record<
  string,
  { actionLabel: string; badge: string; href: string; kind: NeedsActionKind; permits: (has: (code: PermissionCode) => boolean) => boolean; title: (count: number) => string; detail: string; tone: NeedsActionItem["tone"] }
> = {
  "advances-pending": {
    actionLabel: "Xem tạm ứng",
    badge: "Chờ duyệt",
    detail: "Yêu cầu tạm ứng lương đang chờ xét duyệt.",
    href: "/advances",
    kind: "advances",
    permits: (has) => has("advances.view") && (has("advances.review") || has("advances.owner_approve")),
    title: (count) => `${count} yêu cầu tạm ứng chờ duyệt`,
    tone: "warning",
  },
  "coaching-urgent": {
    actionLabel: "Mở coaching",
    badge: "Ưu tiên cao",
    detail: "Phiếu coaching ưu tiên cao còn mở hoặc đang xử lý.",
    href: "/coaching",
    kind: "coaching",
    permits: (has) => has("coaching.view") && has("coaching.manage"),
    title: (count) => `${count} học sinh có phiếu coaching ưu tiên cao`,
    tone: "warning",
  },
  "import-conflicted": {
    actionLabel: "Xử lý xung đột",
    badge: "Xung đột",
    detail: "Đợt nhập dữ liệu bảng lương có dòng xung đột chờ rà soát.",
    href: "/payroll",
    kind: "import",
    permits: (has) => has("payroll.view") && has("payroll.import"),
    title: (count) => `${count} đợt nhập bảng lương có xung đột`,
    tone: "warning",
  },
  "payroll-review": {
    actionLabel: "Xem bảng lương",
    badge: "Chờ duyệt",
    detail: "Kỳ lương đã tính xong, đang ở bước chờ duyệt.",
    href: "/payroll",
    kind: "payroll",
    permits: (has) => has("payroll.view") && has("payroll.owner_approve"),
    title: (count) => `${count} kỳ lương chờ duyệt`,
    tone: "warning",
  },
  "timekeeping-adj": {
    actionLabel: "Duyệt điều chỉnh",
    badge: "Chờ duyệt",
    detail: "Nhân sự xin điều chỉnh giờ vào/ra ca.",
    href: "/timekeeping",
    kind: "timekeeping",
    // /timekeeping opens with any of view, check or manage_verification.
    permits: (has) =>
      has("timekeeping.approve_adjustment") && (has("timekeeping.view") || has("timekeeping.check") || has("timekeeping.manage_verification")),
    title: (count) => `${count} yêu cầu điều chỉnh công chờ duyệt`,
    tone: "warning",
  },
};

/** Attention ids whose item comes from attentionRules, in display order. */
const attentionOrder = ["payroll-review", "advances-pending", "timekeeping-adj", "coaching-urgent", "import-conflicted"] as const;

/**
 * The work list. Each item has one direct link to the route that resolves it
 * and is shown only to a viewer who can act there (permission codes only), so
 * an accountant's list holds finance items only. A source the viewer may not
 * read is skipped; one that failed is listed in `failed` and blocks the
 * "no backlog" message.
 */
export function buildNeedsAction(model: DashboardHomeReadModel): NeedsActionList {
  const has = (code: PermissionCode) => model.permissions.includes(code);
  const items: NeedsActionItem[] = [];
  const failed: string[] = [];
  const notes: string[] = [];
  let sourceCount = 0;
  let hiddenRows = 0;
  let totalIsFloor = false;

  const collectFrom = <T>(feed: DashboardFeed<T>, label: string, permitted: boolean, collect: (value: T) => void) => {
    if (!permitted || isForbidden(feed)) return;
    sourceCount += 1;
    if (feed.status === "ready") collect(feed.value);
    else failed.push(label);
  };

  const canWorkSessions = has("attendance.mark") || has("sessions.manage");

  collectFrom(model.unmarked, "buổi chưa điểm danh", canWorkSessions, ({ items: sessions, truncated }) => {
    if (sessions.length === 0) return;
    const sorted = [...sessions].sort((a, b) => (a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : b.sessionDate.localeCompare(a.sessionDate)));
    if (model.layout === "center") {
      const count = truncated ? `${sessions.length}+` : String(sessions.length);
      items.push({
        actionLabel: sessions.length === 1 ? "Mở buổi học" : "Xem buổi học",
        badge: "Quá hạn",
        detail: sorted.slice(0, 2).map((item) => sessionShortLabel(item, model.today)).join(" · ") + (sorted.length > 2 ? ` · và ${sorted.length - 2} buổi khác` : ""),
        // The list's "Chưa điểm danh" chip state (the same rule as this item), so landing presses the chip; `to` keeps its server window on past sessions.
        href: sessions.length === 1 ? `/sessions/${sessions[0].id}` : `/sessions?attendance=missing&to=${model.today}`,
        key: "sessions-unmarked",
        kind: "sessions",
        title: `${count} buổi quá giờ chưa xong điểm danh`,
        tone: "danger",
      });
      return;
    }

    // Starting or cancelling a session needs sessions.manage; without it the row only reports.
    const canStart = has("sessions.manage");
    for (const item of sorted.slice(0, PERSONAL_ROWS_PER_KIND)) {
      const when = `${formatWeekdayDate(item.sessionDate, { year: false })} · ${formatTime(item.startTime)}`;
      const base = { href: `/sessions/${item.id}`, key: `unmarked-${item.id}`, kind: "sessions" as const, tone: "danger" as const };
      if (item.reason === "incomplete") {
        items.push({
          ...base,
          actionLabel: "Điểm danh",
          badge: "Chưa khóa",
          detail: `${when} · điểm danh ${item.recorded ?? 0}/${item.roster ?? 0}, còn thiếu ${Math.max(0, (item.roster ?? 0) - (item.recorded ?? 0))}`,
          title: `Buổi ${item.className} chưa điểm danh đủ`,
        });
      } else if (item.reason === "not_completed") {
        items.push({
          ...base,
          actionLabel: "Mở buổi",
          badge: "Chưa hoàn thành",
          detail: `${when} · đã qua giờ kết thúc, cần điểm danh đủ rồi hoàn thành buổi`,
          title: `Buổi ${item.className} chưa hoàn thành`,
        });
      } else {
        items.push({
          ...base,
          actionLabel: "Mở buổi",
          badge: "Chưa bắt đầu",
          detail: canStart ? `${when} · đã qua giờ, cần bắt đầu để điểm danh hoặc hủy buổi` : `${when} · đã qua giờ nhưng buổi chưa được bắt đầu`,
          title: `Buổi ${item.className} chưa bắt đầu`,
        });
      }
    }
    // The centre item already says "N+"; only the personal rows leave sessions uncounted.
    if (truncated) totalIsFloor = true;
    const rest = sorted.length - PERSONAL_ROWS_PER_KIND;
    if (rest > 0) {
      hiddenRows += rest;
      notes.push(`Còn ${rest}${truncated ? "+" : ""} buổi chưa điểm danh khác ở trang Buổi học.`);
    } else if (truncated) notes.push("Còn buổi chưa điểm danh khác ở trang Buổi học.");
  });

  collectFrom(model.awaitingLock, "buổi chờ khóa", has("sessions.lock"), ({ count, truncated }) => {
    if (count <= 0) return;
    items.push({
      actionLabel: "Xem buổi chờ khóa",
      // Only the ready set (roster > 0, nothing missing) is counted: the list's word for it,
      // since the "Chờ khóa" chip the link lands on counts every completed, unlocked session.
      badge: "Sẵn sàng khóa",
      detail: "Đã điểm danh đủ. Khóa buổi để chốt học phí và công của buổi.",
      // The list's "Chờ khóa" chip state, so landing presses the chip.
      href: `/sessions?status=completed&lock=unlocked&to=${model.today}`,
      key: "sessions-awaiting-lock",
      kind: "sessions",
      title: `${count}${truncated ? "+" : ""} buổi sẵn sàng khóa`,
      tone: "info",
    });
  });

  collectFrom(model.missingResults, "kết quả học tập", has("results.manage"), (sessions) => {
    for (const item of sessions.slice(0, PERSONAL_ROWS_PER_KIND)) {
      items.push({
        actionLabel: "Nhập kết quả",
        badge: "Thiếu kết quả",
        detail: `${formatWeekdayDate(item.sessionDate, { year: false })} · ${formatTime(item.startTime)} · đã nhập ${item.present - item.missing}/${item.present} học sinh có mặt`,
        href: `/sessions/${item.id}`,
        key: `results-${item.id}`,
        kind: "results",
        title: `Buổi ${item.className} thiếu ${item.missing} kết quả`,
        tone: "warning",
      });
    }
    if (sessions.length > PERSONAL_ROWS_PER_KIND) {
      hiddenRows += sessions.length - PERSONAL_ROWS_PER_KIND;
      notes.push(`Còn ${sessions.length - PERSONAL_ROWS_PER_KIND} buổi thiếu kết quả khác.`);
    }
  });

  collectFrom(model.sepay, "giao dịch SePay", has("sepay.allocate") || has("sepay.accountant_confirm"), (backlog) => {
    if (backlog.count === 0) return;
    items.push({
      actionLabel: "Đối soát ngay",
      badge: "Chưa khớp",
      detail: `${formatVnd(backlog.totalVnd)}${backlog.totalIsPartial ? "+" : ""}${backlog.oldestAt ? ` · cũ nhất ${formatDateTime(backlog.oldestAt)}` : ""}`,
      href: "/finance/sepay?queue=review",
      key: "sepay",
      kind: "sepay",
      title: `${backlog.count} giao dịch SePay chưa khớp`,
      tone: "warning",
    });
  });

  const attention = model.executive.attention;
  const attentionPermitted = attentionOrder.some((id) => attentionRules[id].permits(has));
  collectFrom(attention, "việc chờ duyệt", attentionPermitted, (entries) => {
    for (const id of attentionOrder) {
      const rule = attentionRules[id];
      const entry = entries.find((candidate) => candidate.id === id);
      if (!rule.permits(has) || !entry || entry.count <= 0) continue;
      items.push({
        actionLabel: rule.actionLabel,
        badge: rule.badge,
        detail: rule.detail,
        href: rule.href,
        key: id,
        kind: rule.kind,
        title: rule.title(entry.count),
        tone: rule.tone,
      });
    }
  });

  collectFrom(model.executive.receivablesAging, "công nợ", has("payments.view"), (aging) => {
    const overdue = getOverdueReceivablesVnd(aging);
    const overdueRequests = attention.status === "ready" ? attention.value.find((entry) => entry.id === "payments-overdue")?.count ?? 0 : 0;
    if (overdue <= 0 && overdueRequests <= 0) return;
    items.push({
      actionLabel: "Xem công nợ",
      badge: "Quá hạn",
      detail: [
        aging.over60DaysVnd > 0 ? `${formatVnd(aging.over60DaysVnd)} quá 60 ngày` : null,
        overdueRequests > 0 ? `${overdueRequests} yêu cầu chờ thanh toán quá 14 ngày` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Tính từ ngày lập yêu cầu thanh toán",
      href: "/finance/payment-requests",
      key: "debt",
      kind: "debt",
      title: overdue > 0 ? `Công nợ quá 30 ngày: ${formatVnd(overdue)}` : `${overdueRequests} yêu cầu thanh toán quá 14 ngày`,
      tone: "danger",
    });
  });

  collectFrom(model.crmFollowUps, "lịch hẹn CRM", has("crm.view") && has("crm.update"), (count) => {
    if (count <= 0) return;
    items.push({
      actionLabel: "Mở CRM",
      badge: "Đến hạn",
      detail: "Lịch hẹn theo dõi lead do bạn phụ trách đã đến hạn.",
      href: "/crm",
      key: "crm",
      kind: "crm",
      title: `${count} lịch hẹn theo dõi lead đến hạn`,
      tone: "info",
    });
  });

  collectFrom(model.careOverdue, "việc chăm sóc", has("student_care.view") && has("student_care.handle"), (count) => {
    if (count <= 0) return;
    items.push({
      actionLabel: "Mở chăm sóc",
      badge: "Quá hạn",
      detail: "Việc chăm sóc học sinh bạn phụ trách đã quá hạn liên hệ hoặc theo dõi.",
      href: "/student-care?mine=true&overdue=true",
      key: "care",
      kind: "care",
      title: `${count} việc chăm sóc quá hạn của bạn`,
      tone: "warning",
    });
  });

  return { complete: failed.length === 0, failed, items, notes, sourceCount, total: items.length + hiddenRows, totalIsFloor };
}

/** `12`, or `12+` when a source hit its read limit. */
export function formatBacklogCount(list: Pick<NeedsActionList, "total" | "totalIsFloor">): string {
  return `${list.total}${list.totalIsFloor ? "+" : ""}`;
}

/** "Không có việc tồn" only when every permitted source loaded and none has work. */
export function hasNoBacklog(list: NeedsActionList): boolean {
  return list.sourceCount > 0 && list.complete && list.items.length === 0;
}

// ---------------------------------------------------------------------------
// "Tuần này" (2a) and "Tháng N của bạn" (2b)

export interface StatRow {
  hint?: string;
  key: string;
  label: string;
  state: "ready" | "failed";
  value: string;
}

/** Receivables more than 30 days old (the strip cell and the debt item). */
export function getOverdueReceivablesVnd(aging: ReceivablesAgingDistribution): number {
  return aging.from31To60DaysVnd + aging.over60DaysVnd;
}

/** Present / (present + absences); `null` when nothing was marked. */
export function getAttendanceRate(week: WeekAttendance): number | null {
  const marked = week.present + week.absent;
  return marked === 0 ? null : Math.round((week.present / marked) * 100);
}

function statRow<T>(feed: DashboardFeed<T>, key: string, label: string, format: (value: T) => { hint?: string; value: string }): StatRow | null {
  if (isForbidden(feed)) return null;
  if (feed.status === "unavailable") return { key, label, state: "failed", value: "—", hint: "Chưa tải được" };
  return { key, label, state: "ready", ...format(feed.value) };
}

export function buildWeekStats(model: DashboardHomeReadModel): StatRow[] {
  const students = model.executive.studentStatus;
  return [
    statRow(students, "active", "Học sinh đang học", (value) => ({ value: String(value.activeCount) })),
    statRow(model.newStudents, "new-students", "Hồ sơ học sinh mới", (value) => ({ hint: "tạo trong tuần", value: String(value) })),
    statRow(students, "reserved", "Đang bảo lưu", (value) => ({ hint: "hiện tại", value: String(value.reservedCount) })),
    statRow(model.weekAttendance, "attendance", "Chuyên cần tuần này", (value) => {
      const rate = getAttendanceRate(value);
      return rate === null ? { hint: "chưa có điểm danh", value: "—" } : { hint: `${value.present}/${value.present + value.absent} lượt có mặt`, value: `${rate}%` };
    }),
    statRow(model.newLeads, "leads", "Lead CRM mới", (value) => ({ hint: "tạo trong tuần", value: String(value) })),
  ].filter((row): row is StatRow => row !== null);
}

export function buildMyMonthStats(model: DashboardHomeReadModel): StatRow[] {
  return [
    statRow(model.myMonth, "shifts", "Ca đã chấm công", (value) => ({ value: String(value.shiftCount) })),
    statRow(model.myMonth, "minutes", "Giờ công", (value) => ({ value: formatWorkedMinutes(value.workedMinutes) })),
    statRow(model.myMonth, "gps", "Ca có vị trí GPS", (value) => ({ value: `${value.gpsShiftCount} / ${value.shiftCount}` })),
    statRow(model.myMonth, "adjustments", "Điều chỉnh chờ duyệt", (value) => ({ value: String(value.pendingAdjustmentCount) })),
  ].filter((row): row is StatRow => row !== null);
}

/** Month entries → the personal month block. Open shifts count as shifts; minutes come from closed ones. */
export function summarizeMyMonth(entries: readonly TimekeepingMonthlyEntry[], month: string): MyMonthTimekeeping {
  return {
    gpsShiftCount: entries.filter((entry) => entry.hasCheckInGpsEvidence).length,
    month,
    pendingAdjustmentCount: entries.filter((entry) => entry.adjustmentStatus === "pending").length,
    shiftCount: entries.length,
    workedMinutes: entries.reduce((sum, entry) => sum + (entry.totalMinutes ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Tuition period progress

export interface TuitionRequestState {
  expectedVnd: number;
  paidVnd: number;
  status: string;
}

/**
 * Collection progress of a locked period from its current items' payment
 * requests. Only requests in force count (cancelled, expired and unknown
 * statuses are left out, the same rule as the tuition period pages); paid is capped at expected so an
 * overpayment never shows as more than collected in full.
 */
export function computeTuitionProgress(
  period: { dueOn: string | null; endsOn: string; id: string; name: string; startsOn: string; status: "draft" | "locked" },
  requests: readonly TuitionRequestState[],
  today: string,
): TuitionProgress {
  let payableVnd = 0;
  let collectedVnd = 0;
  let requestCount = 0;

  for (const request of requests) {
    if (!isTuitionRequestInForce(request.status) || request.expectedVnd <= 0) continue;
    requestCount += 1;
    payableVnd += request.expectedVnd;
    collectedVnd += Math.min(Math.max(request.paidVnd, 0), request.expectedVnd);
  }

  const remaining = payableVnd - collectedVnd;
  const isPastDue = period.dueOn !== null && period.dueOn < today;

  return {
    collectedVnd,
    dueOn: period.dueOn,
    endsOn: period.endsOn,
    name: period.name,
    notDueVnd: isPastDue ? 0 : remaining,
    overdueVnd: isPastDue ? remaining : 0,
    payableVnd,
    periodId: period.id,
    requestCount,
    startsOn: period.startsOn,
    status: period.status,
  };
}

/** Whole-number shares that add up to 100 when anything is payable. */
export function getTuitionShares(progress: TuitionProgress): { collected: number; notDue: number; overdue: number } {
  if (progress.payableVnd <= 0) return { collected: 0, notDue: 0, overdue: 0 };
  const collected = Math.round((progress.collectedVnd / progress.payableVnd) * 100);
  // Two shares can both round up; the overdue one gives way so the bar never passes 100.
  const overdue = Math.min(Math.round((progress.overdueVnd / progress.payableVnd) * 100), 100 - collected);
  return { collected, notDue: 100 - collected - overdue, overdue };
}

/**
 * The period the dashboard follows: the latest locked one that has started,
 * else the latest started one, else the newest. Input is newest first.
 */
export function pickCurrentTuitionPeriod<T extends { startsOn: string; status: "draft" | "locked" }>(periods: readonly T[], today: string): T | null {
  const started = periods.filter((period) => period.startsOn <= today);
  return started.find((period) => period.status === "locked") ?? started[0] ?? periods[0] ?? null;
}

// ---------------------------------------------------------------------------
// Missing results

/** Per session, present students without a result row. Sessions with none missing are left out. */
export function findMissingResults(
  sessions: ReadonlyArray<Pick<MissingResultItem, "classCode" | "className" | "id" | "sessionDate" | "startTime">>,
  attendance: ReadonlyArray<{ attendance_status: string; class_session_id: string; student_id: string }>,
  results: ReadonlyArray<{ class_session_id: string; student_id: string }>,
): MissingResultItem[] {
  const present = new Map<string, Set<string>>();
  for (const entry of attendance) {
    if (entry.attendance_status !== "present" && entry.attendance_status !== "additional_study") continue;
    const set = present.get(entry.class_session_id) ?? new Set<string>();
    set.add(entry.student_id);
    present.set(entry.class_session_id, set);
  }

  const recorded = new Map<string, Set<string>>();
  for (const entry of results) {
    const set = recorded.get(entry.class_session_id) ?? new Set<string>();
    set.add(entry.student_id);
    recorded.set(entry.class_session_id, set);
  }

  return sessions.flatMap((session) => {
    const students = present.get(session.id);
    if (!students || students.size === 0) return [];
    const done = recorded.get(session.id) ?? new Set<string>();
    const missing = [...students].filter((studentId) => !done.has(studentId)).length;
    return missing > 0 ? [{ ...session, missing, present: students.size }] : [];
  });
}
