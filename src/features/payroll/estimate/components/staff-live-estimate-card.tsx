"use client";

import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PayrollDailyBreakdownTable } from "@/features/payroll/estimate/components/payroll-daily-breakdown-table";
import { formatClockTime, getNotInPayReason, getPendingVerificationSummary, getShiftPayBadge, getShiftPayContext, getShiftPayState } from "@/features/payroll/estimate/daily-breakdown";
import { usePayrollLiveEstimate } from "@/features/payroll/estimate/use-payroll-live-estimate";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonth,
  formatWorkMinutes,
  getLineTypeLabel,
} from "@/features/payroll/payroll-presentation";
import { getPayrollPositionLabel } from "@/features/staff/payroll-profile-types";

interface StaffLiveEstimateCardProps {
  initialEstimate?: StaffPayrollEstimate | null;
  month: string;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng theo ngày; dùng trong kiểm thử. */
  today?: string;
}

export function StaffLiveEstimateCard({
  initialEstimate,
  month,
  today,
}: StaffLiveEstimateCardProps) {
  const { connectionState, data, hasAttemptedFetch, isLoading, refetch } =
    usePayrollLiveEstimate<StaffPayrollEstimate>({
      initialData: initialEstimate,
      month,
      scope: "staff",
    });

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const estimate = data ?? initialEstimate;

  if (!estimate) {
    if (!hasAttemptedFetch || isLoading) {
      return (
        <section aria-labelledby="live-estimate-heading" className="rounded-lg border border-border-subtle bg-surface-base p-5">
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 animate-pulse rounded bg-surface-raised" />
            <div className="h-6 w-24 animate-pulse rounded bg-surface-raised" />
          </div>
          <div className="mt-4 h-10 w-48 animate-pulse rounded bg-surface-raised" />
        </section>
      );
    }

    return (
      <section aria-labelledby="live-estimate-heading" className="rounded-lg border border-border-subtle bg-surface-base p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-section-title font-bold text-text-strong" id="live-estimate-heading">
              {formatMonth(month)}
            </h2>
            <p className="mt-1 text-secondary text-text-muted">
              Chưa tải được dữ liệu lương tạm tính cho kỳ này.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-base px-3 py-1.5 text-secondary font-medium text-text-default hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => void refetch()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  const { completeness, latestCompletedWorkAt, lines, openShifts, recentShifts, statement, status } = estimate;
  const isApproved = status === "approved";
  // Shifts actually counted provisionally (same count as the ledger banner).
  const pendingCount = getPendingVerificationSummary(estimate).count;
  // Same pay state and labels as the daily ledger, so one shift never reads two ways.
  const shiftPayContext = getShiftPayContext(estimate);

  // Group line categories
  const baseSalaryLines = lines.filter((l) => l.lineType === "base_offline" || l.lineType === "base_online");
  const baseSalaryTotal = baseSalaryLines.reduce((acc, l) => acc + l.amountVnd, 0);
  const workedMinutesTotal = statement?.workedMinutes ?? 0;

  const allowanceLines = lines.filter((l) => l.lineType === "teaching_allowance");
  const allowanceTotal = allowanceLines.reduce((acc, l) => acc + l.amountVnd, 0);

  const bonusLines = lines.filter((l) =>
    l.direction === "earning" &&
    l.lineType !== "base_offline" &&
    l.lineType !== "base_online" &&
    l.lineType !== "teaching_allowance",
  );
  const bonusTotal = bonusLines.reduce((acc, l) => acc + l.amountVnd, 0);

  const hasGradingBonus = bonusLines.some((l) => l.lineType === "grading_bonus");

  const deductionTotal = statement?.totalDeductionsVnd ?? 0;

  return (
    <section aria-labelledby="live-estimate-heading" className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base shadow-sm">
      {/* Header */}
      <div className="border-b border-border-subtle bg-surface-raised/40 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-section-title font-bold text-text-strong" id="live-estimate-heading">
              {formatMonth(month)}
            </h2>
            {isApproved ? (
              <Badge tone="success">Lương đã duyệt</Badge>
            ) : (
              <Badge tone="info">Lương tạm tính</Badge>
            )}

            {completeness === "partial" ? (
              <Badge tone="warning">Chưa tính đủ cấu hình</Badge>
            ) : null}

            {connectionState === "stale" ? (
              <Badge tone="warning">Chưa cập nhật</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-3 text-caption text-text-muted">
            <span>
              {isApproved
                ? `Chốt kỳ lúc: ${estimate.approvedAt ? formatDateTime(estimate.approvedAt) : "Đã duyệt"}`
                : `Dữ liệu tính lúc: ${formatDateTime(estimate.calculatedAt)}`}
            </span>
            <button
              aria-label="Làm mới lương tạm tính"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-base text-text-default hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
              disabled={isLoading}
              onClick={() => void refetch()}
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 sm:p-6">
        {/* Main Amount */}
        <div className="flex flex-col gap-1">
          <span className="text-caption font-medium uppercase tracking-wider text-text-muted">
            {isApproved ? "Lương chính thức đã chốt" : "Lương tạm tính (Sau khấu trừ)"}
          </span>
          <p className="text-3xl font-extrabold tracking-tight text-text-strong sm:text-4xl tabular-nums">
            {formatCurrency(statement?.payableVnd ?? 0)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary text-text-muted">
            {latestCompletedWorkAt ? (
              <span>Công gần nhất đã tính: {formatDateTime(latestCompletedWorkAt)}</span>
            ) : (
              <span>Chưa phát sinh công hoàn tất trong tháng</span>
            )}
            {statement?.positionCode ? (
              <span>Vị trí: <strong className="font-semibold text-text-default">{getPayrollPositionLabel(statement.positionCode)}</strong></span>
            ) : null}
          </div>
        </div>

        {/* Pending Verification Notice */}
        {pendingCount > 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg p-3.5 text-secondary text-warning">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                Có {pendingCount} ca làm việc chờ xác minh công (đã tính vào số tạm tính).
              </p>
              <p className="mt-0.5 text-caption text-text-default">
                Xác minh công là quy trình kiểm tra chấm công, không đồng nghĩa với việc bảng lương cả tháng đã được duyệt.
              </p>
            </div>
          </div>
        ) : null}

        {/* Open shifts notice */}
        {openShifts.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised/60 px-3.5 py-2 text-secondary text-text-muted">
            <Clock className="h-4 w-4 shrink-0 text-text-subtle" />
            <span>
              Có {openShifts.length} ca đang làm việc (chưa checkout). Ca đang mở không tính tiền cho đến khi kết thúc.
            </span>
          </div>
        ) : null}

        {/* Breakdown Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-secondary">
            <thead>
              <tr className="border-b border-border-subtle text-caption font-semibold text-text-muted">
                <th className="pb-2">Khoản lương</th>
                <th className="pb-2">Cơ sở tính</th>
                <th className="pb-2 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {/* Công */}
              <tr>
                <td className="py-2.5 font-medium text-text-strong">Lương theo công</td>
                <td className="py-2.5 text-text-muted">
                  {formatWorkMinutes(workedMinutesTotal)} quy đổi
                  {baseSalaryLines.length > 1 ? " (gồm online & offline)" : ""}
                </td>
                <td className="py-2.5 text-right font-medium text-text-strong tabular-nums">
                  {formatCurrency(baseSalaryTotal)}
                </td>
              </tr>

              {/* Phụ cấp */}
              {allowanceTotal > 0 ? (
                <tr>
                  <td className="py-2.5 font-medium text-text-strong">Phụ cấp trợ giảng</td>
                  <td className="py-2.5 text-text-muted">{allowanceLines.length} lượt phát sinh</td>
                  <td className="py-2.5 text-right font-medium text-text-strong tabular-nums">
                    {formatCurrency(allowanceTotal)}
                  </td>
                </tr>
              ) : null}

              {/* Thưởng & Hoa hồng */}
              {bonusTotal > 0 ? (
                <tr>
                  <td className="py-2.5 font-medium text-text-strong">Thưởng & Hoa hồng</td>
                  <td className="py-2.5 text-text-muted">
                    {bonusLines.map((b) => getLineTypeLabel(b.lineType)).join(", ")}
                    {hasGradingBonus ? (
                      <span className="block text-caption text-text-subtle">
                        *Thưởng quỹ chấm bài tạm tính theo tỷ trọng hiện tại, có thể tăng hoặc giảm.
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right font-medium text-text-strong tabular-nums">
                    {formatCurrency(bonusTotal)}
                  </td>
                </tr>
              ) : null}

              {/* Tổng thu nhập trước khấu trừ */}
              <tr className="bg-surface-raised/30">
                <td className="py-2 font-semibold text-text-strong">Tổng thu nhập</td>
                <td className="py-2 text-caption text-text-muted">Trước các khoản khấu trừ</td>
                <td className="py-2 text-right font-semibold text-text-strong tabular-nums">
                  {formatCurrency(statement?.totalEarningsVnd ?? 0)}
                </td>
              </tr>

              {/* Khấu trừ tạm ứng */}
              {statement?.advanceDeductionsVnd && statement.advanceDeductionsVnd > 0 ? (
                <tr>
                  <td className="py-2.5 font-medium text-warning">Khấu trừ tạm ứng</td>
                  <td className="py-2.5 text-text-muted">Khoản tạm ứng thuộc kỳ {formatMonth(month).toLowerCase()}</td>
                  <td className="py-2.5 text-right font-medium text-warning tabular-nums">
                    −{formatCurrency(statement.advanceDeductionsVnd)}
                  </td>
                </tr>
              ) : null}

              {/* Khấu trừ khác nếu có */}
              {deductionTotal > (statement?.advanceDeductionsVnd ?? 0) ? (
                <tr>
                  <td className="py-2.5 font-medium text-warning">Khấu trừ khác</td>
                  <td className="py-2.5 text-text-muted">Bù trừ lương khoán / giảm trừ</td>
                  <td className="py-2.5 text-right font-medium text-warning tabular-nums">
                    −{formatCurrency(deductionTotal - (statement?.advanceDeductionsVnd ?? 0))}
                  </td>
                </tr>
              ) : null}

              {/* Lương tạm tính sau khấu trừ */}
              <tr className="border-t-2 border-border-strong font-bold text-text-strong">
                <td className="py-3">Lương tạm tính</td>
                <td className="py-3 text-caption font-normal text-text-muted">Số tiền thực nhận tính đến hiện tại</td>
                <td className="py-3 text-right text-base text-action-link tabular-nums">
                  {formatCurrency(statement?.payableVnd ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bảng lương theo ngày */}
        <div className="mt-6 border-t border-border-subtle pt-5">
          <PayrollDailyBreakdownTable
            estimate={estimate}
            headingId="live-estimate-daily-heading"
            today={today}
          />
        </div>

        {/* Collapsible Recent Shifts */}
        {recentShifts.length > 0 ? (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <button
              className="flex w-full items-center justify-between text-secondary font-semibold text-text-default hover:text-text-strong"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              type="button"
            >
              <span>Xem nguồn công gần nhất ({recentShifts.length} ca gần đây)</span>
              <span className="text-caption font-normal text-text-muted">
                {isDetailsOpen ? "Thu gọn ▲" : "Chi tiết ▼"}
              </span>
            </button>

            {isDetailsOpen ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-caption">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="pb-1.5">Ngày / Ca</th>
                      <th className="pb-1.5">Hình thức</th>
                      <th className="pb-1.5">Trạng thái xác minh</th>
                      <th className="pb-1.5 text-right">Thời lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {recentShifts.map((shift) => {
                      // Recent shifts are completed time entries.
                      const payState = getShiftPayState({ ...shift, status: "checked_out" }, shiftPayContext);
                      const payBadge = getShiftPayBadge(payState, {
                        isApproved,
                        notInPayReason: payState === "not_in_pay" ? getNotInPayReason(shift, shiftPayContext) : null,
                      });
                      return (
                        <tr key={shift.id}>
                          <td className="py-2 font-medium text-text-default">
                            {formatDate(shift.workDate)}
                            {shift.checkInAt && shift.checkOutAt ? (
                              <span className="ml-1 text-text-muted">
                                ({formatClockTime(shift.checkInAt)}–{formatClockTime(shift.checkOutAt)})
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 text-text-muted">
                            {shift.workMode === "online" ? "Online (50%)" : "Offline"}
                          </td>
                          <td className="py-2">
                            <Badge tone={payBadge.tone}>{payBadge.label}</Badge>
                          </td>
                          <td className="py-2 text-right font-medium tabular-nums text-text-strong">
                            {formatWorkMinutes(shift.workedMinutes)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
