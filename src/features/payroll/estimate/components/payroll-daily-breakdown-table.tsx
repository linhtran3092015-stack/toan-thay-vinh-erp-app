"use client";

import { Clock } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { DataTableFrame, TableHeaderCell } from "@/components/patterns/data-table-frame";
import { Badge } from "@/components/ui/badge";
import {
  buildDailyPayrollBreakdown,
  type DailyPayrollDay,
  type DailyPayrollShift,
  formatClockTime,
  formatDayMonth,
  getShiftPayBadge,
  getWeekdayLabel,
} from "@/features/payroll/estimate/daily-breakdown";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import { formatDashboardMonth } from "@/features/payroll/dashboard/format";
import { formatCurrency, formatWorkMinutes, getLineNote, getLineTypeLabel } from "@/features/payroll/payroll-presentation";
import { getAmountClassName } from "@/features/payroll/payslip-sections";
import { cn } from "@/lib/utils";

interface PayrollDailyBreakdownTableProps {
  estimate: Pick<StaffPayrollEstimate, "lines" | "month" | "shifts" | "statement" | "status"> & Partial<Pick<StaffPayrollEstimate, "issues">>;
  headingId?: string;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) để kiểm thử ổn định. */
  today?: string;
}

function formatSignedAmount(value: number): string {
  if (value === 0) return "0 VND";
  return value < 0 ? `−${formatCurrency(Math.abs(value))}` : formatCurrency(value);
}

const minuteFormatter = new Intl.NumberFormat("vi-VN");

/** Cells hidden below md keep the 375px ledger to Ngày · Ca · Thành tiền. */
const wideOnly = "max-md:hidden";
const cellClassName = "px-3 py-2 align-top first:pl-4 last:pr-4";

