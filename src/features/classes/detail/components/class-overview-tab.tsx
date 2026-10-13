import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, CountChip } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import type { ClassDetailWorkspace } from "@/features/classes/detail/class-detail-data";
import {
  classSessionStageMeta,
  findNextClassSession,
  formatSessionOrdinal,
  getAttendanceChart,
  getClassAttendanceRate,
  getClassSessionStage,
  getRecordedCount,
  summarizeClassSessions,
  type ClassSessionRow,
} from "@/features/classes/detail/class-detail-models";
import {
  formatWeekdayName,
  getDurationMinutes,
  sortSchedules,
} from "@/features/classes/detail/components/class-schedule-section";
import type { ClassDetailReadModel } from "@/features/classes/read-models";
import { MetaList, PanelNotice, ProfilePanel } from "@/features/students/detail/components/student-profile-shared";
import { formatIsoDate, formatTime, formatWeekdayDate } from "@/lib/datetime";
import { formatLearningMode, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Rows per kind in "Lớp này cần bạn xử lý"; the rest are summarised. */
const NEEDS_ACTION_ROWS = 3;

export interface ClassOverviewTabProps {
  activeStudentCount: number | null;
  batchHref: string | null;
  canLockSessions: boolean;
  canManageSchedule: boolean;
  canViewCare: boolean;
  detail: ClassDetailReadModel;
  nowTime: string;
  onShowSessions?: () => void;
  today: string;
  workspace: ClassDetailWorkspace;
}

/**
 * Class overview (design 03a): next session, work the class owes, attendance by
 * session on the left; health, weekly schedule and class facts on the right.
 * Teacher and fee-package blocks of the mock-up are left out: the data model
 * has no class staff assignment and tuition is priced per student.
 */
export function ClassOverviewTab({
  activeStudentCount,
  batchHref,
  canLockSessions,
  canManageSchedule,
  canViewCare,
  detail,
  nowTime,
  onShowSessions,
  today,
  workspace,
}: ClassOverviewTabProps) {
  const sessionRows = workspace.sessions.status === "ready" ? workspace.sessions.value.rows : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 content-start gap-4">
        <NextSessionPanel
          activeStudentCount={activeStudentCount}
          batchHref={batchHref}
          canManageSchedule={canManageSchedule}
          detail={detail}
          nowTime={nowTime}
          onShowSessions={onShowSessions}
          rows={sessionRows}
          sessionsFeed={workspace.sessions}
          today={today}
        />
        <NeedsActionPanel canLockSessions={canLockSessions} canViewCare={canViewCare} rows={sessionRows} today={today} workspace={workspace} />
        {sessionRows ? <AttendanceChartPanel attendanceReady={workspace.attendance.status === "ready"} rows={sessionRows} /> : null}
      </div>

      <aside className="grid content-start gap-4">
        <HealthPanel activeStudentCount={activeStudentCount} rows={sessionRows} today={today} workspace={workspace} />
        <WeeklySchedulePanel
          canManageSchedule={canManageSchedule}
          detail={detail}
          showTuitionNote={workspace.debt.status === "ready" || workspace.debt.reason === "failed"}
        />
        <ClassFactsPanel detail={detail} />
      </aside>
    </div>
  );
}

function SectionTitle({ children, id }: { children: ReactNode; id: string }) {
  return (
    <h2 className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted" id={id}>
      {children}
    </h2>
  );
}

