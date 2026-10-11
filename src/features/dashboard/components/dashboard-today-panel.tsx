import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { DashboardTodayReadModel } from "@/features/dashboard/today-data";
import { StaffLiveEstimateCard } from "@/features/payroll/estimate/components/staff-live-estimate-card";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import { formatDateTime, formatTime, formatWeekdayDate } from "@/lib/datetime";

const sessionStatusLabel: Record<string, { label: string; tone: "info" | "neutral" | "success" | "warning" }> = {
  cancelled: { label: "Đã hủy", tone: "neutral" },
  completed: { label: "Đã hoàn thành", tone: "success" },
  in_progress: { label: "Đang học", tone: "info" },
  scheduled: { label: "Sắp diễn ra", tone: "neutral" },
};

/** Role-aware "today" strip: shift state, today's sessions, pending work, live estimate. */
export function DashboardTodayPanel({ model }: { model: DashboardTodayReadModel }) {
  const pendingItems = [
    model.pending.unlockedSessions !== null && model.pending.unlockedSessions > 0
      ? { href: "/sessions?status=completed&lock=unlocked", label: `${model.pending.unlockedSessions} buổi chưa khóa` }
      : null,
    model.pending.crmFollowUps !== null && model.pending.crmFollowUps > 0
      ? { href: "/crm", label: `${model.pending.crmFollowUps} hẹn theo dõi lead đến hạn` }
      : null,
    model.pending.unreadNotifications !== null && model.pending.unreadNotifications > 0
      ? { href: "/notifications", label: `${model.pending.unreadNotifications} thông báo chưa đọc` }
      : null,
  ].filter((item): item is { href: string; label: string } => item !== null);

  const showTimekeeping = model.canCheckTimekeeping;
  const showSessions = model.todaySessions !== null;
  if (!showTimekeeping && !showSessions && pendingItems.length === 0 && !model.showPayrollEstimate) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-today-title" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-section-title font-semibold text-text-strong" id="dashboard-today-title">
          Hôm nay · {formatWeekdayDate(model.today)}
        </h2>
        {pendingItems.length > 0 ? (
          <p className="text-secondary text-text-muted">{pendingItems.length} việc đang chờ bạn</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {showTimekeeping ? (
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <p className="text-label font-semibold text-text-muted">Chấm công</p>
            {model.openEntry ? (
              <>
                <p className="mt-1 text-body font-semibold text-text-strong">
                  Đang trong ca từ {formatDateTime(model.openEntry.checkInAt).slice(-5)}
                </p>
                <p className="text-caption text-text-muted">
                  {model.openEntry.checkInMode === "online" ? "Trực tuyến" : "Tại trung tâm"}
                  {model.openEntry.workShiftName ? ` · ${model.openEntry.workShiftName}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 text-body text-text-muted">Chưa vào ca hôm nay.</p>
            )}
            <div className="mt-3">
              <TimekeepingEntryDialog
                attendancePolicy={model.attendancePolicy ?? undefined}
                operation={model.openEntry ? "check-out" : "check-in"}
                timeEntryId={model.openEntry?.id}
              />
            </div>
          </div>
        ) : null}

        {showSessions ? (
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-label font-semibold text-text-muted">Buổi học hôm nay</p>
              <Link className="text-caption font-semibold text-action-link hover:underline" href={`/sessions?from=${model.today}&to=${model.today}`}>
                Xem tất cả
              </Link>
            </div>
            {model.todaySessions && model.todaySessions.length > 0 ? (
              <ul className="mt-2 grid gap-1.5">
                {model.todaySessions.slice(0, 6).map((session) => {
                  const status = sessionStatusLabel[session.status] ?? { label: session.status, tone: "neutral" as const };
                  return (
                    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-interactive-hover" key={session.id}>
                      <Link className="min-w-0 font-semibold text-action-link hover:underline" href={`/sessions/${session.id}`}>
                        {formatTime(session.startTime)}–{formatTime(session.endTime)} · {session.classCode}
                        <span className="ml-1 font-normal text-text-muted">{session.className}</span>
                      </Link>
                      <span className="flex items-center gap-1.5">
                        {session.status === "completed" && !session.lockedAt ? <Badge tone="warning">Chưa khóa</Badge> : null}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                    </li>
                  );
                })}
                {model.todaySessions.length > 6 ? (
                  <li className="px-2 text-caption text-text-muted">Còn {model.todaySessions.length - 6} buổi khác.</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-body text-text-muted">Không có buổi học nào hôm nay.</p>
            )}
          </div>
        ) : null}
      </div>

      {pendingItems.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pendingItems.map((item) => (
            <li key={item.href}>
              <Link
                className="inline-flex min-h-9 items-center rounded-md border border-warning-border bg-warning-bg px-3 text-control font-semibold text-warning hover:opacity-90"
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {model.showPayrollEstimate ? <StaffLiveEstimateCard month={model.currentMonth} /> : null}
    </section>
  );
}
