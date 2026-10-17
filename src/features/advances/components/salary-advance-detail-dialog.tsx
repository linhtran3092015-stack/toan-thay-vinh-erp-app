"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { buildAdvanceTimeline } from "@/features/advances/advance-directory-models";
import { AdvanceStatusBadge } from "@/features/advances/components/advance-status-badge";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";
import { formatMonth } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AdvanceRowControlSize = "lg" | "sm";

/**
 * Text-style row control ("Xem", "Kỳ lương"): 32px in table rows, 44px in the
 * phone cards. Link colour needs `!` over the global `a { color: inherit }`.
 */
export function getAdvanceRowLinkClassName(size: AdvanceRowControlSize): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 text-secondary font-semibold text-action-link! hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    size === "sm" ? "h-8" : "h-11 min-w-11",
  );
}

/** Read-only view of one request (design 16c "Xem"): facts and the recorded steps, nothing editable. */
export function SalaryAdvanceDetailDialog({
  entry,
  triggerSize = "sm",
}: {
  entry: SalaryAdvanceDashboardEntry;
  triggerSize?: AdvanceRowControlSize;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const timeline = isOpen ? buildAdvanceTimeline(entry) : [];

  return (
    <>
      <button
        aria-label={`Xem chi tiết tạm ứng của ${entry.staffDisplayName}`}
        className={getAdvanceRowLinkClassName(triggerSize)}
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Xem
      </button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-lg"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        returnFocusRef={triggerRef}
      >
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
                Chi tiết tạm ứng
              </h2>
              <AdvanceStatusBadge status={entry.status} />
            </div>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Chỉ xem: yêu cầu tạm ứng không sửa hoặc hủy được sau khi gửi.
            </p>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md bg-surface-sunken p-3 text-secondary">
            <dt className="text-text-muted">Nhân sự</dt>
            <dd className="break-words font-medium text-text-strong">
              {entry.staffDisplayName}
              {entry.staffEmployeeCode ? (
                <span className="font-normal tabular-nums text-text-muted"> · {entry.staffEmployeeCode}</span>
              ) : null}
            </dd>
            <dt className="text-text-muted">Số tiền</dt>
            <dd className="font-semibold tabular-nums text-text-strong">{formatVnd(entry.amountVnd)}</dd>
            <dt className="text-text-muted">Trừ vào kỳ</dt>
            <dd className="tabular-nums text-text-strong">{formatMonth(entry.deductionPeriodMonth)}</dd>
            <dt className="text-text-muted">Lý do</dt>
            <dd className="break-words text-text-strong">{entry.requestNote}</dd>
          </dl>

          <section aria-labelledby={`${titleId}-timeline`} className="grid gap-2">
            <h3 className="text-label font-semibold text-text-strong" id={`${titleId}-timeline`}>
              Diễn biến
            </h3>
            <ol className="grid gap-3">
              {timeline.map((event) => (
                <li className="grid gap-0.5 border-l-2 border-border-subtle pl-3" key={event.key}>
                  <p className="text-secondary font-semibold text-text-strong">{event.label}</p>
                  {event.meta ? (
                    <p className="text-caption tabular-nums text-text-muted">{event.meta}</p>
                  ) : null}
                  {event.note ? (
                    <p className="break-words text-secondary text-text-default">{event.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button className="max-md:h-11" onClick={() => setIsOpen(false)} type="button" variant="secondary">
              Đóng
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
