"use client";

import { CalendarDays, Clock } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  buildDailyPayrollBreakdown,
  type DailyPayrollDay,
  formatClockTime,
  getWeekdayLabel,
} from "@/features/payroll/estimate/daily-breakdown";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import { formatDashboardMonth } from "@/features/payroll/dashboard/format";
import { formatCurrency, formatWorkMinutes, getLineTypeLabel } from "@/features/payroll/payroll-presentation";

interface PayrollDailyBreakdownTableProps {
  estimate: Pick<StaffPayrollEstimate, "lines" | "month" | "shifts" | "statement" | "status">;
  headingId?: string;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) để kiểm thử ổn định. */
  today?: string;
}

function formatSignedAmount(value: number): string {
  if (value === 0) return "0 VND";
  return value < 0 ? `−${formatCurrency(Math.abs(value))}` : formatCurrency(value);
}

/**
 * Bảng lương theo từng ngày trong tháng. Mỗi ngày gồm ca làm việc, giờ công đã
 * tính tiền, lương công, phụ cấp/thưởng phát sinh đúng ngày và thành tiền.
 * Các khoản tính theo tháng được tách riêng bên dưới để tổng khớp lương tạm tính.
 */
export function PayrollDailyBreakdownTable({
  estimate,
  headingId = "payroll-daily-breakdown-heading",
  today,
}: PayrollDailyBreakdownTableProps) {
  const breakdown = useMemo(
    () => buildDailyPayrollBreakdown(estimate, today ? { today } : {}),
    [estimate, today],
  );
  const isApproved = estimate.status === "approved";
  const payableVnd = estimate.statement?.payableVnd ?? breakdown.grandTotalVnd;
  const hasShiftData = (estimate.shifts?.length ?? 0) > 0 || breakdown.activeDayCount > 0;

  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-action-link" />
          <div>
            <h3 className="text-body font-semibold text-text-strong" id={headingId}>
              Lương theo ngày · {formatDashboardMonth(estimate.month)}
            </h3>
            <p className="mt-0.5 text-caption text-text-muted">
              {breakdown.activeDayCount} ngày có phát sinh · {formatWorkMinutes(breakdown.totalWorkedMinutes)} đã tính tiền
              {isApproved ? " · số liệu kỳ đã chốt" : " · cập nhật theo chấm công thời gian thực"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-caption font-medium uppercase tracking-wider text-text-muted">Tổng theo ngày</p>
          <p className="text-body font-bold tabular-nums text-text-strong">{formatCurrency(breakdown.dailyTotalVnd)}</p>
        </div>
      </div>

      {!hasShiftData ? (
        <p className="rounded-lg border border-dashed border-border-subtle bg-surface-raised/40 px-4 py-3 text-secondary text-text-muted">
          Chưa có ca làm việc nào trong tháng. Khi bạn chấm công xong, tiền công của từng ngày sẽ hiện ở đây.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[560px] text-left text-secondary">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised/50 text-caption font-semibold text-text-muted">
              <th className="px-3 py-2" scope="col">Ngày</th>
              <th className="px-3 py-2" scope="col">Ca làm việc</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell" scope="col">Giờ công</th>
              <th className="hidden px-3 py-2 text-right md:table-cell" scope="col">Lương công</th>
              <th className="hidden px-3 py-2 text-right md:table-cell" scope="col">Phụ cấp & thưởng</th>
              <th className="px-3 py-2 text-right" scope="col">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {breakdown.days.map((day) => (
              <DailyRow day={day} key={day.workDate} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong bg-surface-raised/30 font-semibold text-text-strong">
              <td className="px-3 py-2.5" colSpan={2}>Tổng theo ngày</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">
                {formatWorkMinutes(breakdown.totalWorkedMinutes)}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                {formatCurrency(breakdown.days.reduce((sum, day) => sum + day.baseSalaryVnd, 0))}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                {formatCurrency(breakdown.days.reduce((sum, day) => sum + day.allowanceVnd + day.bonusVnd, 0))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(breakdown.dailyTotalVnd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Khoản tính theo tháng */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised/30 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-secondary font-semibold text-text-strong">Khoản tính theo tháng</h4>
          <span className="text-caption text-text-muted">
            Không gắn với ngày cụ thể: thưởng theo kết quả tháng, bù trừ lương khoán, tạm ứng, điều chỉnh thủ công.
          </span>
        </div>

        {breakdown.monthlyItems.length === 0 ? (
          <p className="mt-2 text-caption text-text-muted">Chưa có khoản nào tính theo tháng.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border-subtle">
            {breakdown.monthlyItems.map((line, index) => {
              const signedAmount = line.direction === "deduction" ? -line.amountVnd : line.amountVnd;
              return (
                <li className="flex items-start justify-between gap-3 py-2" key={`${line.lineType}-${line.sourceId ?? index}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-text-default">{getLineTypeLabel(line.lineType)}</p>
                    {line.note ? <p className="text-caption text-text-muted">{line.note}</p> : null}
                  </div>
                  <span
                    className={`shrink-0 font-medium tabular-nums ${signedAmount < 0 ? "text-warning" : "text-text-strong"}`}
                  >
                    {formatSignedAmount(signedAmount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border-strong pt-3 font-bold text-text-strong">
          <span>{isApproved ? "Lương chính thức đã chốt" : "Lương tạm tính sau khấu trừ"}</span>
          <span className="tabular-nums text-action-link">{formatCurrency(payableVnd)}</span>
        </div>
        <p className="mt-1 text-caption text-text-muted">
          = Tổng theo ngày {formatCurrency(breakdown.dailyTotalVnd)}
          {breakdown.monthlyNetVnd >= 0 ? " + " : " − "}
          khoản theo tháng {formatCurrency(Math.abs(breakdown.monthlyNetVnd))}
        </p>
      </div>
    </section>
  );
}

function DailyRow({ day }: { day: DailyPayrollDay }) {
  const isIdle = day.totalVnd === 0 && day.workedMinutes === 0 && !day.hasOpenShift;
  const extrasVnd = day.allowanceVnd + day.bonusVnd;
  const isWeekend = day.weekday === 0;

  return (
    <tr
      className={[
        day.isToday ? "bg-info-bg/40" : "",
        isIdle && !day.isToday ? "text-text-muted" : "",
        day.isFuture ? "opacity-60" : "",
      ].join(" ")}
      data-testid={`daily-row-${day.workDate}`}
    >
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <div className="flex items-center gap-2">
          <span className={`font-semibold tabular-nums ${isWeekend ? "text-warning" : "text-text-strong"}`}>
            {String(day.dayOfMonth).padStart(2, "0")}
          </span>
          <span className="text-caption text-text-muted">{getWeekdayLabel(day.weekday)}</span>
          {day.isToday ? <Badge tone="info">Hôm nay</Badge> : null}
        </div>
      </td>

      <td className="px-3 py-2 align-top">
        {day.shifts.length === 0 ? (
          <span className="text-caption text-text-subtle">{day.isFuture ? "—" : "Không có ca"}</span>
        ) : (
          <ul className="grid gap-1">
            {day.shifts.map((shift) => {
              const isOpen = shift.status === "open" || !shift.checkOutAt;
              return (
                <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption" key={shift.id}>
                  <span className="tabular-nums text-text-default">
                    {formatClockTime(shift.checkInAt)}–{isOpen ? "…" : formatClockTime(shift.checkOutAt)}
                  </span>
                  <span className="text-text-muted">{shift.workMode === "online" ? "Online (50%)" : "Offline"}</span>
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <Clock aria-hidden="true" className="h-3 w-3" /> Đang làm · chưa tính tiền
                    </span>
                  ) : shift.isPendingVerification ? (
                    <Badge tone="warning">Chờ xác minh</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {/* Thông tin bị ẩn cột trên màn hình hẹp */}
        {!isIdle ? (
          <p className="mt-1 text-caption text-text-muted sm:hidden">
            {formatWorkMinutes(day.workedMinutes)}
            {extrasVnd > 0 ? ` · phụ cấp/thưởng ${formatCurrency(extrasVnd)}` : ""}
          </p>
        ) : null}
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2 text-right align-top tabular-nums sm:table-cell">
        {day.workedMinutes > 0 ? formatWorkMinutes(day.workedMinutes) : <span className="text-text-subtle">—</span>}
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2 text-right align-top tabular-nums md:table-cell">
        {day.baseSalaryVnd > 0 ? formatCurrency(day.baseSalaryVnd) : <span className="text-text-subtle">—</span>}
      </td>

      <td className="hidden px-3 py-2 text-right align-top tabular-nums md:table-cell">
        {extrasVnd > 0 ? (
          <div>
            <span>{formatCurrency(extrasVnd)}</span>
            <p className="text-caption text-text-muted">
              {day.lines
                .filter((line) => line.direction === "earning" && line.lineType !== "base_offline" && line.lineType !== "base_online")
                .map((line) => getLineTypeLabel(line.lineType))
                .join(", ")}
            </p>
          </div>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>

      <td className={`whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums ${isIdle ? "text-text-subtle" : "text-text-strong"}`}>
        {isIdle ? (day.isFuture ? "—" : "0 VND") : formatSignedAmount(day.totalVnd)}
        {day.deductionVnd > 0 ? (
          <p className="text-caption font-normal text-warning">đã trừ {formatCurrency(day.deductionVnd)}</p>
        ) : null}
      </td>
    </tr>
  );
}
