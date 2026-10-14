"use client";

import { AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { ResultBanner } from "@/components/shared/result-banner";
import { PayrollDailyBreakdownTable } from "@/features/payroll/estimate/components/payroll-daily-breakdown-table";
import {
  formatClockTime,
  formatDayMonth,
  getOfflineDailyRate,
  getPendingVerificationSummary,
} from "@/features/payroll/estimate/daily-breakdown";
import type { PayrollConnectionState, StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import { formatDashboardMonth, formatShortMonth } from "@/features/payroll/dashboard/format";
import { formatCurrency } from "@/features/payroll/payroll-presentation";
import { cn } from "@/lib/utils";

export interface StaffDailyEstimateTarget {
  positionLabel?: string | null;
  staffDisplayName: string;
  staffEmployeeCode?: string | null;
  staffId: string;
}

export type StaffPayrollLedgerLoadState = "loading" | "error" | "ready";

interface StaffPayrollLedgerProps {
  /** Header controls on the right (refresh, close). */
  actions?: ReactNode;
  connectionState?: PayrollConnectionState;
  descriptionId?: string;
  estimate: StaffPayrollEstimate | null;
  loadState: StaffPayrollLedgerLoadState;
  month: string;
  onRetry?: () => void;
  /** Owner viewing another staff member: link to the staff profile. */
  showProfileLink?: boolean;
  target: StaffDailyEstimateTarget;
  titleId: string;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng theo ngày; dùng trong kiểm thử. */
  today?: string;
  /** `dialog` keeps the header pinned while the ledger scrolls. */
  variant?: "dialog" | "page";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Lương tạm tính theo ngày của một nhân sự (thiết kế 8b): đầu trang nhân sự,
 * cảnh báo ca chờ xác minh (vẫn tính tạm) và sổ lương theo ngày. Chỉ trình
 * bày: dữ liệu và trạng thái tải do nơi gọi quyết định.
 */
export function StaffPayrollLedger({
  actions,
  connectionState,
  descriptionId,
  estimate,
  loadState,
  month,
  onRetry,
  showProfileLink = true,
  target,
  titleId,
  today,
  variant = "dialog",
}: StaffPayrollLedgerProps) {
  const isApproved = estimate?.status === "approved";
  const dailyRate = estimate ? getOfflineDailyRate(estimate.lines) : null;
  const meta = [
    target.staffEmployeeCode,
    target.positionLabel,
    // Several rates in the month: name the latest one rather than a vague "nhiều mức".
    dailyRate
      ? `Đơn giá ngày công offline ${formatCurrency(dailyRate.latestRateVnd)}${dailyRate.hasMultipleRates ? " (mới nhất)" : ""}`
      : null,
    formatDashboardMonth(month),
  ].filter(Boolean);

  return (
    <>
      <div
        className={cn(
          "bg-surface-base",
          variant === "dialog" ? "sticky top-0 z-10 border-b border-border-subtle px-4 py-4 sm:px-5" : "pb-1",
        )}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-action-primary-soft text-body font-bold text-action-primary sm:grid"
          >
            {getInitials(target.staffDisplayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-strong" id={titleId}>
                Lương theo ngày · {target.staffDisplayName}
              </h2>
              {estimate ? (
                isApproved ? (
                  <Badge tone="success">Đã duyệt {formatShortMonth(month)}</Badge>
                ) : (
                  <Badge tone="info">Tạm tính {formatShortMonth(month)}</Badge>
                )
              ) : null}
              {estimate?.completeness === "partial" ? <Badge tone="warning">Chưa tính đủ cấu hình</Badge> : null}
              {connectionState === "stale" ? <Badge tone="warning">Chưa cập nhật</Badge> : null}
            </div>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              {meta.join(" · ")}
              {showProfileLink ? (
                <>
                  {" · "}
                  <a
                    className="inline-flex items-center gap-1 font-medium text-action-link! hover:underline"
                    href={`/staff/${target.staffId}`}
                  >
                    Hồ sơ nhân sự <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </>
              ) : null}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      <div className={cn("grid min-w-0 gap-4", variant === "dialog" ? "p-4 sm:p-5" : "pt-4")}>
        {loadState === "loading" ? (
          <div className="grid gap-3" role="status">
            <div className="h-12 rounded-lg bg-surface-sunken motion-safe:animate-pulse" />
            <div className="h-64 rounded-lg bg-surface-sunken motion-safe:animate-pulse" />
            <span className="sr-only">Đang tải lương theo ngày</span>
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-body font-semibold text-text-strong">Chưa tải được lương theo ngày của nhân sự</p>
                <p className="mt-1 text-secondary text-text-muted">
                  Không kết nối được dữ liệu ước tính hoặc tài khoản không đủ quyền. Vui lòng thử lại.
                </p>
              </div>
            </div>
            {onRetry ? (
              <Button className="max-md:h-11" onClick={onRetry} size="sm" type="button" variant="secondary">
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại
              </Button>
            ) : null}
          </div>
        ) : null}

        {loadState === "ready" && estimate ? (
          <>
            <PendingVerificationBanner estimate={estimate} />
            <PayrollDailyBreakdownTable estimate={estimate} headingId={`${titleId}-daily`} today={today} />
          </>
        ) : null}
      </div>
    </>
  );
}

function PendingVerificationBanner({ estimate }: { estimate: StaffPayrollEstimate }) {
  // Approved pay already excludes unverified time entries: nothing is "tính tạm".
  if (estimate.status === "approved") return null;
  // Count = shifts with a provisional pay line (the statement count only for old payloads without
  // shifts, since it also counts unverified shifts that get no pay); up to 3 of them are named.
  const { count, shifts } = getPendingVerificationSummary(estimate);
  if (count === 0) return null;

  const listed = shifts
    .slice(0, Math.min(3, count))
    .map((shift) => `${formatDayMonth(shift.workDate)} ca ${formatClockTime(shift.checkInAt)}–${formatClockTime(shift.checkOutAt)}`);
  const overflow = count - listed.length;
  const more = listed.length > 0 && overflow > 0 ? ` và ${overflow} ca khác` : "";
  const shiftText = listed.length > 0 ? `${listed.join(", ")}${more}. ` : "";

  return (
    <ResultBanner
      action={
        <Link className={getButtonClassName({ className: "no-underline! text-text-strong! max-md:h-11", size: "sm", variant: "secondary" })} href="/timekeeping">
          Xem chấm công
        </Link>
      }
      description={`· ${shiftText}Công chờ xác minh vẫn được tính tạm vào lương; cần duyệt ngoại lệ chấm công trước khi kỳ lương chuyển sang đối soát.`}
      title={`${count} ca chờ xác minh`}
      tone="warning"
    />
  );
}
