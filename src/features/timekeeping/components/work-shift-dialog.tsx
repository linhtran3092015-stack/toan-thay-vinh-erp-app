"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  TimekeepingManagementActionState,
  WorkShiftWriteFields,
} from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import {
  createWorkShiftAction,
  updateWorkShiftAction,
} from "@/features/timekeeping/timekeeping-actions";
import { formInputClassName } from "@/features/timekeeping/timekeeping-client-utils";
import type { TimekeepingWorkShift } from "@/features/timekeeping/types";

interface WorkShiftDialogProps {
  workShift?: TimekeepingWorkShift;
}

function createInitialValues(workShift?: TimekeepingWorkShift): WorkShiftWriteFields {
  return {
    breakMinutes: workShift?.breakMinutes ?? 0,
    code: workShift?.code ?? "",
    crossesMidnight: workShift?.crossesMidnight ?? false,
    endTime: workShift?.endTime.slice(0, 5) ?? "17:00",
    name: workShift?.name ?? "",
    notes: workShift?.notes ?? "",
    reason: "",
    startTime: workShift?.startTime.slice(0, 5) ?? "08:00",
  };
}

export function WorkShiftDialog({ workShift }: WorkShiftDialogProps) {
  const router = useRouter();
  const isEditing = Boolean(workShift);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<WorkShiftWriteFields>(() =>
    createInitialValues(workShift),
  );
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(
    initialTimekeepingManagementActionState,
  );

  const openDialog = (): void => {
    setValues(createInitialValues(workShift));
    setActionState(initialTimekeepingManagementActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setActionState(initialTimekeepingManagementActionState);
  };

  const updateValue = <Key extends keyof WorkShiftWriteFields>(
    key: Key,
    value: WorkShiftWriteFields[Key],
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const getFieldError = (field: keyof WorkShiftWriteFields): string | undefined =>
    actionState.fieldErrors?.[field]?.[0];

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    startTransition(async () => {
      const result = workShift
        ? await updateWorkShiftAction({ ...values, workShiftId: workShift.id })
        : await createWorkShiftAction(values);

      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        className={isEditing ? "w-full" : undefined}
        onClick={openDialog}
        size="lg"
        type="button"
        variant={isEditing ? "outline" : "primary"}
      >
        {isEditing ? "Sửa ca" : "Thêm ca làm"}
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-2xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {isEditing ? "Cập nhật ca làm" : "Tạo ca làm"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {isEditing
                  ? "Ca đã có lịch sử phân công sẽ không thể sửa trực tiếp."
                  : "Ca mới sẽ sẵn sàng để phân công sau khi lưu."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField error={getFieldError("code")} label="Mã ca">
                <input
                  autoComplete="off"
                  className={formInputClassName}
                  disabled={isPending}
                  maxLength={64}
                  onChange={(event) =>
                    updateValue("code", event.target.value.toUpperCase())
                  }
                  placeholder="VD: MORNING"
                  required
                  value={values.code}
                />
              </FormField>

              <FormField error={getFieldError("name")} label="Tên ca">
                <input
                  className={formInputClassName}
                  disabled={isPending}
                  maxLength={160}
                  onChange={(event) => updateValue("name", event.target.value)}
                  placeholder="VD: Ca sáng"
                  required
                  value={values.name}
                />
              </FormField>

              <FormField error={getFieldError("startTime")} label="Giờ bắt đầu">
                <input
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => updateValue("startTime", event.target.value)}
                  required
                  type="time"
                  value={values.startTime}
                />
              </FormField>

              <FormField error={getFieldError("endTime")} label="Giờ kết thúc">
                <input
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => updateValue("endTime", event.target.value)}
                  required
                  type="time"
                  value={values.endTime}
                />
              </FormField>

              <FormField
                error={getFieldError("breakMinutes")}
                label="Nghỉ giữa ca (phút)"
              >
                <input
                  className={formInputClassName}
                  disabled={isPending}
                  min={0}
                  onChange={(event) =>
                    updateValue("breakMinutes", Number(event.target.value))
                  }
                  required
                  type="number"
                  value={values.breakMinutes}
                />
              </FormField>

              <label className="flex min-h-11 items-center gap-3 rounded-md border border-hairline px-3 text-sm font-semibold text-ink">
                <input
                  checked={values.crossesMidnight}
                  className="h-4 w-4 accent-primary"
                  disabled={isPending}
                  onChange={(event) =>
                    updateValue("crossesMidnight", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Ca kết thúc vào ngày hôm sau</span>
              </label>
            </div>

            <FormField error={getFieldError("notes")} label="Ghi chú (không bắt buộc)">
              <textarea
                className={`${formInputClassName} min-h-24 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => updateValue("notes", event.target.value)}
                value={values.notes}
              />
            </FormField>

            <FormField error={getFieldError("reason")} label="Lý do thao tác">
              <textarea
                autoFocus
                className={`${formInputClassName} min-h-24 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) => updateValue("reason", event.target.value)}
                placeholder={isEditing ? "Nhập lý do cập nhật ca" : "Nhập lý do tạo ca"}
                required
                value={values.reason}
              />
            </FormField>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang lưu..." : isEditing ? "Lưu ca làm" : "Tạo ca làm"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function FormField({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function ActionMessage({
  actionState,
}: {
  actionState: TimekeepingManagementActionState;
}) {
  if (!actionState.message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={
        actionState.status === "error"
          ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
      }
    >
      {actionState.message}
    </div>
  );
}
