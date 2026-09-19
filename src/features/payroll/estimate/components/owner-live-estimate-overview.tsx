"use client";

import { AlertTriangle, DollarSign, Percent, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePayrollLiveEstimate } from "@/features/payroll/estimate/use-payroll-live-estimate";
import type { OwnerPayrollEstimate } from "@/features/payroll/estimate/types";
import { formatCompactVnd, formatDashboardMonth, formatVnd } from "@/features/payroll/dashboard/format";
import { formatDateTime } from "@/features/payroll/payroll-presentation";

interface OwnerLiveEstimateOverviewProps {
  initialEstimate?: OwnerPayrollEstimate | null;
  month: string;
  positionCode?: string | null;
}

const positionNames: Record<string, string> = {
  admissions_manager: "Quản lý tuyển sinh",
  operations_assistant: "Trợ lý vận hành",
  teaching_assistant: "Trợ giảng",
  __unassigned__: "Chưa phân vị trí",
};

export function OwnerLiveEstimateOverview({
  initialEstimate,
  month,
  positionCode,
}: OwnerLiveEstimateOverviewProps) {
  const { connectionState, data, hasAttemptedFetch, isLoading, lastRefreshedAt, refetch } =
    usePayrollLiveEstimate<OwnerPayrollEstimate>({
      initialData: initialEstimate,
      month,
      positionCode,
      scope: "owner",
    });

  const estimate = data ?? initialEstimate;

  if (!estimate) {
    if (!hasAttemptedFetch || isLoading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div className="h-28 animate-pulse rounded-lg border border-border-subtle bg-surface-base p-4" key={i} />
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5 shadow-sm">
        <div>
          <p className="text-body font-semibold text-text-strong">Chưa tải được tổng quan lương tạm tính</p>
          <p className="mt-1 text-secondary text-text-muted">Không thể kết nối dữ liệu ước tính quỹ lương. Vui lòng thử lại.</p>
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
    );
  }

  const { byPosition, completeness, finance, issues, latestCompletedWorkAt, status, summary } = estimate;
  const isApproved = status === "approved";
  const pendingCount = summary.pendingVerificationCount ?? 0;

  return (
    <div className="grid min-w-0 gap-5">
      {/* Live Estimate Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-label font-bold uppercase tracking-wider text-action-link">
            {isApproved ? "Số liệu đã chốt" : "Tính đến hiện tại"}
          </span>
          {isApproved ? (
            <Badge tone="success">Lương đã duyệt</Badge>
          ) : (
            <Badge tone="info">Lương tạm tính</Badge>
          )}

          {completeness === "partial" ? (
            <Badge tone="warning">Chưa tính đủ dữ liệu ({issues.length} cảnh báo)</Badge>
          ) : null}

          {connectionState === "stale" ? (
            <Badge tone="warning">Chưa cập nhật</Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-caption text-text-muted">
          <span>
            {isApproved
              ? `Chốt: ${estimate.approvedAt ? formatDateTime(estimate.approvedAt) : "Đã duyệt"}`
              : latestCompletedWorkAt
                ? `Ca gần nhất: ${formatDateTime(latestCompletedWorkAt)}`
                : `Dữ liệu: ${formatDateTime(lastRefreshedAt.toISOString())}`}
          </span>
          <button
            aria-label="Làm mới tổng quan lương tạm tính"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-surface-base text-text-default hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void refetch()}
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Main KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Tổng thu nhập phát sinh */}
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-text-muted">Tổng thu nhập</span>
            <TrendingUp className="h-4 w-4 text-text-muted" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-strong tabular-nums sm:text-3xl">
            {formatVnd(summary.totalEarningsVnd)}
          </p>
          <p className="mt-1 text-caption text-text-muted">Trước các khoản khấu trừ</p>
        </div>

        {/* KPI 2: Tổng lương tạm tính phải trả */}
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-text-muted">Lương tạm tính phải trả</span>
            <DollarSign className="h-4 w-4 text-action-link" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-action-link tabular-nums sm:text-3xl">
            {formatVnd(summary.payableVnd)}
          </p>
          <p className="mt-1 text-caption text-text-muted">
            Khấu trừ: {formatVnd(summary.totalDeductionsVnd)} (Tạm ứng: {formatVnd(summary.advanceDeductionsVnd)})
          </p>
        </div>

        {/* KPI 3: Học phí thực thu sau hoàn */}
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-text-muted">Thực thu sau hoàn</span>
            <Users className="h-4 w-4 text-text-muted" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-strong tabular-nums sm:text-3xl">
            {finance.status === "restricted"
              ? "Giới hạn quyền"
              : formatVnd(finance.tuitionNetVnd ?? 0)}
          </p>
          <p className="mt-1 text-caption text-text-muted">
            {finance.status === "restricted"
              ? "Cần quyền finance.view"
              : `Thu: ${formatCompactVnd(finance.tuitionReceivedVnd ?? 0)} · Hoàn: ${formatCompactVnd(finance.tuitionRefundedVnd ?? 0)}`}
          </p>
        </div>

        {/* KPI 4: Tỷ lệ lương phải trả / thực thu */}
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-text-muted">Lương phải trả / Thực thu</span>
            <Percent className="h-4 w-4 text-text-muted" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-strong tabular-nums sm:text-3xl">
            {finance.status === "restricted" || (finance.tuitionNetVnd ?? 0) <= 0 || finance.payrollRatioPercent === null || finance.payrollRatioPercent === undefined
              ? "Không áp dụng"
              : `${finance.payrollRatioPercent}%`}
          </p>
          <p className="mt-1 text-caption text-text-muted">
            {positionCode
              ? "Lương vị trí / Thực thu toàn trung tâm"
              : "Trên học phí thực thu trong kỳ"}
          </p>
        </div>
      </div>

      {/* Pending verification notice */}
      {pendingCount > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg p-3.5 text-secondary text-warning-text">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              Có {pendingCount} ca làm việc đang chờ xác minh công nằm trong số tạm tính.
            </p>
            <p className="mt-0.5 text-caption text-text-default">
              Các khoản thưởng theo kết quả tháng (quỹ chấm bài, ngưỡng doanh thu) có thể tăng hoặc giảm khi dữ liệu phát sinh thêm.
            </p>
          </div>
        </div>
      ) : null}

      {/* Breakdown by Position Table */}
      {byPosition.length > 0 ? (
        <section aria-labelledby="live-by-position-heading" className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5 shadow-sm">
          <h3 className="text-section-title font-semibold text-text-strong" id="live-by-position-heading">
            Tạm tính theo vị trí ({formatDashboardMonth(month)})
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-secondary">
              <thead>
                <tr className="border-b border-border-subtle text-caption font-semibold text-text-muted">
                  <th className="pb-2">Vị trí</th>
                  <th className="pb-2 text-center">Nhân sự</th>
                  <th className="pb-2 text-right">Thu nhập</th>
                  <th className="pb-2 text-right">Khấu trừ</th>
                  <th className="pb-2 text-right">Tạm tính phải trả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {byPosition.map((row) => (
                  <tr key={row.positionCode}>
                    <td className="py-2.5 font-medium text-text-strong">
                      {positionNames[row.positionCode] ?? row.positionCode}
                    </td>
                    <td className="py-2.5 text-center text-text-muted tabular-nums">
                      {row.staffCount}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text-default">
                      {formatVnd(row.totalEarningsVnd)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-warning-text">
                      {row.totalDeductionsVnd > 0 ? `−${formatVnd(row.totalDeductionsVnd)}` : "0 ₫"}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-action-link">
                      {formatVnd(row.payableVnd)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border-strong font-bold text-text-strong">
                  <td className="py-3">Tổng cộng</td>
                  <td className="py-3 text-center tabular-nums">{summary.staffCount}</td>
                  <td className="py-3 text-right tabular-nums">{formatVnd(summary.totalEarningsVnd)}</td>
                  <td className="py-3 text-right tabular-nums text-warning-text">
                    {summary.totalDeductionsVnd > 0 ? `−${formatVnd(summary.totalDeductionsVnd)}` : "0 ₫"}
                  </td>
                  <td className="py-3 text-right tabular-nums text-action-link">{formatVnd(summary.payableVnd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption text-text-muted">
            *Tỷ lệ trên phục vụ đối chiếu lương phải trả với thực thu; không biểu thị lợi nhuận hoặc số dư tiền mặt. Khi lọc theo một vị trí, mẫu số vẫn là thực thu toàn trung tâm.
          </p>
        </section>
      ) : null}
    </div>
  );
}
