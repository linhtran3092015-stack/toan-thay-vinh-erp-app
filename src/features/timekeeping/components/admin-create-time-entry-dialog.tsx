"use client";

import { useState, useTransition, type FormEvent } from "react";
import { PlusCircle, X } from "lucide-react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  adminCreateTimeEntryAction,
} from "@/features/timekeeping/timekeeping-admin-actions";
import {
  type AdminTimekeepingActionState,
  initialAdminTimekeepingActionState,
} from "@/features/timekeeping/timekeeping-admin-action-types";
import { vietnamDatetimeInputToIso } from "@/features/timekeeping/timekeeping-adjustment-utils";
import { getVietnamBusinessDate } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingStaffOption } from "@/features/timekeeping/types";

const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring/20 disabled:cursor-not-allowed disabled:bg-slate-100";

interface AdminCreateTimeEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedStaffId?: string;
  staffOptions: readonly TimekeepingStaffOption[];
}

export function AdminCreateTimeEntryDialog({
  isOpen,
  onClose,
  onSuccess,
  preselectedStaffId,
  staffOptions,
}: AdminCreateTimeEntryDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      ariaDescribedBy="admin-create-time-entry-desc"
      ariaLabelledBy="admin-create-time-entry-title"
      className="max-w-lg p-6"
      isOpen={isOpen}
      onClose={onClose}
    >
      <AdminCreateTimeEntryForm
        key={preselectedStaffId ?? "new"}
        onClose={onClose}
        onSuccess={onSuccess}
        preselectedStaffId={preselectedStaffId}
        staffOptions={staffOptions}
      />
    </Dialog>
  );
}

function AdminCreateTimeEntryForm({
  onClose,
  onSuccess,
  preselectedStaffId,
  staffOptions,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  preselectedStaffId?: string;
  staffOptions: readonly TimekeepingStaffOption[];
}) {
  const todayDate = getVietnamBusinessDate();

  const [isPending, startTransition] = useTransition();
  const [staffId, setStaffId] = useState<string>(
    () => preselectedStaffId || staffOptions[0]?.id || "",
  );
  const [workDate, setWorkDate] = useState<string>(() => todayDate);
  const [checkInInput, setCheckInInput] = useState<string>(() => `${todayDate}T08:00`);
  const [checkOutInput, setCheckOutInput] = useState<string>(() => `${todayDate}T17:00`);
  const [mode, setMode] = useState<"offline" | "online">("offline");
  const [notes, setNotes] = useState<string>("Chủ trung tâm bổ sung công bù");
  const [actionState, setActionState] = useState<AdminTimekeepingActionState>(
    initialAdminTimekeepingActionState,
  );

  const handleDateChange = (newDate: string) => {
    setWorkDate(newDate);
    const inTime = checkInInput.split("T")[1] || "08:00";
    const outTime = checkOutInput.split("T")[1] || "17:00";
    setCheckInInput(`${newDate}T${inTime}`);
    setCheckOutInput(`${newDate}T${outTime}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    if (!staffId) {
      setActionState({
        fieldErrors: { staffId: ["Vui lòng chọn nhân sự."] },
        message: "Vui lòng chọn nhân sự cần thêm công.",
        status: "error",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await adminCreateTimeEntryAction({
          checkInAt: vietnamDatetimeInputToIso(checkInInput),
          checkOutAt: vietnamDatetimeInputToIso(checkOutInput),
          mode,
          notes: notes.trim(),
          staffId,
          workDate,
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
      } catch {
        setActionState({ status: "error", message: "Không thể kết nối tới hệ thống chấm công. Vui lòng thử lại." });
      }
    });
  };

  const fieldErrors = actionState.fieldErrors ?? {};

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <PlusCircle size={18} />
          </div>
          <div>
            <h3
              className="font-display text-lg font-bold text-ink"
              id="admin-create-time-entry-title"
            >
              Bổ sung công bù cho nhân sự
            </h3>
            <p className="text-xs text-ink-muted" id="admin-create-time-entry-desc">
              Tạo mới lượt chấm công đã hoàn tất cho nhân sự quên chấm công hoặc công phát sinh.
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
                : "Không thể thêm công"
            }
            tone={actionState.status === "success" ? "success" : "error"}
          />
        ) : null}

        {/* Chọn nhân sự */}
        <label className="grid gap-1.5 text-xs font-semibold text-ink">
          Nhân sự
          <select
            className={formInputClassName}
            disabled={isPending || Boolean(preselectedStaffId)}
            onChange={(e) => setStaffId(e.target.value)}
            required
            value={staffId}
          >
            <option value="">-- Chọn nhân sự --</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.displayName ?? "Chưa đặt tên"} {staff.employeeCode ? `(${staff.employeeCode})` : ""}
              </option>
            ))}
          </select>
          {fieldErrors.staffId?.[0] ? (
            <span className="text-xs font-normal text-danger">{fieldErrors.staffId[0]}</span>
          ) : null}
        </label>

        {/* Ngày làm việc & Hình thức */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Ngày làm việc
            <input
              className={formInputClassName}
              disabled={isPending}
              onChange={(e) => handleDateChange(e.target.value)}
              required
              type="date"
              value={workDate}
            />
            {fieldErrors.workDate?.[0] ? (
              <span className="text-xs font-normal text-danger">{fieldErrors.workDate[0]}</span>
            ) : null}
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Hình thức làm việc
            <select
              className={formInputClassName}
              disabled={isPending}
              onChange={(e) => setMode(e.target.value as "offline" | "online")}
              value={mode}
            >
              <option value="offline">Tại trung tâm</option>
              <option value="online">Trực tuyến</option>
            </select>
          </label>
        </div>

        {/* Giờ vào & Giờ ra */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Giờ vào
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
            Giờ ra
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
          Ghi chú / Lý do bổ sung
          <textarea
            className="min-h-18 w-full rounded-md border border-hairline bg-white p-3 text-sm font-normal text-ink outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring/20 disabled:bg-slate-100"
            disabled={isPending}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ví dụ: Công bù buổi họp phụ huynh, trực ca ngoài lịch..."
            rows={2}
            value={notes}
          />
          {fieldErrors.notes?.[0] ? (
            <span className="text-xs font-normal text-danger">{fieldErrors.notes[0]}</span>
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
            {isPending ? "Đang tạo…" : "Thêm lượt công"}
          </Button>
        </div>
      </form>
    </>
  );
}
