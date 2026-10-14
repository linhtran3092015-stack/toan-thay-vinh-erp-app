"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { getPayrollPositionName } from "@/features/payroll/dashboard/aggregate";
import { PayrollFiguresStrip } from "@/features/payroll/dashboard/components/payroll-figures-strip";
import { formatDashboardMonth, formatVnd } from "@/features/payroll/dashboard/format";
import {
  buildLiveEstimateFigures,
  buildOwnerStaffRows,
  countStaffWithoutPayrollPosition,
  type OwnerStaffRow,
} from "@/features/payroll/dashboard/overview-model";
import { getCurrentPayrollMonth } from "@/features/payroll/dashboard/url-state";
import {
  StaffDailyEstimateDialog,
  type StaffDailyEstimateTarget,
} from "@/features/payroll/estimate/components/staff-daily-estimate-dialog";
import type { OwnerPayrollEstimate } from "@/features/payroll/estimate/types";
import {
  type PayrollEstimateTransport,
  usePayrollLiveEstimate,
} from "@/features/payroll/estimate/use-payroll-live-estimate";
import { formatDateTime, formatWorkMinutes } from "@/features/payroll/payroll-presentation";
import { cn } from "@/lib/utils";

interface OwnerLiveEstimateOverviewProps {
  initialEstimate?: OwnerPayrollEstimate | null;
  month: string;
  positionCode?: string | null;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng lương theo ngày; dùng trong kiểm thử. */
  today?: string;
  /** Defaults to the real `/api/payroll/*` endpoints + realtime channel. */
  transport?: PayrollEstimateTransport;
}

/** Mobile (<md): each staff row stacks into a card; every value keeps an inline label. */
const stackedRowClassName =
  "max-md:grid max-md:h-auto max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1.5 max-md:border-t max-md:border-border-row max-md:px-4 max-md:py-3 max-md:first:border-t-0 max-md:[&>td]:border-t-0! max-md:[&>td]:px-0!";

function MobileLabel({ children }: { children: string }) {
  return <span className="block text-caption text-text-muted md:hidden">{children}</span>;
}

