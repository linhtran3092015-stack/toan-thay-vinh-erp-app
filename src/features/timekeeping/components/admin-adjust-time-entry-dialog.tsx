"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Edit3, X } from "lucide-react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  adminAdjustTimeEntryAction,
  type AdminTimekeepingActionState,
  initialAdminTimekeepingActionState,
} from "@/features/timekeeping/timekeeping-admin-actions";
import {
  formatVietnamDate,
  formatVietnamDateTimeInput,
  vietnamDatetimeInputToIso,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingMonthlyEntry } from "@/features/timekeeping/types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";

interface AdminAdjustTimeEntryDialogProps {
  entry: TimekeepingMonthlyEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  staffDisplayName?: string;
}

export function AdminAdjustTimeEntryDialog({
  entry,
  isOpen,
  onClose,
  onSuccess,
  staffDisplayName,
}: AdminAdjustTimeEntryDialogProps) {
  if (!entry || !isOpen) return null;

  return (
    <Dialog
      ariaDescribedBy="admin-adjust-time-entry-desc"
      ariaLabelledBy="admin-adjust-time-entry-title"
      className="max-w-lg p-6"
      isOpen={isOpen}
      onClose={onClose}
    >
      <AdminAdjustTimeEntryForm
        entry={entry}
        key={entry.id}
        onClose={onClose}
        onSuccess={onSuccess}
        staffDisplayName={staffDisplayName}
      />
    </Dialog>
  );
}

function AdminAdjustTimeEntryForm({
  entry,
  onClose,
  onSuccess,
  staffDisplayName,
}: {
  entry: TimekeepingMonthlyEntry;
  onClose: () => void;
  onSuccess?: () => void;
  staffDisplayName?: string;
}) {
  const initialIn = entry.adjustedCheckInAt || entry.checkInAt;
  const initialOut = entry.adjustedCheckOutAt || entry.checkOutAt || entry.checkInAt;

  const [isPending, startTransition] = useTransition();
  const [checkInInput, setCheckInInput] = useState<string>(() =>
    formatVietnamDateTimeInput(initialIn),
  );
  const [checkOutInput, setCheckOutInput] = useState<string>(() =>
    formatVietnamDateTimeInput(initialOut),
  );
  const [reason, setReason] = useState<string>("");
  const [actionState, setActionState] = useState<AdminTimekeepingActionState>(
    initialAdminTimekeepingActionState,
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    if (!reason.trim()) {
      setActionState({
        fieldErrors: { reason: ["Vui lòng nhập lý do điều chỉnh."] },
        message: "Vui lòng nhập lý do điều chỉnh công.",
        status: "error",
      });
      return;
    }

    startTransition(async () => {
      const result = await adminAdjustTimeEntryAction({
        checkInAt: vietnamDatetimeInputToIso(checkInInput),
        checkOutAt: vietnamDatetimeInputToIso(checkOutInput),
        reason: reason.trim(),
        timeEntryId: entry.id,
      });

      setActionState(result);
      if (result.status === "success") {
        if (onSuccess) {
          onSuccess();
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    });
  };

  const fieldErrors = actionState.fieldErrors ?? {};

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Edit3 size={18} />
          </div>
          <div>
            <h3
              className="font-display text-lg font-bold text-ink"
              id="admin-adjust-time-entry-title"
            >
              Điều chỉnh giờ chấm công
            </h3>
            <p className="text-xs text-ink-muted" id="admin-adjust-time-entry-desc">
              {staffDisplayName ? `Nhân sự: ${staffDisplayName} · ` : ""}
              Ngày: {formatVietnamDate(entry.workDate)}
            </p>
          </div>
        </div>
        <button
          aria-label="Đóng hộp thoại"
          className="rounded-lg p-1 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
          disabled={isPending}
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        {actionState.status !== "idle" ? (
          <ResultBanner
            description={actionState.message}
            title={
              actionState.status === "success"
                ? "Thành công"
                : "Không thể điều chỉnh"
            }
            tone={actionState.status === "success" ? "success" : "error"}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Giờ vào (Check-in)
            <input
              className={formInputClassName}
              disabled={isPending}
              onChange={(e) => setCheckInInput(e.target.value)}
              required
              type="datetime-local"
              value={checkInInput}
            />
            {fieldErrors.checkInAt?.[0] ? (
              <span className="text-xs font-normal text-danger">{fieldErrors.checkInAt[0]}</span>
            ) : null}
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Giờ ra (Check-out)
            <input
              className={formInputClassName}
              disabled={isPending}
              onChange={(e) => setCheckOutInput(e.target.value)}
              required
              type="datetime-local"
              value={checkOutInput}
            />
            {fieldErrors.checkOutAt?.[0] ? (
              <span className="text-xs font-normal text-danger">{fieldErrors.checkOutAt[0]}</span>
            ) : null}
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-ink">
          Lý do điều chỉnh (bắt buộc)
          <textarea
            className="min-h-20 w-full rounded-md border border-hairline bg-white p-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-slate-100"
            disabled={isPending}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Nhân sự quên check-out, bổ sung theo xác nhận của Quản lý ca..."
            required
            rows={3}
            value={reason}
          />
          {fieldErrors.reason?.[0] ? (
            <span className="text-xs font-normal text-danger">{fieldErrors.reason[0]}</span>
          ) : null}
        </label>

        <div className="mt-2 flex items-center justify-end gap-2.5 border-t border-hairline pt-4">
          <Button
            disabled={isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button
            disabled={isPending}
            isLoading={isPending}
            type="submit"
          >
            {isPending ? "Đang lưu…" : "Lưu điều chỉnh"}
          </Button>
        </div>
      </form>
    </>
  );
}
