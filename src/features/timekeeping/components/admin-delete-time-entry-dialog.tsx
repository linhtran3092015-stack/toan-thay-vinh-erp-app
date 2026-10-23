"use client";

import { useState, useTransition, type FormEvent, type RefObject } from "react";
import { Trash2, X } from "lucide-react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { adminDeleteTimeEntryAction } from "@/features/timekeeping/timekeeping-admin-actions";
import {
  type AdminTimekeepingActionState,
  initialAdminTimekeepingActionState,
} from "@/features/timekeeping/timekeeping-admin-action-types";
import {
  formatVietnamDate,
  getEffectiveEntryTimes,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import { formatVietnamClockTime } from "@/features/timekeeping/timekeeping-staff-presentation";
import type { TimekeepingMonthlyEntry } from "@/features/timekeeping/types";

interface AdminDeleteTimeEntryDialogProps {
  entry: TimekeepingMonthlyEntry;
  onClose: () => void;
  onSuccess?: () => void;
  /** The row's Xóa button disappears after a delete, so focus needs a stable home. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  staffDisplayName?: string;
}

/** Mounted by its parent per selected entry, so form state always starts fresh. */
export function AdminDeleteTimeEntryDialog({
  entry,
  onClose,
  onSuccess,
  fallbackFocusRef,
  staffDisplayName,
}: AdminDeleteTimeEntryDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState<string>("");
  const [actionState, setActionState] = useState<AdminTimekeepingActionState>(
    initialAdminTimekeepingActionState,
  );
  const isDone = actionState.status === "success";
  const isLocked = isPending || isDone;

  // Escape and the scrim must not drop a delete mid-request: its result has to be seen.
  const close = () => {
    if (isPending) return;
    onClose();
  };

  const { checkInAt: shownCheckIn, checkOutAt: shownCheckOut } = getEffectiveEntryTimes(entry);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) return;

    if (!reason.trim()) {
      setActionState({
        fieldErrors: { reason: ["Vui lòng nhập lý do xóa."] },
        message: "Vui lòng nhập lý do xóa lượt chấm công.",
        status: "error",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await adminDeleteTimeEntryAction({
          reason: reason.trim(),
          timeEntryId: entry.id,
        });

        setActionState(result);
        if (result.status === "success") {
          onSuccess?.();
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } catch {
        setActionState({ status: "error", message: "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại." });
      }
    });
  };

  const fieldErrors = actionState.fieldErrors ?? {};

  return (
    <Dialog
      ariaDescribedBy="admin-delete-time-entry-desc"
      ariaLabelledBy="admin-delete-time-entry-title"
      className="max-w-lg p-6"
      isOpen
      fallbackFocusRef={fallbackFocusRef}
      onClose={close}
    >
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <Trash2 size={18} />
          </div>
          <div>
            <h3
              className="font-display text-lg font-bold text-ink"
              id="admin-delete-time-entry-title"
            >
              Xóa lượt chấm công
            </h3>
            {staffDisplayName ? (
              <p className="text-xs text-ink-muted">Nhân sự: {staffDisplayName}</p>
            ) : null}
          </div>
        </div>
        <button
          aria-label="Đóng hộp thoại"
          className="rounded-lg p-1 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
          disabled={isPending}
          onClick={close}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        {actionState.status !== "idle" ? (
          <ResultBanner
            description={actionState.message}
            title={isDone ? "Đã xóa" : "Không thể xóa"}
            tone={isDone ? "success" : "error"}
          />
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-hairline bg-surface-2 px-4 py-3 text-sm">
          <dt className="text-ink-muted">Ngày</dt>
          <dd className="font-semibold text-ink">{formatVietnamDate(entry.workDate)}</dd>
          <dt className="text-ink-muted">Ca làm</dt>
          <dd className="text-ink">{entry.workShiftName ?? "Ngoài ca"}</dd>
          <dt className="text-ink-muted">Giờ</dt>
          <dd className="font-mono text-ink">
            {formatVietnamClockTime(shownCheckIn)} → {shownCheckOut ? formatVietnamClockTime(shownCheckOut) : "—"}
          </dd>
          <dt className="text-ink-muted">Hình thức</dt>
          <dd className="text-ink">{getTimeEntryModeLabel(entry.checkInMode)}</dd>
        </dl>

        <div className="grid gap-1 text-sm text-ink" id="admin-delete-time-entry-desc">
          <p className="font-semibold text-danger">Thao tác này không thể hoàn tác.</p>
          <p>
            Lượt chấm công này, các lần điều chỉnh và bằng chứng chấm công đi kèm sẽ bị xóa khỏi bảng công
            và bảng lương tạm tính; nhật ký hệ thống chỉ giữ lại bản ghi để tra cứu.
            {entry.adjustmentStatus === "pending"
              ? " Yêu cầu điều chỉnh đang chờ duyệt của nhân sự cho ca này cũng bị xóa."
              : ""}
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-ink">
          Lý do xóa (bắt buộc)
          <textarea
            className="min-h-20 w-full rounded-md border border-hairline bg-white p-3 text-sm font-normal text-ink outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring/20 disabled:bg-slate-100"
            disabled={isLocked}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Chấm trùng ca, nhân sự chấm nhầm ngày..."
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
            onClick={close}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button
            disabled={isLocked}
            isLoading={isPending}
            type="submit"
            variant="danger-solid"
          >
            {isPending ? "Đang xóa…" : "Xóa lượt chấm công"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
