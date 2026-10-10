"use client";

import { AlertCircle, ExternalLink, RefreshCw, X } from "lucide-react";
import { type RefObject, useId, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PayrollDailyBreakdownTable } from "@/features/payroll/estimate/components/payroll-daily-breakdown-table";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import { usePayrollLiveEstimate } from "@/features/payroll/estimate/use-payroll-live-estimate";
import { formatDashboardMonth, formatVnd } from "@/features/payroll/dashboard/format";
import { formatDateTime, formatWorkMinutes } from "@/features/payroll/payroll-presentation";

export interface StaffDailyEstimateTarget {
  positionLabel?: string | null;
  staffDisplayName: string;
  staffEmployeeCode?: string | null;
  staffId: string;
}

interface StaffDailyEstimateDialogProps {
  isOpen: boolean;
  month: string;
  onClose: () => void;
  target: StaffDailyEstimateTarget | null;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng theo ngày; dùng trong kiểm thử. */
  today?: string;
}

/**
 * Hộp thoại cho chủ trung tâm: lương theo ngày (realtime) của một nhân sự
 * trong tháng đang xem trên dashboard. Chỉ đăng ký realtime khi đang mở.
 */
export function StaffDailyEstimateDialog({
  isOpen,
  month,
  onClose,
  target,
  today,
}: StaffDailyEstimateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  if (!target) {
    return null;
  }

  return (
    <Dialog
      ariaDescribedBy={descriptionId}
      ariaLabelledBy={titleId}
      className="h-[96vh] max-w-[1100px] sm:h-auto"
      initialFocusRef={closeRef}
      isOpen={isOpen}
      onClose={onClose}
    >
      {isOpen ? (
        <StaffDailyEstimateDialogBody
          closeRef={closeRef}
          descriptionId={descriptionId}
          month={month}
          onClose={onClose}
          target={target}
          titleId={titleId}
          today={today}
        />
      ) : null}
    </Dialog>
  );
}

function StaffDailyEstimateDialogBody({
  closeRef,
  descriptionId,
  month,
  onClose,
  target,
  titleId,
  today,
}: {
  closeRef: RefObject<HTMLButtonElement | null>;
  descriptionId: string;
  month: string;
  onClose: () => void;
  target: StaffDailyEstimateTarget;
  titleId: string;
  today?: string;
}) {
  const { connectionState, data, hasAttemptedFetch, isLoading, lastRefreshedAt, refetch } =
    usePayrollLiveEstimate<StaffPayrollEstimate>({
      month,
      scope: "staff",
      staffId: target.staffId,
    });

  const statement = data?.statement ?? null;
  const isApproved = data?.status === "approved";

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-base px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title text-text-strong" id={titleId}>
                Lương theo ngày · {target.staffDisplayName}
              </h2>
              {data ? (
                isApproved ? <Badge tone="success">Lương đã duyệt</Badge> : <Badge tone="info">Lương tạm tính</Badge>
              ) : null}
              {data?.completeness === "partial" ? <Badge tone="warning">Chưa tính đủ cấu hình</Badge> : null}
              {connectionState === "stale" ? <Badge tone="warning">Chưa cập nhật</Badge> : null}
            </div>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              {formatDashboardMonth(month)}
              {target.staffEmployeeCode ? ` · ${target.staffEmployeeCode}` : ""}
              {target.positionLabel ? ` · ${target.positionLabel}` : ""}
              {" · "}
              <a className="inline-flex items-center gap-1 font-medium text-action-link hover:underline" href={`/staff/${target.staffId}`}>
                Hồ sơ nhân sự <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              aria-label="Làm mới lương theo ngày"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface-base text-text-default hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
              disabled={isLoading}
              onClick={() => void refetch()}
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <Button aria-label="Đóng bảng lương theo ngày" className="px-2 active:bg-interactive-pressed" onClick={onClose} ref={closeRef} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" size={20} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5">
        {!data && (!hasAttemptedFetch || isLoading) ? (
          <div className="grid gap-4" role="status">
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((index) => (
                <div className="h-20 animate-pulse rounded-lg border border-border-subtle bg-surface-raised" key={index} />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-lg border border-border-subtle bg-surface-raised" />
            <span className="sr-only">Đang tải lương theo ngày</span>
          </div>
        ) : null}

        {!data && hasAttemptedFetch && !isLoading ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" />
              <div>
                <p className="text-body font-semibold text-text-strong">Chưa tải được lương theo ngày của nhân sự</p>
                <p className="mt-1 text-secondary text-text-muted">
                  Không kết nối được dữ liệu ước tính hoặc tài khoản không đủ quyền. Vui lòng thử lại.
                </p>
              </div>
            </div>
            <Button onClick={() => void refetch()} size="sm" type="button" variant="outline">
              <RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại
            </Button>
          </div>
        ) : null}

        {data ? (
          <>
            <section aria-label="Tổng hợp tháng" className="grid gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4 sm:grid-cols-3">
              <SummaryFact
                emphasis
                label={isApproved ? "Lương chính thức đã chốt" : "Lương tạm tính sau khấu trừ"}
                value={formatVnd(statement?.payableVnd ?? 0)}
              />
              <SummaryFact
                hint={`Khấu trừ ${formatVnd(statement?.totalDeductionsVnd ?? 0)}`}
                label="Tổng thu nhập"
                value={formatVnd(statement?.totalEarningsVnd ?? 0)}
              />
              <SummaryFact
                hint={
                  data.latestCompletedWorkAt
                    ? `Công gần nhất ${formatDateTime(data.latestCompletedWorkAt)}`
                    : `Cập nhật ${formatDateTime(lastRefreshedAt.toISOString())}`
                }
                label="Giờ công đã tính"
                value={formatWorkMinutes(statement?.workedMinutes ?? 0)}
              />
            </section>

            {(statement?.pendingVerificationCount ?? 0) > 0 ? (
              <p className="rounded-lg border border-warning-border bg-warning-bg px-3.5 py-2.5 text-secondary text-warning-text">
                Có {statement?.pendingVerificationCount} ca chờ xác minh công đã được tính tạm vào số liệu.
              </p>
            ) : null}

            <PayrollDailyBreakdownTable estimate={data} headingId={`${titleId}-daily`} today={today} />
          </>
        ) : null}
      </div>
    </>
  );
}

function SummaryFact({
  emphasis = false,
  hint,
  label,
  value,
}: {
  emphasis?: boolean;
  hint?: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-caption font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${emphasis ? "text-2xl text-action-link" : "text-xl text-text-strong"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-caption text-text-muted">{hint}</p> : null}
    </div>
  );
}
