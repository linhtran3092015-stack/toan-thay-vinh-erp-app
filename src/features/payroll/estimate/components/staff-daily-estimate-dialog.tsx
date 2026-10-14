"use client";

import { RefreshCw, X } from "lucide-react";
import { type RefObject, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  StaffPayrollLedger,
  type StaffDailyEstimateTarget,
} from "@/features/payroll/estimate/components/staff-payroll-ledger";
import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import {
  type PayrollEstimateTransport,
  usePayrollLiveEstimate,
} from "@/features/payroll/estimate/use-payroll-live-estimate";

export type { StaffDailyEstimateTarget };

interface StaffDailyEstimateDialogProps {
  isOpen: boolean;
  month: string;
  onClose: () => void;
  target: StaffDailyEstimateTarget | null;
  /** Ghi đè "hôm nay" (YYYY-MM-DD) cho bảng theo ngày; dùng trong kiểm thử. */
  today?: string;
  /** Defaults to the real `/api/payroll/staff-estimate` endpoint + realtime. */
  transport?: PayrollEstimateTransport;
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
  transport,
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
          transport={transport}
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
  transport,
}: {
  closeRef: RefObject<HTMLButtonElement | null>;
  descriptionId: string;
  month: string;
  onClose: () => void;
  target: StaffDailyEstimateTarget;
  titleId: string;
  today?: string;
  transport?: PayrollEstimateTransport;
}) {
  const { connectionState, data, hasAttemptedFetch, isLoading, refetch } =
    usePayrollLiveEstimate<StaffPayrollEstimate>({
      month,
      scope: "staff",
      staffId: target.staffId,
      transport,
    });

  const loadState = data ? "ready" : !hasAttemptedFetch || isLoading ? "loading" : "error";

  return (
    <StaffPayrollLedger
      actions={
        <>
          <Button
            aria-label="Làm mới lương theo ngày"
            className="max-md:h-11 max-md:w-11"
            disabled={isLoading}
            iconOnly
            onClick={() => void refetch()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            aria-label="Đóng bảng lương theo ngày"
            className="max-md:h-11 max-md:w-11"
            iconOnly
            onClick={onClose}
            ref={closeRef}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </Button>
        </>
      }
      connectionState={connectionState}
      descriptionId={descriptionId}
      estimate={data}
      loadState={loadState}
      month={month}
      onRetry={() => void refetch()}
      target={target}
      titleId={titleId}
      today={today}
    />
  );
}
