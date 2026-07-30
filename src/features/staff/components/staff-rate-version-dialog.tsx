"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createStaffRateVersionAction } from "@/features/staff/staff-actions";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";

interface StaffRateVersionDialogProps {
  staffId: string;
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-canvas";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

export function StaffRateVersionDialog({
  staffId,
}: StaffRateVersionDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [offlineHourlyRateVnd, setOfflineHourlyRateVnd] = useState(0);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<StaffManagementActionState>(
    initialStaffManagementActionState,
  );
  const [isPending, startTransition] = useTransition();

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setActionState(initialStaffManagementActionState);
  };

  const openDialog = (): void => {
    setEffectiveFrom("");
    setOfflineHourlyRateVnd(0);
    setNote("");
    setReason("");
    setActionState(initialStaffManagementActionState);
    setIsOpen(true);
  };

  const handleSubmit = (): void => {
    startTransition(async () => {
      const result = await createStaffRateVersionAction({
        effectiveFrom,
        note,
        offlineHourlyRateVnd,
        reason,
        staffId,
      });

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={openDialog} type="button" variant="secondary">
        Thêm phiên bản đơn giá
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-6 w-full max-w-lg rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <h2 className="text-lg font-bold text-ink">Thêm phiên bản đơn giá</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Mức online được database tính tự động bằng 50% mức offline và version này không thể chỉnh sửa sau khi lưu.
            </p>

            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Hiệu lực từ</span>
                <input
                  className={inputClassName}
                  disabled={isPending}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                  type="date"
                  value={effectiveFrom}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Đơn giá offline / giờ (VND)</span>
                <input
                  className={inputClassName}
                  disabled={isPending}
                  min={0}
                  onChange={(event) => setOfflineHourlyRateVnd(Number(event.target.value))}
                  required
                  step={2}
                  type="number"
                  value={offlineHourlyRateVnd}
                />
              </label>
              <p className="rounded-md bg-info-bg px-3 py-2 text-sm text-info">
                Online / giờ: {moneyFormatter.format(offlineHourlyRateVnd / 2)}
              </p>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Ghi chú</span>
                <textarea
                  className={`${inputClassName} min-h-20 resize-y py-3`}
                  disabled={isPending}
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>Lý do thêm phiên bản</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
              </label>

              {actionState.status !== "idle" ? (
                <p
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    actionState.status === "success"
                      ? "bg-success-bg text-success"
                      : "bg-danger-bg text-danger"
                  }`}
                  role="status"
                >
                  {actionState.message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button disabled={isPending} onClick={closeDialog} type="button" variant="ghost">
                  Hủy
                </Button>
                <Button disabled={isPending} type="submit">
                  {isPending ? "Đang lưu..." : "Thêm phiên bản"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
