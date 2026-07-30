"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  CreateStaffShiftAssignmentActionInput,
  TimekeepingManagementActionState,
} from "@/features/timekeeping/timekeeping-action-types";
import { initialTimekeepingManagementActionState } from "@/features/timekeeping/timekeeping-action-types";
import { createStaffShiftAssignmentAction } from "@/features/timekeeping/timekeeping-actions";
import {
  formInputClassName,
  getVietnamBusinessDate,
  WEEKDAY_OPTIONS,
} from "@/features/timekeeping/timekeeping-client-utils";
import type {
  TimekeepingStaffOption,
  TimekeepingWorkShift,
} from "@/features/timekeeping/types";

interface StaffShiftAssignmentDialogProps {
  staffOptions: readonly TimekeepingStaffOption[];
  workShifts: readonly TimekeepingWorkShift[];
}

function getStaffLabel(staff: TimekeepingStaffOption): string {
  return staff.displayName?.trim() || staff.employeeCode || "Nhân sự chưa đặt tên";
}

function createInitialValues(
  staffOptions: readonly TimekeepingStaffOption[],
  workShifts: readonly TimekeepingWorkShift[],
): CreateStaffShiftAssignmentActionInput {
  return {
    effectiveFrom: getVietnamBusinessDate(),
    reason: "",
    staffId: staffOptions[0]?.id ?? "",
    weekday: 1,
    workShiftId: workShifts[0]?.id ?? "",
  };
}

export function StaffShiftAssignmentDialog({
  staffOptions,
  workShifts,
}: StaffShiftAssignmentDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<CreateStaffShiftAssignmentActionInput>(
    () => createInitialValues(staffOptions, workShifts),
  );
  const [actionState, setActionState] = useState<TimekeepingManagementActionState>(
    initialTimekeepingManagementActionState,
  );

  const hasOptions = staffOptions.length > 0 && workShifts.length > 0;

  const openDialog = (): void => {
    setValues(createInitialValues(staffOptions, workShifts));
    setActionState(initialTimekeepingManagementActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const updateValue = <Key extends keyof CreateStaffShiftAssignmentActionInput>(
    key: Key,
    value: CreateStaffShiftAssignmentActionInput[Key],
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    startTransition(async () => {
      const result = await createStaffShiftAssignmentAction(values);
      setActionState(result);

      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button disabled={!hasOptions} onClick={openDialog} size="lg" type="button" variant="outline">
        Phân công lịch
      </Button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="my-auto grid w-full max-w-xl gap-5 rounded-lg border border-hairline bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-lg font-semibold text-ink">Phân công lịch làm việc</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Mỗi nhân sự chỉ có một lịch đang hiệu lực cho mỗi thứ trong tuần.
              </p>
            </div>

            <div className="grid gap-4">
              <FormField error={actionState.fieldErrors?.staffId?.[0]} label="Nhân sự">
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => updateValue("staffId", event.target.value)}
                  required
                  value={values.staffId}
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {getStaffLabel(staff)}{staff.employeeCode ? ` (${staff.employeeCode})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField error={actionState.fieldErrors?.weekday?.[0]} label="Thứ trong tuần">
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => updateValue("weekday", Number(event.target.value))}
                  value={values.weekday}
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField error={actionState.fieldErrors?.workShiftId?.[0]} label="Ca làm">
                <select
                  className={formInputClassName}
                  disabled={isPending}
                  onChange={(event) => updateValue("workShiftId", event.target.value)}
                  required
                  value={values.workShiftId}
                >
                  {workShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.code} - {shift.name} ({shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField error={actionState.fieldErrors?.effectiveFrom?.[0]} label="Ngày bắt đầu hiệu lực">
                <input className={formInputClassName} disabled type="date" value={values.effectiveFrom} />
              </FormField>

              <FormField error={actionState.fieldErrors?.reason?.[0]} label="Lý do phân công">
                <textarea
                  autoFocus
                  className={`${formInputClassName} min-h-28 resize-y py-3`}
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => updateValue("reason", event.target.value)}
                  placeholder="Nhập lý do phân công lịch"
                  required
                  value={values.reason}
                />
              </FormField>
            </div>

            <ActionMessage actionState={actionState} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button disabled={isPending} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Đang phân công..." : "Xác nhận phân công"}
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
