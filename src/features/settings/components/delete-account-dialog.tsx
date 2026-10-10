"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  initialSettingsActionState,
  type SettingsActionState,
} from "@/features/settings/action-types";
import { deleteAccountAction } from "@/features/settings/actions";
import type { StaffDirectoryMember } from "@/features/staff/types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function DeleteAccountDialog({ member }: { member: StaffDirectoryMember }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonErrorId = `${reasonId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<SettingsActionState>(
    initialSettingsActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const reasonError = actionState.status === "error"
    ? actionState.fieldErrors?.reason?.[0]
    : undefined;

  const openDialog = (): void => {
    setReason("");
    setActionState(initialSettingsActionState);
    setIsOpen(true);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) return;
    setIsOpen(false);
    setActionState(initialSettingsActionState);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isInteractionLocked) return;

    setActionState(initialSettingsActionState);
    startTransition(async () => {
      const result = await deleteAccountAction({ reason, userId: member.id });
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
        className="min-h-11"
        onClick={openDialog}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="danger"
      >
        Xóa tài khoản
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        initialFocusRef={reasonRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <form className="p-4 sm:p-5" onSubmit={handleSubmit}>
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Xóa tài khoản {member.displayName}
          </h2>
          <p className="mt-2 text-secondary text-text-muted" id={descriptionId}>
            {member.email}
          </p>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-secondary text-text-default">
            <li>Thu hồi toàn bộ vai trò và lời mời đang chờ; người này không đăng nhập được nữa.</li>
            <li>Chuyển trạng thái sang &ldquo;Đã nghỉ&rdquo; và ẩn khỏi danh sách nhân sự, phân ca, bảng lương.</li>
            <li>
              Lịch sử chấm công, lương, điểm danh được giữ nguyên để đối soát. Nếu tài khoản chưa
              phát sinh dữ liệu nào, hệ thống xóa hẳn.
            </li>
          </ul>

          <div className="mt-4">
            <label className="text-label font-medium text-text-strong" htmlFor={reasonId}>
              Lý do xóa
            </label>
            <textarea
              aria-describedby={reasonError ? reasonErrorId : undefined}
              aria-invalid={reasonError ? true : undefined}
              className={`${inputClassName} mt-1 min-h-24 py-2`}
              disabled={isInteractionLocked}
              id={reasonId}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: Nghỉ việc từ 15/10, đã bàn giao lớp."
              ref={reasonRef}
              required
              value={reason}
            />
            {reasonError ? (
              <p className="mt-1 text-caption text-danger" id={reasonErrorId} role="alert">
                {reasonError}
              </p>
            ) : null}
          </div>

          {actionState.status === "error" ? (
            <div className="mt-4">
              <ResultBanner message={actionState.message} status="error" />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="min-h-11"
              disabled={isInteractionLocked}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              className="min-h-11"
              isLoading={isInteractionLocked}
              type="submit"
              variant="danger"
            >
              Xác nhận xóa tài khoản
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