/**
 * Sổ lương theo ngày (thiết kế 8b): mỗi dòng là một ngày trong tháng với ca
 * chấm công, nguồn tiền, hình thức, phút công, đơn giá, thành tiền và trạng
 * thái xác minh. Ca đang mở "Chưa tính"; ca đã kết thúc chỉ được tính tiền khi
 * có dòng lương công gắn với ca (ca chưa xác minh khi đó là "tính tạm"); ca không
 * có dòng lương công là "Chưa tính · chưa xác minh" hoặc, nếu đã xác minh,
 * "Chưa tính · thiếu đơn giá" / "Chưa tính".
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
  const hasOpenShift = breakdown.days.some((day) => day.hasOpenShift);
  const hasUnverifiedUnpaid = breakdown.days.some((day) => day.unverifiedUnpaidCount > 0);
  const hasNotInPay = breakdown.days.some((day) => day.notInPayCount > 0);

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-4">
      <div>
        <h3 className="text-body font-semibold text-text-strong" id={headingId}>
          Lương theo ngày · {formatDashboardMonth(estimate.month)}
        </h3>
        <p className="mt-0.5 text-caption text-text-muted">
          {breakdown.activeDayCount} ngày có phát sinh · {formatWorkMinutes(breakdown.totalWorkedMinutes)} đã tính tiền
          {isApproved ? " · số liệu kỳ đã chốt" : " · cập nhật theo chấm công thời gian thực"}
        </p>
      </div>

      {!hasShiftData ? (
        <p className="rounded-lg border border-dashed border-border-strong bg-surface-base px-4 py-3 text-secondary text-text-muted">
          Chưa có ca làm việc nào trong tháng. Khi bạn chấm công xong, tiền công của từng ngày sẽ hiện ở đây.
        </p>
      ) : null}

      <DataTableFrame
        body={breakdown.days.map((day) => <DailyRow day={day} isApproved={isApproved} key={day.workDate} />)}
        caption={`Sổ lương từng ngày của ${formatDashboardMonth(estimate.month).toLowerCase()}`}
        footer={
          <>
            <span>
              Tổng theo ngày · {minuteFormatter.format(breakdown.totalWorkedMinutes)} phút công
              {hasOpenShift ? " · ca đang mở không tính" : ""}
              {hasUnverifiedUnpaid ? " · ca chưa xác minh chưa tính" : ""}
              {hasNotInPay ? " · ca đã xác minh nhưng chưa tính tiền" : ""}
            </span>
            <span className="font-semibold tabular-nums text-text-strong">{formatCurrency(breakdown.dailyTotalVnd)}</span>
          </>
        }
        header={
          <tr>
            <TableHeaderCell>Ngày</TableHeaderCell>
            <TableHeaderCell>Ca</TableHeaderCell>
            <TableHeaderCell className={wideOnly}>Nguồn</TableHeaderCell>
            <TableHeaderCell className={wideOnly}>Hình thức</TableHeaderCell>
            <TableHeaderCell className={wideOnly} numeric>Phút công</TableHeaderCell>
            <TableHeaderCell className={wideOnly} numeric>Đơn giá</TableHeaderCell>
            <TableHeaderCell numeric>Thành tiền</TableHeaderCell>
            <TableHeaderCell className={wideOnly}>Xác minh</TableHeaderCell>
          </tr>
        }
        tableClassName="md:min-w-[920px]"
      />

      {/* Khoản tính theo tháng */}
      <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-secondary font-semibold text-text-strong">Khoản tính theo tháng</h4>
          <span className="text-caption text-text-muted">
            Không gắn với ngày cụ thể: thưởng theo kết quả tháng, phần lương khoán đã tính trong lương cứng, tạm ứng, điều chỉnh.
          </span>
        </div>

        {breakdown.monthlyItems.length === 0 ? (
          <p className="mt-2 text-caption text-text-muted">Chưa có khoản nào tính theo tháng.</p>
        ) : (
          <ul className="mt-2">
            {breakdown.monthlyItems.map((line, index) => {
              const signedAmount = line.direction === "deduction" ? -line.amountVnd : line.amountVnd;
              return (
                <li
                  className="flex min-h-10 items-start justify-between gap-3 border-t border-border-row py-2 first:border-t-0"
                  key={`${line.lineType}-${line.sourceId ?? index}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-default">{getLineTypeLabel(line.lineType)}</p>
                    {getLineNote(line) ? <p className="text-caption text-text-muted [overflow-wrap:anywhere]">{getLineNote(line)}</p> : null}
                  </div>
                  {/* Only real deductions (advances) read as money taken away. */}
                  <span className={cn("shrink-0 font-medium tabular-nums", getAmountClassName(line))}>
                    {formatSignedAmount(signedAmount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 border-t-2 border-text-strong pt-3 font-semibold text-text-strong">
          <span>{isApproved ? "Lương chính thức đã chốt" : "Lương tạm tính sau khấu trừ"}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(payableVnd)}</span>
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

function DailyRow({ day, isApproved }: { day: DailyPayrollDay; isApproved: boolean }) {
  const hasUncountedShift = day.hasOpenShift || day.unverifiedUnpaidCount > 0 || day.notInPayCount > 0;
  const isIdle = day.totalVnd === 0 && day.workedMinutes === 0 && !hasUncountedShift;
  const sourceLabels = [...new Set(day.lines.map((line) => getLineTypeLabel(line.lineType)))];
  const verification = getDayVerificationLabel(day);

  return (
    <tr
      className={cn(
        "h-12 hover:bg-table-row-hover",
        day.pendingVerificationCount > 0 && "bg-warning-bg/40",
        isIdle && "text-text-muted",
        day.isFuture && "text-text-subtle",
      )}
      data-testid={`daily-row-${day.workDate}`}
    >
      <td className={cn(cellClassName, "whitespace-nowrap")}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="tabular-nums">
            <span className="text-text-muted">{getWeekdayLabel(day.weekday)}</span>{" "}
            <span className={cn("font-medium", !isIdle && !day.isFuture && "text-text-strong")}>{formatDayMonth(day.workDate)}</span>
          </span>
          {day.isToday ? <Badge tone="info">Hôm nay</Badge> : null}
        </div>
      </td>

      <td className={cellClassName}>
        {day.shifts.length === 0 ? (
          <span className="text-caption text-text-subtle">{day.isFuture ? "—" : "Không có ca"}</span>
        ) : (
          <ShiftList shifts={day.shifts}>
            {(shift) => (
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="tabular-nums text-text-default">
                  {formatClockTime(shift.checkInAt)}–{shift.payState === "open" ? "…" : formatClockTime(shift.checkOutAt)}
                </span>
                {shift.payState === "open" ? (
                  <span className="inline-flex items-center gap-1 text-caption text-text-muted">
                    <Clock aria-hidden="true" className="h-3 w-3" /> Đang làm · chưa tính tiền
                  </span>
                ) : null}
              </span>
            )}
          </ShiftList>
        )}
        {/* Columns hidden below md: minutes and verification stay readable in words. */}
        {!isIdle ? (
          <p className="mt-1 text-caption text-text-muted md:hidden">
            {day.workedMinutes > 0 ? `${minuteFormatter.format(day.workedMinutes)} phút công` : "Chưa có phút công"}
            {verification ? ` · ${verification}` : ""}
          </p>
        ) : null}
      </td>

      <td className={cn(cellClassName, wideOnly)}>
        {sourceLabels.length > 0 ? (
          <ul className="grid gap-0.5 text-secondary">
            {sourceLabels.map((label) => <li key={label}>{label}</li>)}
          </ul>
        ) : day.shifts.length > 0 ? (
          <span className="text-secondary">Chấm công</span>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>

      <td className={cn(cellClassName, wideOnly, "whitespace-nowrap text-secondary")}>
        {day.shifts.length === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <ShiftList shifts={day.shifts}>{(shift) => (shift.workMode === "online" ? "Online" : "Offline")}</ShiftList>
        )}
      </td>

      <td className={cn(cellClassName, wideOnly, "whitespace-nowrap text-right tabular-nums")}>
        {day.workedMinutes > 0 ? minuteFormatter.format(day.workedMinutes) : <span className="text-text-subtle">—</span>}
      </td>

      <td className={cn(cellClassName, wideOnly, "whitespace-nowrap text-right tabular-nums")}>
        {day.dailyRateVnd !== null ? (
          <>
            {formatCurrency(day.dailyRateVnd)}
            <span className="block text-caption text-text-muted">/ngày công</span>
          </>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>

      <td className={cn(cellClassName, "whitespace-nowrap text-right font-semibold tabular-nums", isIdle || day.isFuture ? "text-text-subtle" : "text-text-strong")}>
        {hasUncountedShift && day.totalVnd === 0 && day.workedMinutes === 0
          ? "—"
          : isIdle
            ? day.isFuture ? "—" : "0 VND"
            : formatSignedAmount(day.totalVnd)}
        {day.deductionVnd > 0 ? (
          <p className="text-caption font-normal text-danger">đã trừ {formatCurrency(day.deductionVnd)}</p>
        ) : null}
      </td>

      <td className={cn(cellClassName, wideOnly)}>
        {day.shifts.length === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <ShiftList shifts={day.shifts}>
            {(shift) => {
              const badge = getShiftPayBadge(shift.payState, { isApproved, notInPayReason: shift.notInPayReason });
              return <Badge tone={badge.tone}>{badge.label}</Badge>;
            }}
          </ShiftList>
        )}
      </td>
    </tr>
  );
}

/** One line per shift so Ca, Hình thức and Xác minh stay aligned across cells. */
function ShiftList({ children, shifts }: { children: (shift: DailyPayrollShift) => ReactNode; shifts: readonly DailyPayrollShift[] }) {
  return (
    <ul className="grid gap-1">
      {shifts.map((shift) => (
        <li className="flex min-h-6 items-center" key={shift.id}>
          {children(shift)}
        </li>
      ))}
    </ul>
  );
}

function getDayVerificationLabel(day: DailyPayrollDay): string | null {
  const parts: string[] = [];
  if (day.hasOpenShift) parts.push("ca đang mở chưa tính");
  if (day.pendingVerificationCount > 0) parts.push(`${day.pendingVerificationCount} ca chờ xác minh (tính tạm)`);
  if (day.unverifiedUnpaidCount > 0) parts.push(`${day.unverifiedUnpaidCount} ca chưa xác minh chưa tính`);
  if (day.notInPayCount > 0) {
    const missingRate = day.shifts.some((shift) => shift.payState === "not_in_pay" && shift.notInPayReason === "missing_daily_rate");
    parts.push(`${day.notInPayCount} ca đã xác minh chưa tính tiền${missingRate ? " (thiếu đơn giá)" : ""}`);
  }
  if (parts.length === 0 && day.workedMinutes > 0) parts.push("đã xác minh");
  return parts.length > 0 ? parts.join(" · ") : null;
}
