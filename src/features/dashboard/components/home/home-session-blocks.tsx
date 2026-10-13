import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { classSessionStageMeta, getClassSessionStage, getRecordedCount, hasSessionEnded } from "@/features/classes/detail/class-detail-models";
import { BlockEmpty, BlockError, HomeBlock, homeLinkClassName } from "@/features/dashboard/components/home/home-block";
import {
  formatAttendanceCount,
  formatTimeUntil,
  getNextSessionFeedState,
  pickNextSession,
  summarizeTodaySessions,
  type DashboardHomeReadModel,
  type DashboardSessionRow,
} from "@/features/dashboard/home-models";
import { formatTime, formatWeekdayDate } from "@/lib/datetime";
import { formatLearningMode } from "@/lib/format";
import type { PermissionCode } from "@/lib/permissions/types";
import { cn } from "@/lib/utils";

/** Class-page stage, except a started session past its end time: that is the work list's "Chưa hoàn thành". */
function StageBadge({ row, model }: { model: Pick<DashboardHomeReadModel, "nowTime" | "today">; row: DashboardSessionRow }) {
  const stage = getClassSessionStage(row, model.today, model.nowTime);
  const meta = stage === "live" && hasSessionEnded(row, model.today, model.nowTime) ? { label: "Chưa hoàn thành", tone: "danger" as const } : classSessionStageMeta[stage];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function sessionMeta(row: DashboardSessionRow): string {
  return [
    row.roomName ? `Phòng ${row.roomName.replace(/^P\.?\s*/i, "")}` : null,
    formatLearningMode(row.learningMode),
    row.rosterCount !== null ? `${row.rosterCount} học sinh` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "Buổi học tiếp theo" of the centre (sessions have no staff link, so it is
 * never "của bạn"). The personal layout carries the page's only primary
 * action: "Điểm danh buổi này" while the session is in progress and the viewer
 * can mark, or "Bắt đầu buổi học" once a scheduled session today has reached
 * its start time and the viewer can start it (sessions.manage); otherwise the
 * link is secondary. Teacher, assistant and session-ordinal details of the
 * mock-up are not modelled and are left out.
 */
export function NextSessionBlock({
  model,
  personal,
  retryHref,
}: {
  model: DashboardHomeReadModel;
  personal: boolean;
  retryHref: string;
}) {
  const state = getNextSessionFeedState(model);
  if (state === "forbidden") return null;

  const next = pickNextSession(model);
  const has = (code: PermissionCode) => model.permissions.includes(code);
  const stage = next ? getClassSessionStage(next.row, model.today, model.nowTime) : null;
  // A live session already says so on its badge; a later one gets a countdown
  // (or "Đã đến giờ bắt đầu" once due but not started), another day its date.
  const countdown = next?.isToday
    ? stage === "live"
      ? null
      : (formatTimeUntil(next.row.startTime, model.nowTime) ?? "Đã đến giờ bắt đầu")
    : next
      ? formatWeekdayDate(next.row.sessionDate)
      : null;
  const canMark = Boolean(next?.isToday && has("attendance.mark") && stage === "live");
  const canStart = Boolean(next?.isToday && has("sessions.manage") && stage === "upcoming" && next.row.startTime <= model.nowTime);
  const recorded = next?.row.attendance ? getRecordedCount(next.row.attendance) : null;
  const roster = next?.row.rosterCount ?? null;
  const progress = recorded !== null && roster ? Math.round((recorded / roster) * 100) : 0;

  return (
    <HomeBlock
      action={countdown ? <span className="text-secondary font-semibold tabular-nums text-text-default">{countdown}</span> : undefined}
      title="Buổi học tiếp theo"
      titleId="home-next-session-title"
    >
      {state === "failed" ? (
        <BlockError message="Chưa tải được lịch buổi học nên chưa biết buổi tiếp theo." retryHref={retryHref} />
      ) : !next ? (
        <BlockEmpty>Hôm nay không còn buổi học nào và 7 ngày tới chưa có buổi đã xếp lịch.</BlockEmpty>
      ) : (
        <div className="grid gap-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn(personal ? "text-page-title" : "text-section-title", "font-semibold tabular-nums text-text-strong")}>
              {formatTime(next.row.startTime)} · {next.row.className}
            </p>
            <StageBadge model={model} row={next.row} />
          </div>
          <p className="text-secondary text-text-muted">
            {[next.isToday ? null : formatWeekdayDate(next.row.sessionDate), `${formatTime(next.row.startTime)}–${formatTime(next.row.endTime)}`, next.row.classCode, sessionMeta(next.row)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {recorded !== null && roster !== null ? (
            <div className="flex flex-wrap items-center gap-3 text-secondary">
              <span className="text-text-muted">Điểm danh</span>
              <span
                aria-label={`Đã điểm danh ${recorded} trên ${roster} học sinh`}
                aria-valuemax={roster}
                aria-valuemin={0}
                aria-valuenow={recorded}
                className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
              >
                <span className="progress-grow block h-full rounded-full bg-action-primary" style={{ width: `${progress}%` }} />
              </span>
              <span className="font-semibold tabular-nums text-text-strong">
                {recorded}/{roster}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-border-row pt-3">
            {personal && (canMark || canStart) ? (
              <Link className={cn(getButtonClassName({ variant: "primary" }), "max-md:h-11")} href={`/sessions/${next.row.id}`}>
                {canMark ? "Điểm danh buổi này" : "Bắt đầu buổi học"}
              </Link>
            ) : (
              <Link className={cn(getButtonClassName({ variant: "secondary" }), "max-md:h-11")} href={`/sessions/${next.row.id}`}>
                Mở buổi học
              </Link>
            )}
            {personal && has("classes.view") ? (
              <Link className={cn(getButtonClassName({ variant: "secondary" }), "max-md:h-11")} href={`/classes/${next.row.classId}`}>
                Xem lớp
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </HomeBlock>
  );
}

/**
 * Today's schedule across the centre: a table from md up (2a), one record per
 * session below md and in the personal layout (2b). Status uses the session
 * stage vocabulary of the class page. The teacher column of the mock-up is not
 * modelled (no per-session staffing) and is left out.
 */
export function TodayScheduleBlock({
  model,
  personal,
  retryHref,
}: {
  model: DashboardHomeReadModel;
  personal: boolean;
  retryHref: string;
}) {
  const feed = model.todaySessions;
  if (feed.status === "unavailable" && feed.reason === "forbidden") return null;

  const rows = feed.status === "ready" ? feed.value.rows : [];
  const weekHref = `/sessions?from=${model.weekStart}&to=${model.weekEnd}`;
  const title = personal ? "Lịch hôm nay của trung tâm" : "Lịch hôm nay";
  const count = summarizeTodaySessions(rows).total;

  const list = (
    <ResponsiveRecordList className="p-3" label={title}>
      {rows.map((row) => (
        <RecordListItem
          ariaLabel={`Mở buổi ${row.className} lúc ${formatTime(row.startTime)}`}
          badge={<StageBadge model={model} row={row} />}
          href={`/sessions/${row.id}`}
          key={row.id}
          meta={[`${formatTime(row.startTime)}–${formatTime(row.endTime)}`, row.classCode, row.roomName].filter(Boolean).join(" · ")}
          metrics={
            <span>
              Điểm danh <span className="font-semibold tabular-nums text-text-strong">{formatAttendanceCount(row)}</span>
            </span>
          }
          title={row.className}
        />
      ))}
    </ResponsiveRecordList>
  );

  return (
    <HomeBlock
      action={
        <Link className={homeLinkClassName} href={weekHref}>
          Xem cả tuần
        </Link>
      }
      subtitle={feed.status === "ready" ? `· ${count} buổi` : undefined}
      title={title}
      titleId="home-today-schedule-title"
    >
      {feed.status === "unavailable" ? (
        <BlockError message="Chưa tải được lịch hôm nay." retryHref={retryHref} />
      ) : rows.length === 0 ? (
        <BlockEmpty>Hôm nay không có buổi học nào.</BlockEmpty>
      ) : personal ? (
        list
      ) : (
        <>
          <div className="md:hidden">{list}</div>
          <div className="hidden p-3 md:block">
            <DataTableFrame
              body={rows.map((row) => (
                <tr className="hover:bg-table-row-hover" key={row.id}>
                  <td className="h-14 whitespace-nowrap px-4 tabular-nums">
                    {formatTime(row.startTime)}–{formatTime(row.endTime)}
                  </td>
                  <td className="px-4">
                    <Link className="font-semibold text-text-strong hover:underline" href={`/sessions/${row.id}`}>
                      {row.className}
                    </Link>
                    <span className="block text-caption text-text-muted">
                      {row.classCode} · {row.roomName ?? formatLearningMode(row.learningMode)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 text-right tabular-nums">{formatAttendanceCount(row)}</td>
                  <td className="px-4">
                    <StageBadge model={model} row={row} />
                  </td>
                </tr>
              ))}
              caption="Các buổi học hôm nay"
              className="shadow-none"
              header={
                <tr>
                  <th className="h-10 whitespace-nowrap px-4 font-semibold" scope="col">Giờ</th>
                  <th className="h-10 whitespace-nowrap px-4 font-semibold" scope="col">Lớp · phòng</th>
                  <th className="h-10 whitespace-nowrap px-4 text-right font-semibold" scope="col">Điểm danh</th>
                  <th className="h-10 whitespace-nowrap px-4 font-semibold" scope="col">Trạng thái</th>
                </tr>
              }
            />
          </div>
        </>
      )}
      {feed.status === "ready" && feed.value.truncated ? (
        <p className="border-t border-border-row px-4 py-2.5 text-caption text-text-muted">Chỉ hiện các buổi đầu tiên trong ngày; xem đủ ở trang Buổi học.</p>
      ) : null}
    </HomeBlock>
  );
}
