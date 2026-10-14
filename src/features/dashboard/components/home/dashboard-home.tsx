/*
 * Home dashboard "/" (design 02-tong-quan: 2a owner/manager/accountant,
 * 2b teaching assistant). Layout is chosen from permission codes
 * (getDashboardLayout), never from role names.
 *
 * Design blocks DROPPED because this ERP has no data source for them
 * (shown nowhere rather than faked):
 * - "Thiếu giáo viên thay" / substitute assignment, "Xác nhận hỗ trợ thay",
 *   "Không thể dạy": there is no substitute or per-session staffing model.
 * - Teacher / assistant names on sessions (the "Giáo viên" column, "GV … · TG …",
 *   "bạn là trợ giảng", "hỗ trợ thay Ngọc Hà"): sessions carry no staff link,
 *   so the TA layout shows the centre's schedule labelled as such, not "own"
 *   sessions, and "Việc của bạn" covers every overdue session the viewer may
 *   mark or start (attendance.mark or sessions.manage).
 * - "Giáo viên đã chấm công vào ca 16:58" on the next-session card: time entries
 *   are not tied to sessions.
 * - "2 học sinh còn nợ 1 buổi", "Đề kiểm tra đã được gắn", "xin nghỉ có phép
 *   (phụ huynh báo 09:12)": no per-session balance check, test attachment or
 *   parent absence notice is modelled for the card.
 * - "Buổi 14/36" session ordinal: needs every session of the class; the
 *   dashboard reads only today's sessions.
 * - "5 nhận xét coaching chưa viết · hạn gửi phụ huynh": coaching comment
 *   deadlines are not modelled (student-care tasks the viewer owns are shown
 *   instead when overdue).
 * - "12 học sinh nợ quá 30 ngày · 4 em chưa được nhắc": aging is per payment
 *   request with no reminder log, so the item shows the overdue amount and the
 *   stale-request count.
 * - "Ghi danh mới" and "Bảo lưu / nghỉ" this week: no enrolment or lifecycle
 *   history; shown as "Hồ sơ học sinh mới" (students created this week) and
 *   "Đang bảo lưu" (current count).
 * - "Tháng 10 của bạn": "Buổi đã trợ giảng", "Đã khóa / chờ khóa" (no session
 *   staffing) and "Lương tạm tính (buổi đã khóa)" (the payroll estimate is
 *   computed from worked minutes, not locked sessions). The block shows the
 *   viewer's own timekeeping month; the existing live estimate card stays
 *   below it for payroll.view.
 * - Shift window text ("Ca 15:00–21:30") in the timekeeping strip: today's
 *   assigned shift is not read here; the strip states the GPS radius instead.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { getButtonClassName } from "@/components/ui/button";
import { NextSessionBlock, TodayScheduleBlock } from "@/features/dashboard/components/home/home-session-blocks";
import { NeedsActionBlock, StatBlock, SummaryStrip, TuitionProgressBlock } from "@/features/dashboard/components/home/home-work-blocks";
import { TimekeepingStrip } from "@/features/dashboard/components/home/timekeeping-strip";
import {
  buildMyMonthStats,
  buildNeedsAction,
  buildWeekStats,
  formatBacklogCount,
  formatLongWeekdayDate,
  summarizeTodaySessions,
  type DashboardHomeReadModel,
} from "@/features/dashboard/home-models";
import { formatIsoDate, formatTime } from "@/lib/datetime";

export interface DashboardHomeProps {
  /** Existing executive analytics, rendered under "Phân tích" by the route. */
  analytics?: ReactNode;
  centerDisplayName: string;
  model: DashboardHomeReadModel;
  /** Existing live payroll estimate card (payroll.view), shown in both layouts. */
  payrollEstimate?: ReactNode;
  /** Where "Thử lại" reloads: the route itself. */
  retryHref: string;
}

export function DashboardHome({ analytics, centerDisplayName, model, payrollEstimate, retryHref }: DashboardHomeProps) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 pb-12">
      {model.layout === "center" ? (
        <CenterDashboard centerDisplayName={centerDisplayName} model={model} payrollEstimate={payrollEstimate} retryHref={retryHref} />
      ) : (
        <PersonalDashboard model={model} payrollEstimate={payrollEstimate} retryHref={retryHref} />
      )}
      {analytics}
    </div>
  );
}

function CenterDashboard({
  centerDisplayName,
  model,
  payrollEstimate,
  retryHref,
}: {
  centerDisplayName: string;
  model: DashboardHomeReadModel;
  payrollEstimate?: ReactNode;
  retryHref: string;
}) {
  const canViewReports = model.permissions.includes("reports.view");

  return (
    <>
      <PageHeader
        actions={
          canViewReports ? (
            <Link className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })} href="/reports">
              Mở Báo cáo
            </Link>
          ) : undefined
        }
        title="Tổng quan"
      >
        <p className="mt-1 text-secondary text-text-muted">
          {formatLongWeekdayDate(model.today)} · {centerDisplayName} · cập nhật {formatTime(model.nowTime)}
        </p>
      </PageHeader>

      <TimekeepingStrip model={model} retryHref={retryHref} />

      <SummaryStrip model={model} retryHref={retryHref} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-6">
          <NextSessionBlock model={model} personal={false} retryHref={retryHref} />
          <TodayScheduleBlock model={model} personal={false} retryHref={retryHref} />
          <TuitionProgressBlock model={model} retryHref={retryHref} />
        </div>
        <aside aria-label="Việc cần xử lý và số liệu tuần" className="grid min-w-0 content-start gap-6">
          <NeedsActionBlock model={model} retryHref={retryHref} />
          <StatBlock
            retryHref={retryHref}
            rows={buildWeekStats(model)}
            subtitle={`${formatIsoDate(model.weekStart).slice(0, 5)} – ${formatIsoDate(model.weekEnd).slice(0, 5)}`}
            title="Tuần này"
            titleId="home-week-title"
          />
        </aside>
      </div>

      {payrollEstimate}
    </>
  );
}

function PersonalDashboard({ model, payrollEstimate, retryHref }: { model: DashboardHomeReadModel; payrollEstimate?: ReactNode; retryHref: string }) {
  const sessions = model.todaySessions.status === "ready" ? summarizeTodaySessions(model.todaySessions.value.rows).total : null;
  const work = buildNeedsAction(model);
  const month = Number(model.today.slice(5, 7));

  return (
    <>
      <PageHeader title="Hôm nay của bạn">
        <p className="mt-1 text-secondary text-text-muted">
          {[
            formatLongWeekdayDate(model.today),
            sessions !== null ? `${sessions} buổi học hôm nay` : null,
            work.sourceCount > 0 && work.complete ? `${formatBacklogCount(work)} việc tồn` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </PageHeader>

      <TimekeepingStrip model={model} retryHref={retryHref} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-6">
          <NextSessionBlock model={model} personal retryHref={retryHref} />
          <TodayScheduleBlock model={model} personal retryHref={retryHref} />
        </div>
        <aside aria-label="Việc và số liệu của bạn" className="grid min-w-0 content-start gap-6">
          <NeedsActionBlock model={model} retryHref={retryHref} />
          <StatBlock
            footnote="Theo dữ liệu chấm công của bạn. Lương cuối cùng do kế toán chốt trong kỳ lương."
            retryHref={retryHref}
            rows={buildMyMonthStats(model)}
            title={`Tháng ${month} của bạn`}
            titleId="home-my-month-title"
          />
        </aside>
      </div>

      {payrollEstimate}
    </>
  );
}