export function OwnerLiveEstimateOverview({
  initialEstimate,
  month,
  positionCode,
  today,
  transport,
}: OwnerLiveEstimateOverviewProps) {
  const { connectionState, data, hasAttemptedFetch, isLoading, refetch } =
    usePayrollLiveEstimate<OwnerPayrollEstimate>({
      initialData: initialEstimate,
      month,
      positionCode,
      scope: "owner",
      transport,
    });

  // Nhân sự đang được mở bảng lương theo ngày (hộp thoại realtime)
  const [dailyTarget, setDailyTarget] = useState<StaffDailyEstimateTarget | null>(null);
  const [isDailyOpen, setIsDailyOpen] = useState(false);

  const estimate = data ?? initialEstimate;

  if (!estimate) {
    if (!hasAttemptedFetch || isLoading) {
      return (
        <div aria-hidden="true" className="grid gap-4 motion-safe:animate-pulse">
          <div className="h-[76px] rounded-lg border border-border-subtle bg-surface-base" />
          <div className="h-64 rounded-lg border border-border-subtle bg-surface-base" />
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)] sm:p-5">
        <div>
          <p className="text-body font-semibold text-text-strong">Chưa tải được tổng quan lương tạm tính</p>
          <p className="mt-1 text-secondary text-text-muted">Không thể kết nối dữ liệu ước tính quỹ lương. Vui lòng thử lại.</p>
        </div>
        <Button className="max-md:h-11" onClick={() => void refetch()} size="sm" type="button" variant="secondary">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Thử lại
        </Button>
      </div>
    );
  }

  const { byPosition, completeness, issues, latestCompletedWorkAt, status, summary } = estimate;
  const isApproved = status === "approved";
  // Approved pay excludes unverified work: no "nằm trong số tạm tính" banner.
  const pendingCount = isApproved ? 0 : summary.pendingVerificationCount ?? 0;
  const figures = buildLiveEstimateFigures(estimate, { positionFiltered: Boolean(positionCode) });
  const staffRows = buildOwnerStaffRows(estimate);
  const staffWithoutPositionCount = countStaffWithoutPayrollPosition(estimate, { positionCode });
  // byPosition is not position-filtered: keep only the selected position so rows add up to the filtered total.
  const positionRows = positionCode ? byPosition.filter((row) => row.positionCode === positionCode) : byPosition;
  const hasRatioFigure = figures.some((figure) => figure.key === "ratio");
  const currentMonth = getCurrentPayrollMonth();

  const openDaily = (row: OwnerStaffRow) => {
    setDailyTarget({
      positionLabel: row.positionLabel,
      staffDisplayName: row.staffDisplayName,
      staffEmployeeCode: row.staffEmployeeCode,
      staffId: row.staffId,
    });
    setIsDailyOpen(true);
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-semibold text-text-strong">
            {isApproved ? "Số liệu đã chốt" : "Tính đến hiện tại"}
          </span>
          {completeness === "partial" ? (
            <Badge tone="warning">Chưa tính đủ dữ liệu ({issues.length} cảnh báo)</Badge>
          ) : null}
          {connectionState === "stale" ? <Badge tone="warning">Chưa cập nhật</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {isApproved
              ? `Chốt: ${estimate.approvedAt ? formatDateTime(estimate.approvedAt) : "Đã duyệt"}`
              : `Dữ liệu tính lúc: ${formatDateTime(estimate.calculatedAt ?? estimate.asOf)}`}
          </span>
          {isApproved ? null : (
            <span>{latestCompletedWorkAt ? `Ca gần nhất: ${formatDateTime(latestCompletedWorkAt)}` : "Chưa có ca hoàn tất"}</span>
          )}
          <Button
            aria-label="Làm mới tổng quan lương tạm tính"
            className="max-md:h-11 max-md:w-11"
            disabled={isLoading}
            iconOnly
            onClick={() => void refetch()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Viewing a past month with no live estimate: point back to the current month. */}
      {month.slice(0, 7) !== currentMonth.slice(0, 7) && staffRows.length === 0 && summary.totalEarningsVnd === 0 ? (
        <ResultBanner
          action={
            <Link
              className="inline-flex items-center text-action-link! max-md:min-h-11"
              href={`/payroll/dashboard?month=${currentMonth.slice(0, 7)}${positionCode ? `&position=${encodeURIComponent(positionCode)}` : ""}`}
            >
              Chuyển sang {formatDashboardMonth(currentMonth)} (Tháng hiện tại) →
            </Link>
          }
          description="Kỳ này chưa có dữ liệu chấm công thời gian thực."
          title={`Bạn đang xem ${formatDashboardMonth(month)}.`}
          tone="info"
        />
      ) : null}

      <PayrollFiguresStrip figures={figures} label="Số liệu lương tạm tính" />

      {pendingCount > 0 ? (
        <ResultBanner
          description="Các khoản thưởng theo kết quả tháng (quỹ chấm bài, ngưỡng doanh thu) có thể tăng hoặc giảm khi dữ liệu phát sinh thêm."
          title={`Có ${pendingCount} ca làm việc đang chờ xác minh công nằm trong số tạm tính.`}
          tone="warning"
        />
      ) : null}

      <section aria-labelledby="live-by-staff-heading" className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-body font-semibold text-text-strong" id="live-by-staff-heading">Theo nhân sự</h2>
          <span className="text-secondary text-text-muted">· {staffRows.length} người</span>
          <span className="w-full text-caption text-text-muted sm:ml-auto sm:w-auto">Mở một nhân sự để xem lương theo từng ngày (cập nhật thời gian thực).</span>
        </div>
        <DataTableFrame
          body={staffRows.map((row) => <StaffRow isApproved={isApproved} key={row.staffId} onOpen={() => openDaily(row)} row={row} />)}
          caption={`${isApproved ? "Lương đã duyệt" : "Lương tạm tính"} theo nhân sự · ${formatDashboardMonth(month)}`}
          empty={
            <TableState>
              <p className="text-body font-semibold text-text-strong">Chưa có nhân sự phát sinh lương tạm tính</p>
              <p className="text-secondary text-text-muted">Bảng sẽ cập nhật khi có ca chấm công kết thúc trong {formatDashboardMonth(month).toLowerCase()}.</p>
            </TableState>
          }
          footer={
            staffRows.length > 0 || staffWithoutPositionCount > 0 ? (
              <div className="grid w-full gap-2">
                {staffRows.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    {/* Counts the visible rows: staff with activity or a blocking issue. */}
                    <span className="font-semibold text-text-strong">Tổng {staffRows.length} nhân sự</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                      <span>Thu nhập {formatVnd(summary.totalEarningsVnd)}</span>
                      <span>Khấu trừ {summary.totalDeductionsVnd > 0 ? `−${formatVnd(summary.totalDeductionsVnd)}` : formatVnd(0)}</span>
                      <span className="font-semibold text-text-strong">{isApproved ? "Phải trả" : "Tạm tính"} {formatVnd(summary.payableVnd)}</span>
                    </span>
                  </div>
                ) : null}
                {staffWithoutPositionCount > 0 ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-warning" data-testid="staff-without-position">
                    <span>
                      {staffWithoutPositionCount} nhân sự có chấm công nhưng chưa có vị trí tính lương nên chưa tính được.
                    </span>
                    <Link className="inline-flex items-center font-medium text-action-link! hover:underline max-md:min-h-11" href="/staff">
                      Cập nhật vị trí
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : undefined
          }
          header={
            <tr className="max-md:hidden">
              <TableHeaderCell>Nhân sự</TableHeaderCell>
              <TableHeaderCell>Vị trí</TableHeaderCell>
              <TableHeaderCell numeric>Giờ công</TableHeaderCell>
              <TableHeaderCell numeric>Chờ xác minh</TableHeaderCell>
              <TableHeaderCell numeric>Thu nhập</TableHeaderCell>
              <TableHeaderCell numeric>Khấu trừ</TableHeaderCell>
              <TableHeaderCell numeric>{isApproved ? "Phải trả" : "Tạm tính"}</TableHeaderCell>
              <TableHeaderCell><span className="sr-only">Thao tác</span></TableHeaderCell>
            </tr>
          }
          status={staffRows.length > 0 ? "ready" : "empty"}
          tableClassName="md:min-w-[980px] max-md:block max-md:[&>tbody]:block"
        />
      </section>

      {positionRows.length > 0 ? (
        <section aria-labelledby="live-by-position-heading" className="grid min-w-0 gap-2">
          <h2 className="text-body font-semibold text-text-strong" id="live-by-position-heading">
            Tạm tính theo vị trí ({formatDashboardMonth(month)})
          </h2>
          <DataTableFrame
            body={
              <>
                {positionRows.map((row) => (
                  <TableRow key={row.positionCode}>
                    <TableCell className="font-medium text-text-strong">{getPayrollPositionName(row.positionCode)}</TableCell>
                    <TableCell numeric>{row.staffCount}</TableCell>
                    <TableCell numeric>{formatVnd(row.totalEarningsVnd)}</TableCell>
                    <TableCell className={row.totalDeductionsVnd > 0 ? "text-danger" : "text-text-subtle"} numeric>
                      {row.totalDeductionsVnd > 0 ? `−${formatVnd(row.totalDeductionsVnd)}` : formatVnd(0)}
                    </TableCell>
                    <TableCell className="font-semibold text-text-strong" numeric>{formatVnd(row.payableVnd)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-sunken font-semibold text-text-strong">
                  <TableCell>Tổng cộng</TableCell>
                  <TableCell numeric>{summary.staffCount}</TableCell>
                  <TableCell numeric>{formatVnd(summary.totalEarningsVnd)}</TableCell>
                  <TableCell className={summary.totalDeductionsVnd > 0 ? "text-danger" : "text-text-subtle"} numeric>
                    {summary.totalDeductionsVnd > 0 ? `−${formatVnd(summary.totalDeductionsVnd)}` : formatVnd(0)}
                  </TableCell>
                  <TableCell numeric>{formatVnd(summary.payableVnd)}</TableCell>
                </TableRow>
              </>
            }
            caption={`Tạm tính theo vị trí · ${formatDashboardMonth(month)}`}
            footer={
              hasRatioFigure ? (
                <span className="text-caption">
                  *Tỷ lệ lương / thực thu phục vụ đối chiếu lương phải trả với thực thu; không biểu thị lợi nhuận hoặc số dư tiền mặt. Khi lọc theo một vị trí, mẫu số vẫn là thực thu toàn trung tâm.
                </span>
              ) : undefined
            }
            header={
              <tr>
                <TableHeaderCell>Vị trí</TableHeaderCell>
                <TableHeaderCell numeric>Nhân sự</TableHeaderCell>
                <TableHeaderCell numeric>Thu nhập</TableHeaderCell>
                <TableHeaderCell numeric>Khấu trừ</TableHeaderCell>
                <TableHeaderCell numeric>Tạm tính phải trả</TableHeaderCell>
              </tr>
            }
            tableClassName="min-w-[600px]"
          />
        </section>
      ) : null}

      <StaffDailyEstimateDialog
        isOpen={isDailyOpen}
        month={month}
        onClose={() => setIsDailyOpen(false)}
        target={dailyTarget}
        today={today}
        transport={transport}
      />
    </div>
  );
}

function StaffRow({ isApproved, onOpen, row }: { isApproved: boolean; onOpen: () => void; row: OwnerStaffRow }) {
  const blocked = row.blockedReason !== null;
  // Nothing calculated yet: show "Chưa tính được", never a 0 amount.
  const uncalculated = blocked && !row.hasCalculatedAmounts;
  const muted = <span className="text-text-subtle">—</span>;

  return (
    <TableRow className={stackedRowClassName}>
      <TableCell className="max-md:col-span-2">
        <span className="font-semibold text-text-strong">{row.staffDisplayName}</span>
        {row.staffEmployeeCode ? <span className="ml-1.5 text-caption text-text-muted">{row.staffEmployeeCode}</span> : null}
        {blocked && !uncalculated ? (
          <span className="mt-1 block">
            <Badge tone="warning">Chưa đủ dữ liệu · {row.blockedReason}</Badge>
          </span>
        ) : null}
      </TableCell>
      <TableCell className={cn("text-secondary max-md:col-span-2", row.positionCode ? undefined : "text-warning")}>
        <MobileLabel>Vị trí</MobileLabel>
        {row.positionLabel}
      </TableCell>
      <TableCell numeric className="max-md:text-left!">
        <MobileLabel>Giờ công</MobileLabel>
        {row.workedMinutes > 0 ? formatWorkMinutes(row.workedMinutes) : muted}
      </TableCell>
      <TableCell numeric className={cn("max-md:text-left!", row.pendingVerificationCount > 0 && "text-warning")}>
        <MobileLabel>Chờ xác minh</MobileLabel>
        {row.pendingVerificationCount > 0 ? `${row.pendingVerificationCount} ca` : muted}
      </TableCell>
      <TableCell numeric className="max-md:text-left!">
        <MobileLabel>Thu nhập</MobileLabel>
        {uncalculated ? muted : formatVnd(row.totalEarningsVnd)}
      </TableCell>
      <TableCell numeric className="max-md:text-left!">
        <MobileLabel>Khấu trừ</MobileLabel>
        {uncalculated ? muted : row.totalDeductionsVnd > 0 ? (
          <>
            <span className="text-danger">−{formatVnd(row.totalDeductionsVnd)}</span>
            {row.advanceDeductionsVnd > 0 ? (
              <span className="block text-caption text-text-muted">gồm tạm ứng {formatVnd(row.advanceDeductionsVnd)}</span>
            ) : null}
          </>
        ) : muted}
      </TableCell>
      <TableCell numeric className="max-md:col-span-2 max-md:text-left!">
        <MobileLabel>{isApproved ? "Phải trả" : "Tạm tính"}</MobileLabel>
        {uncalculated ? (
          <>
            <span className="font-semibold text-warning">Chưa tính được</span>
            <span className="block text-caption text-text-muted">{row.blockedReason}</span>
          </>
        ) : (
          <span className="font-semibold text-text-strong">{formatVnd(row.payableVnd)}</span>
        )}
      </TableCell>
      <TableCell className="text-right max-md:col-span-2">
        {/* Visible "Xem" starts the accessible name (label in name). */}
        <button
          aria-label={`Xem lương theo ngày của ${row.staffDisplayName}`}
          className={getButtonClassName({ className: "max-md:h-11 max-md:w-full", size: "sm", variant: "secondary" })}
          onClick={onOpen}
          type="button"
        >
          Xem
        </button>
      </TableCell>
    </TableRow>
  );
}
