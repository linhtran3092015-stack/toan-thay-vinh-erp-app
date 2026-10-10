"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { StaffGradeAssignment } from "@/features/staff/payroll-profile-types";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";
import { endStaffGradeAssignmentAction } from "@/features/staff/staff-actions";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

function getVietnamToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function StaffGradeAssignmentEndDialog({
  assignment,
  staffId,
}: {
  assignment: StaffGradeAssignment;
  staffId: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dateId = useId();
  const reasonId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<StaffManagementActionState>(initialStaffManagementActionState);
  const [isPending, startTransition] = useTransition();
  const locked = isPending && state.status !== "error";
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const open = (): void => {
    setEffectiveTo(getVietnamToday());
    setReason("");
    setState(initialStaffManagementActionState);
    setIsOpen(true);
  };

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(initialStaffManagementActionState);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (locked) return;
    setState(initialStaffManagementActionState);
    startTransition(async () => {
      const result = await endStaffGradeAssignmentAction({
        assignmentId: assignment.id,
        effectiveTo,
        reason,
        staffId,
      });
      setState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        aria-label={`Thu hồi khối ${assignment.grade}`}
        className="ml-1 h-7 px-2"
        onClick={open}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="ghost"
      >
        Thu hồi
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-md"
        initialFocusRef={dateRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        <form className="p-4 sm:p-5" onSubmit={submit}>
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Thu hồi khối {assignment.grade}
          </h2>
          <p className="mt-2 text-secondary text-text-muted" id={descriptionId}>
            Nhân sự này ngừng phụ trách khối {assignment.grade} sau ngày kết thúc; doanh thu gia hạn của khối từ ngày
            kế tiếp không còn tính cho họ. Lịch sử phân công được giữ nguyên. Không chọn ngày trong tháng lương đã chốt.
          </p>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-label font-medium text-text-strong" htmlFor={dateId}>
                Ngày kết thúc phụ trách
              </label>
              <input
                aria-invalid={fieldErrors?.effectiveTo ? true : undefined}
                className={`${inputClassName} mt-1`}
                disabled={locked}
                id={dateId}
                min={assignment.effectiveFrom}
                onChange={(event) => setEffectiveTo(event.target.value)}
                ref={dateRef}
                required
                type="date"
                value={effectiveTo}
              />
              {fieldErrors?.effectiveTo?.[0] ? (
                <p className="mt-1 text-caption text-danger" role="alert">{fieldErrors.effectiveTo[0]}</p>
              ) : null}
            </div>

            <div>
              <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
                Lý do thu hồi
              </label>
              <textarea
                aria-invalid={fieldErrors?.reason ? true : undefined}
                className={`${inputClassName} mt-1 min-h-20 py-2`}
                disabled={locked}
                id={reasonId}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Chuyển khối 5 sang trợ lý mới từ tháng 11."
                required
                value={reason}
              />
              {fieldErrors?.reason?.[0] ? (
                <p className="mt-1 text-caption text-danger" role="alert">{fieldErrors.reason[0]}</p>
              ) : null}
            </div>
          </div>

          {state.status === "error" ? (
            <div className="mt-4">
              <ResultBanner title={state.message} tone="error" />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" disabled={locked} onClick={close} type="button" variant="outline">
              Hủy
            </Button>
            <Button className="min-h-11" isLoading={locked} type="submit" variant="danger">
              Xác nhận thu hồi
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
