"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { recordTrialResultAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

type TrialResult = "attended" | "no_show" | "cancelled";

const fieldClassName =
  "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";
const textareaClassName =
  "min-h-24 rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

/** Records attended / no-show / cancelled for a scheduled trial booking. */
export function CrmTrialResultDialog({
  action = recordTrialResultAction,
  bookingId,
  crmCaseId,
  trialDateLabel,
}: {
  action?: CrmActionOverrides["recordTrialResult"];
  bookingId: string;
  crmCaseId: string;
  trialDateLabel: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<TrialResult>("attended");
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [state, setState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    if (!isPending) setIsOpen(false);
  };

  const submit = () => {
    if (isPending) return;
    setState(null);
    startTransition(async () => {
      const outcome = await action({ bookingId, crmCaseId, result, saleNotes, teacherFeedback });
      setState(outcome);
      if (outcome.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => { setState(null); setIsOpen(true); }} ref={triggerRef} size="sm" variant="secondary">
        Ghi kết quả
      </Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-md" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>Kết quả học thử {trialDateLabel}</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Đến học thử sẽ chuyển lead sang “Đã học thử”. Vắng hoặc hủy mà không còn lịch thử nào khác sẽ trả lead về “Đang quan tâm” để đặt lại.
            </p>
          </div>
          {state?.status === "error" ? <ResultBanner title={state.message} tone="error" /> : null}
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-muted" htmlFor={`${titleId}-result`}>Kết quả</label>
              <select className={fieldClassName} disabled={isPending} id={`${titleId}-result`} onChange={(event) => setResult(event.target.value as TrialResult)} value={result}>
                <option value="attended">Đã đến học thử</option>
                <option value="no_show">Vắng, không báo</option>
                <option value="cancelled">Hủy lịch</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-muted" htmlFor={`${titleId}-feedback`}>Nhận xét của giáo viên</label>
              <textarea className={textareaClassName} disabled={isPending} id={`${titleId}-feedback`} maxLength={2000} onChange={(event) => setTeacherFeedback(event.target.value)} placeholder="Trình độ, thái độ học, lớp phù hợp…" value={teacherFeedback} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-label font-medium text-text-muted" htmlFor={`${titleId}-notes`}>Ghi chú của sale</label>
              <textarea className={textareaClassName} disabled={isPending} id={`${titleId}-notes`} maxLength={2000} onChange={(event) => setSaleNotes(event.target.value)} placeholder="Phản hồi của phụ huynh sau buổi thử…" value={saleNotes} />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={close} variant="outline">Hủy</Button>
            <Button disabled={isPending} onClick={submit}>{isPending ? "Đang lưu…" : "Lưu kết quả"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