function NextSessionPanel({
  activeStudentCount,
  batchHref,
  canManageSchedule,
  detail,
  nowTime,
  onShowSessions,
  rows,
  sessionsFeed,
  today,
}: {
  activeStudentCount: number | null;
  batchHref: string | null;
  canManageSchedule: boolean;
  detail: ClassDetailReadModel;
  nowTime: string;
  onShowSessions?: () => void;
  rows: ClassSessionRow[] | null;
  sessionsFeed: ClassDetailWorkspace["sessions"];
  today: string;
}) {
  const next = rows ? findNextClassSession(rows, today, nowTime) : null;
  const summary = rows ? summarizeClassSessions(rows, today) : null;
  const progress = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const hasSchedule = detail.activeScheduleCount > 0;

  return (
    <section aria-labelledby="class-next-session-title" className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-row px-4 py-3">
        <SectionTitle id="class-next-session-title">Việc tiếp theo của lớp</SectionTitle>
        {next ? <span className="text-secondary text-text-muted">{formatWeekdayDate(next.sessionDate)}</span> : null}
      </div>

      <div className="grid gap-3 px-4 py-4">
        {sessionsFeed.status === "unavailable" ? (
          <PanelNotice tone={sessionsFeed.reason === "failed" ? "warning" : "neutral"}>
            {sessionsFeed.reason === "failed" ? "Chưa tải được lịch buổi học." : "Không có quyền xem buổi học của lớp."}
          </PanelNotice>
        ) : next ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[18px] font-semibold leading-7 text-text-strong">
                  Buổi {next.ordinal ?? "—"} · {formatWeekdayDate(next.sessionDate, { year: false })} · {formatTime(next.startTime)}
                </p>
                <Badge tone={classSessionStageMeta[getClassSessionStage(next, today)].tone}>
                  {classSessionStageMeta[getClassSessionStage(next, today)].label}
                </Badge>
              </div>
              <p className="mt-1 text-secondary text-text-muted">
                {[
                  `${formatTime(next.startTime)}–${formatTime(next.endTime)}`,
                  formatLearningMode(next.learningMode),
                  next.roomName,
                  activeStudentCount !== null ? `${activeStudentCount} học sinh đang học` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Link className={cn(getButtonClassName({ variant: "secondary" }), "shrink-0")} href={`/sessions/${next.id}`}>
              Mở buổi {next.ordinal ?? ""}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-dashed border-border-strong bg-surface-subtle px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-text-strong">Chưa xếp lịch</p>
              <p className="mt-0.5 text-secondary text-text-muted">
                {detail.status !== "active"
                  ? "Lớp không ở trạng thái hoạt động nên không có buổi sắp tới."
                  : hasSchedule
                    ? "Lớp có lịch cố định nhưng chưa có buổi nào sắp tới. Tạo buổi theo lịch để bắt đầu."
                    : "Lớp chưa có lịch học cố định và chưa có buổi sắp tới."}
              </p>
            </div>
            {detail.status === "active" && hasSchedule && batchHref ? (
              <Link className={cn(getButtonClassName({ variant: "secondary" }), "shrink-0")} href={batchHref}>
                <CalendarPlus aria-hidden="true" size={16} strokeWidth={2} />
                Xếp lịch
              </Link>
            ) : detail.status === "active" && !hasSchedule && canManageSchedule ? (
              <a className={cn(getButtonClassName({ variant: "secondary" }), "shrink-0")} href="#class-schedule-management">
                <CalendarPlus aria-hidden="true" size={16} strokeWidth={2} />
                Thiết lập lịch
              </a>
            ) : null}
          </div>
        )}

        {summary && summary.total > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border-row pt-3 text-secondary">
            <span className="text-text-muted">Tiến độ lớp</span>
            <span
              aria-label={`Đã học ${summary.completed} trên ${summary.total} buổi`}
              aria-valuemax={summary.total}
              aria-valuemin={0}
              aria-valuenow={summary.completed}
              className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-subtle"
              role="progressbar"
            >
              <span className="progress-grow block h-full rounded-full bg-action-primary" style={{ width: `${progress}%` }} />
            </span>
            <span className="font-semibold tabular-nums text-text-strong">
              {summary.completed} / {summary.total} buổi
            </span>
            {onShowSessions ? (
              <button
                className="font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                onClick={onShowSessions}
                type="button"
              >
                Tất cả buổi
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface NeedsActionItem {
  action: ReactNode;
  detail: string;
  key: string;
  title: string;
  tone: "warning" | "danger" | "neutral";
}

const inlineLinkClassName = cn(getButtonClassName({ size: "sm", variant: "secondary" }), "shrink-0");

function NeedsActionPanel({
  canLockSessions,
  canViewCare,
  rows,
  today,
  workspace,
}: {
  canLockSessions: boolean;
  canViewCare: boolean;
  rows: ClassSessionRow[] | null;
  today: string;
  workspace: ClassDetailWorkspace;
}) {
  const items: NeedsActionItem[] = [];
  const notes: string[] = [];

  if (rows) {
    const pendingLock = rows.filter((row) => getClassSessionStage(row, today) === "pending_lock");
    const overdue = rows.filter((row) => getClassSessionStage(row, today) === "overdue");

    for (const row of pendingLock.slice(0, NEEDS_ACTION_ROWS)) {
      const recorded = row.attendance ? getRecordedCount(row.attendance) : null;
      const attendanceComplete = recorded !== null && row.rosterCount !== null && recorded >= row.rosterCount && row.rosterCount > 0;
      const parts = [
        formatWeekdayDate(row.sessionDate, { year: false }),
        recorded !== null && row.rosterCount !== null
          ? attendanceComplete
            ? `điểm danh ${recorded}/${row.rosterCount} xong`
            : `điểm danh ${recorded}/${row.rosterCount}, còn thiếu ${row.rosterCount - recorded}`
          : null,
        row.resultCount !== null && row.attendance ? `${row.resultCount} kết quả đã nhập` : null,
      ];

      items.push({
        action: (
          <Link className={inlineLinkClassName} href={`/sessions/${row.id}`}>
            {!attendanceComplete && recorded !== null ? "Điểm danh" : canLockSessions ? "Khóa buổi" : "Mở buổi"}
          </Link>
        ),
        detail: parts.filter(Boolean).join(" · "),
        key: `lock-${row.id}`,
        title: `Buổi ${row.ordinal ?? "—"} chưa khóa`,
        tone: attendanceComplete ? "warning" : "danger",
      });
    }

    if (pendingLock.length > NEEDS_ACTION_ROWS) {
      notes.push(`Còn ${pendingLock.length - NEEDS_ACTION_ROWS} buổi chờ khóa khác ở tab Buổi học.`);
    }

    for (const row of overdue.slice(0, NEEDS_ACTION_ROWS)) {
      items.push({
        action: (
          <Link className={inlineLinkClassName} href={`/sessions/${row.id}`}>
            Mở buổi
          </Link>
        ),
        detail: `${formatWeekdayDate(row.sessionDate, { year: false })} · ${formatTime(row.startTime)} · cần kết thúc hoặc hủy buổi`,
        key: `overdue-${row.id}`,
        title: `Buổi ${row.ordinal ?? "—"} đã qua nhưng chưa bắt đầu`,
        tone: "danger",
      });
    }

    if (overdue.length > NEEDS_ACTION_ROWS) {
      notes.push(`Còn ${overdue.length - NEEDS_ACTION_ROWS} buổi đã qua chưa bắt đầu.`);
    }
  }

  if (workspace.debt.status === "ready" && workspace.debt.value.studentCount > 0) {
    const debt = workspace.debt.value;

    items.push({
      action: (
        <Link className={inlineLinkClassName} href="/finance/payment-requests">
          Xem yêu cầu thanh toán
        </Link>
      ),
      detail: `Tổng ${formatVnd(debt.outstandingVnd)}${debt.overdueStudentCount > 0 ? ` · ${debt.overdueStudentCount} em có yêu cầu quá hạn` : ""} · tính mọi yêu cầu chưa thanh toán của các em`,
      key: "debt",
      title: `${debt.studentCount} học sinh còn công nợ`,
      tone: debt.overdueStudentCount > 0 ? "danger" : "warning",
    });
  } else if (workspace.debt.status === "unavailable" && workspace.debt.reason === "failed") {
    notes.push("Chưa tải được công nợ của học sinh trong lớp.");
  }

  if (workspace.absenceStreaks.status === "ready") {
    const streaks = workspace.absenceStreaks.value;

    for (const streak of streaks.slice(0, NEEDS_ACTION_ROWS)) {
      items.push({
        action: (
          <Link
            className={inlineLinkClassName}
            href={canViewCare ? `/student-care?student_id=${streak.student.id}` : `/students/${streak.student.id}`}
          >
            {canViewCare ? "Mở chăm sóc" : "Mở hồ sơ"}
          </Link>
        ),
        detail: `${streak.ordinals.length > 0 ? `Buổi ${streak.ordinals.join(", ")} · ` : ""}vắng có phép hoặc không phép`,
        key: `absence-${streak.student.id}`,
        title: `${streak.student.fullName} vắng ${streak.count} buổi liên tiếp`,
        tone: streak.count >= 3 ? "danger" : "warning",
      });
    }

    if (streaks.length > NEEDS_ACTION_ROWS) {
      notes.push(`Còn ${streaks.length - NEEDS_ACTION_ROWS} học sinh khác vắng liên tiếp.`);
    }
  } else if (workspace.absenceStreaks.reason === "failed") {
    notes.push("Chưa tải được điểm danh để kiểm tra học sinh vắng liên tiếp.");
  }

  return (
    <section aria-labelledby="class-needs-action-title" className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="flex items-center gap-2 border-b border-border-row px-4 py-3">
        <h2 className="text-body font-semibold text-text-strong" id="class-needs-action-title">
          Lớp này cần bạn xử lý
        </h2>
        {items.length > 0 ? (
          <>
            <CountChip aria-hidden="true">{items.length}</CountChip>
            <span className="sr-only">{items.length} việc tồn</span>
          </>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-4 text-secondary text-text-muted">Không có việc tồn trong phần bạn được xem.</p>
      ) : (
        <ul className="divide-y divide-border-row">
          {items.map((item) => (
            <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" key={item.key}>
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.tone === "danger" ? "bg-danger" : item.tone === "warning" ? "bg-warning" : "bg-text-subtle",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-strong">{item.title}</p>
                  <p className="text-secondary text-text-muted">{item.detail}</p>
                </div>
              </div>
              <div className="pl-5 sm:pl-0">{item.action}</div>
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 ? (
        <div className="border-t border-border-row px-4 py-2.5 text-caption text-text-muted">{notes.join(" ")}</div>
      ) : null}
    </section>
  );
}

function AttendanceChartPanel({ attendanceReady, rows }: { attendanceReady: boolean; rows: ClassSessionRow[] }) {
  const bars = attendanceReady ? getAttendanceChart(rows) : [];
  const lowBar = bars.find((bar) => bar.low);
  const latestRoster = bars.at(-1)?.roster;

  return (
    <section aria-labelledby="class-attendance-chart-title" className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-text-strong" id="class-attendance-chart-title">
          Chuyên cần theo buổi
        </h2>
        {bars.length > 0 ? (
          <span className="text-secondary text-text-muted">
            {bars.length} buổi gần nhất{latestRoster !== undefined ? ` · sĩ số ${latestRoster}` : ""}
          </span>
        ) : null}
      </div>

      {!attendanceReady ? (
        <PanelNotice>Không có quyền xem điểm danh hoặc chưa tải được.</PanelNotice>
      ) : bars.length === 0 ? (
        <PanelNotice>Chưa có buổi nào kết thúc để tính chuyên cần.</PanelNotice>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-40 items-end gap-1.5 sm:gap-2">
            {bars.map((bar) => (
              <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" key={bar.id}>
                <span className="text-caption tabular-nums text-text-muted">{bar.present}</span>
                <span
                  className={cn(
                    "w-full rounded-t-[4px]",
                    bar.low ? "bg-warning" : bar.latest ? "bg-action-primary" : "bg-[var(--action-primary-soft-border)]",
                  )}
                  style={{ height: `${Math.max(bar.rate, 4)}%` }}
                />
                <span className="truncate text-caption tabular-nums text-text-muted">{formatSessionOrdinal(bar.ordinal)}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Số học sinh có mặt theo buổi</caption>
            <thead>
              <tr>
                <th scope="col">Buổi</th>
                <th scope="col">Ngày</th>
                <th scope="col">Có mặt</th>
                <th scope="col">Sĩ số</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((bar) => (
                <tr key={bar.id}>
                  <td>{formatSessionOrdinal(bar.ordinal)}</td>
                  <td>{formatIsoDate(bar.sessionDate)}</td>
                  <td>{bar.present}</td>
                  <td>{bar.roster}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-muted">
            {lowBar ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" />
                {formatSessionOrdinal(lowBar.ordinal)} ({formatIsoDate(lowBar.sessionDate).slice(0, 5)}) có mặt {lowBar.present}/{lowBar.roster} · thấp nhất
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-action-primary" />
              Buổi gần nhất
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function HealthPanel({
  activeStudentCount,
  rows,
  today,
  workspace,
}: {
  activeStudentCount: number | null;
  rows: ClassSessionRow[] | null;
  today: string;
  workspace: ClassDetailWorkspace;
}) {
  const summary = rows ? summarizeClassSessions(rows, today) : null;
  const rate = rows && workspace.attendance.status === "ready" ? getClassAttendanceRate(rows) : null;
  const debt = workspace.debt.status === "ready" ? workspace.debt.value : null;
  const sessionsHint = workspace.sessions.status === "unavailable" ? (workspace.sessions.reason === "failed" ? "chưa tải được" : "không có quyền") : undefined;
  const showDebt = workspace.debt.status === "ready" || workspace.debt.reason === "failed";
  const debtHint = workspace.debt.status === "unavailable" ? "chưa tải được" : undefined;

  return (
    <ProfilePanel title="Sức khỏe lớp" titleId="class-health-title">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <HealthTile hint={sessionsHint} label="Buổi đã học" value={summary ? `${summary.completed} / ${summary.total}` : "—"} />
        <HealthTile
          hint={
            workspace.attendance.status === "unavailable"
              ? workspace.attendance.reason === "failed"
                ? "chưa tải được"
                : "không có quyền"
              : rate === null
                ? "chưa có buổi kết thúc"
                : undefined
          }
          label="Chuyên cần"
          tone={rate !== null && rate < 85 ? "warning" : "default"}
          value={rate === null ? "—" : `${rate}%`}
        />
        <HealthTile hint={activeStudentCount === null ? "không có quyền" : undefined} label="Sĩ số đang học" value={activeStudentCount === null ? "—" : String(activeStudentCount)} />
        <HealthTile
          hint={sessionsHint ?? (summary && summary.pendingLock > 0 ? `${summary.pendingLock} buổi chờ khóa` : undefined)}
          label="Buổi đã khóa"
          tone={summary && summary.pendingLock > 0 ? "warning" : "default"}
          value={summary ? `${summary.locked} / ${summary.completed}` : "—"}
        />
        {/* Roles without payments.view (TAs) do not see tuition at all, not even as "no permission". */}
        {showDebt ? (
          <>
            <HealthTile
              hint={debtHint ?? (debt && debt.overdueStudentCount > 0 ? `${debt.overdueStudentCount} em quá hạn` : undefined)}
              label="Học sinh còn nợ"
              tone={debt && debt.studentCount > 0 ? (debt.overdueStudentCount > 0 ? "danger" : "warning") : "default"}
              value={debt ? `${debt.studentCount} học sinh` : "—"}
            />
            <HealthTile hint={debtHint} label="Còn phải thu" value={debt ? formatVnd(debt.outstandingVnd) : "—"} />
          </>
        ) : null}
      </dl>
    </ProfilePanel>
  );
}

function HealthTile({ hint, label, tone = "default", value }: { hint?: string; label: string; tone?: "default" | "warning" | "danger"; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-[20px] font-semibold leading-7 tabular-nums",
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-strong",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="text-caption text-text-muted">{hint}</dd> : null}
    </div>
  );
}

function WeeklySchedulePanel({
  canManageSchedule,
  detail,
  showTuitionNote,
}: {
  canManageSchedule: boolean;
  detail: ClassDetailReadModel;
  showTuitionNote: boolean;
}) {
  const schedules = sortSchedules(detail.schedules.filter((schedule) => schedule.isActive));

  return (
    <ProfilePanel
      action={
        canManageSchedule ? (
          <a
            className="text-secondary font-medium text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href="#class-schedule-management"
          >
            Sửa lịch
          </a>
        ) : null
      }
      title="Lịch hằng tuần"
      titleId="class-weekly-schedule-title"
    >
      {schedules.length === 0 ? (
        <PanelNotice>Chưa có lịch cố định.</PanelNotice>
      ) : (
        <ul className="divide-y divide-border-row">
          {schedules.map((schedule) => {
            const minutes = getDurationMinutes(schedule.startTime, schedule.endTime);

            return (
              <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0" key={schedule.id}>
                <span className="text-secondary text-text-muted">{formatWeekdayName(schedule.weekday)}</span>
                <span className="text-right text-secondary font-semibold tabular-nums text-text-strong">
                  {[formatTime(schedule.startTime), minutes ? `${minutes} phút` : null, schedule.roomName ?? formatLearningMode(schedule.learningMode)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {showTuitionNote ? (
        <p className="mt-3 border-t border-border-row pt-3 text-caption text-text-muted">
          Học phí tính theo mức của từng học sinh, xem ở hồ sơ hoặc kỳ thu.
        </p>
      ) : null}
    </ProfilePanel>
  );
}

function ClassFactsPanel({ detail }: { detail: ClassDetailReadModel }) {
  return (
    <ProfilePanel title="Thông tin lớp" titleId="class-facts-title">
      <MetaList
        items={[
          {
            label: "Năm học",
            value: detail.academicYear
              ? `${detail.academicYear.name} (${formatIsoDate(detail.academicYear.startsOn)} – ${formatIsoDate(detail.academicYear.endsOn)})`
              : "Chưa xác định",
          },
          { label: "Khối · Mức", value: `Khối ${detail.grade} · Mức ${detail.level}` },
          { label: "Hình thức", value: formatLearningMode(detail.defaultLearningMode) },
          { label: "Buổi mỗi tuần", value: String(detail.weeklySessionCount) },
          {
            label: "ClassIn",
            value: detail.classinUrl ? (
              <a
                aria-label="Mở lớp trên ClassIn, mở trong thẻ mới"
                className="font-medium text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                href={detail.classinUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Mở lớp (thẻ mới)
              </a>
            ) : (
              "Chưa có đường dẫn"
            ),
          },
          { label: "Ghi chú", value: detail.notes ? <span className="whitespace-pre-wrap">{detail.notes}</span> : "Chưa có ghi chú" },
        ]}
      />
    </ProfilePanel>
  );
}
