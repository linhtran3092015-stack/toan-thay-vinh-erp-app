"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { changeCaseStatusAction } from "@/features/crm/actions/crm-actions";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

type TargetStatus = "pending_enrollment_confirmation" | "dropped" | "interested";

const copy: Record<TargetStatus, { button: string; confirm: string; description: string; placeholder: string; title: string; variant: "danger" | "primary" | "secondary" }> = {
  dropped: {
    button: "Dừng lead",
    confirm: "Xác nhận dừng",
    description: "Lead dừng theo dõi và không còn hiện trong hàng việc của sale. Lịch học thử đang chờ sẽ được hủy. Có thể mở lại khi phụ huynh liên hệ.",
    placeholder: "Ví dụ: Phụ huynh chọn trung tâm khác / không liên hệ được sau 3 lần gọi.",
    title: "Dừng theo dõi lead",
    variant: "danger",
  },
  interested: {
    button: "Mở lại lead",
    confirm: "Mở lại",
    description: "Lead quay về trạng thái Đang quan tâm để tiếp tục tư vấn.",
    placeholder: "Ví dụ: Phụ huynh liên hệ lại muốn đăng ký khóa hè.",
    title: "Mở lại lead",
    variant: "secondary",
  },
  pending_enrollment_confirmation: {
    button: "Chuyển chờ xác nhận nhập học",
    confirm: "Xác nhận",
    description: "Hệ thống tạo hồ sơ học sinh tạm (gắn phụ huynh) để kế toán lập phiếu thu tuyển mới ngay. Chuyển đổi chính thức vẫn đi qua checklist 10 bước.",
    placeholder: "Ghi chú (không bắt buộc), ví dụ: phụ huynh đồng ý học lớp 6A từ tháng 11.",
    title: "Chờ xác nhận nhập học",
    variant: "primary",
  },
};

const textareaClassName =
  "min-h-24 rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function CrmCaseStatusDialog({
  action = changeCaseStatusAction,
  crmCaseId,
  targetStatus,
  triggerLabel,
  triggerSize = "sm",
  triggerVariant,
}: {
  action?: CrmActionOverrides["changeCaseStatus"];
  crmCaseId: string;
  targetStatus: TargetStatus;
  /** Page-specific trigger wording; the dialog copy stays the same. */
  triggerLabel?: string;
  triggerSize?: ButtonSize;
  /** Overrides the default trigger style (primary / danger / outline by target). */
  triggerVariant?: ButtonVariant;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const text = copy[targetStatus];
  const requiresReason = targetStatus !== "pending_enrollment_confirmation";
  const reasonError = state?.status === "error" ? state.fieldErrors?.reason?.[0] : undefined;

  const close = () => {
    if (!isPending) setIsOpen(false);
  };

  const submit = () => {
    if (isPending) return;
    setState(null);
    startTransition(async () => {
      const outcome = await action({ crmCaseId, reason, targetStatus });
      setState(outcome);
      if (outcome.status === "success") {
        setIsOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => { setState(null); setIsOpen(true); }} ref={triggerRef} size={triggerSize} variant={triggerVariant ?? (text.variant === "primary" ? "primary" : text.variant === "danger" ? "danger" : "outline")}>
        {triggerLabel ?? text.button}
      </Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-md" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>{text.title}</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>{text.description}</p>
          </div>
          {state?.status === "error" ? <ResultBanner title={state.message} tone="error" /> : null}
          <div className="grid gap-1.5">
            <label className="text-label font-medium text-text-muted" htmlFor={`${titleId}-reason`}>
              {requiresReason ? "Lý do" : "Ghi chú"} {requiresReason ? <span aria-hidden="true" className="text-danger">*</span> : null}
            </label>
            <textarea
              aria-invalid={Boolean(reasonError)}
              className={textareaClassName}
              disabled={isPending}
              id={`${titleId}-reason`}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder={text.placeholder}
              value={reason}
            />
            {reasonError ? <p className="text-caption text-danger">{reasonError}</p> : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={close} variant="outline">Hủy</Button>
            <Button disabled={isPending || (requiresReason && reason.trim().length < 3)} onClick={submit} variant={text.variant === "danger" ? "danger" : "primary"}>
              {isPending ? "Đang lưu…" : text.confirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
