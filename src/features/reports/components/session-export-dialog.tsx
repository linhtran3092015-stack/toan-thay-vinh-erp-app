"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { SESSION_EXPORT_LIMIT } from "@/features/reports/catalog";
import { formatNumber } from "@/lib/format";

/** The route answers an inverted range with a raw JSON 400 page, so it is caught here first. */
const INVERTED_RANGE = "Đến ngày phải bằng hoặc sau Từ ngày.";

interface SessionExportDialogProps {
  /**
   * GET target of the form. The route rejects every query key except `dateFrom`
   * and `dateTo` (each at most once), so the form holds those two fields only:
   * no hidden input and no `name` on the submit button.
   */
  exportHref: string;
  /**
   * /dev preview only: after the client check the form never submits (the
   * preview must not reach the production-backed export) and this sentence is
   * announced in the dialog instead. The real page passes nothing.
   */
  previewNotice?: string;
  /** The card's title, so several "Xuất CSV" triggers keep distinct names. */
  reportTitle: string;
}

/**
 * "Xuất CSV" for the session catalog card: a secondary trigger opening a dialog
 * with an optional date range. A valid submit is the browser's own GET (the
 * route answers with an attachment, so the page stays); the dialog closes once
 * the submission has been planned. The only error is the field's own described
 * line; there is no alert.
 */
export function SessionExportDialog({ exportHref, previewNotice, reportTitle }: SessionExportDialogProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dateFromId = useId();
  const dateToId = useId();
  const dateToErrorId = `${dateToId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const limit = formatNumber(SESSION_EXPORT_LIMIT);

  const open = (): void => {
    setDateFrom("");
    setDateTo("");
    setFieldError(null);
    setNotice(null);
    setIsOpen(true);
  };

  const close = (): void => setIsOpen(false);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    setNotice(null);
    // `type="date"` yields "" or YYYY-MM-DD, so string order is calendar order.
    if (dateFrom && dateTo && dateFrom > dateTo) {
      event.preventDefault();
      setFieldError(INVERTED_RANGE);
      dateToRef.current?.focus();
      return;
    }
    setFieldError(null);
    if (previewNotice) {
      event.preventDefault();
      setNotice(previewNotice);
      return;
    }
    // Let the browser submit, and close only in a later task: removing the form
    // during its own submit event would cancel the submission.
    window.setTimeout(close, 0);
  };

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={`Xuất CSV: ${reportTitle}`}
        className="max-md:h-11"
        onClick={open}
        ref={triggerRef}
        type="button"
        variant="secondary"
      >
        Xuất CSV
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-md"
        initialFocusRef={dateFromRef}
        isOpen={isOpen}
        onClose={close}
        returnFocusRef={triggerRef}
      >
        {/* noValidate: the range rule is checked in submit so its message stays the field's own line. */}
        <form action={exportHref} method="get" noValidate onSubmit={submit}>
          <div className="grid gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
            <div>
              <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
                Xuất danh sách buổi học
              </h2>
              <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
                {`Tối đa ${limit} buổi có ngày mới nhất trong khoảng đã chọn. Để trống cả hai ngày: ${limit} buổi mới nhất, có thể gồm buổi đã lên lịch.`}
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5">
                <Label htmlFor={dateFromId}>Từ ngày</Label>
                <Input
                  id={dateFromId}
                  max={dateTo || undefined}
                  name="dateFrom"
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setFieldError(null);
                  }}
                  ref={dateFromRef}
                  type="date"
                  value={dateFrom}
                />
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor={dateToId}>Đến ngày</Label>
                <Input
                  aria-describedby={fieldError ? dateToErrorId : undefined}
                  aria-invalid={fieldError ? true : undefined}
                  id={dateToId}
                  min={dateFrom || undefined}
                  name="dateTo"
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setFieldError(null);
                  }}
                  ref={dateToRef}
                  type="date"
                  value={dateTo}
                />
                {fieldError ? (
                  <p className="text-caption font-medium text-danger" id={dateToErrorId}>
                    {fieldError}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="text-caption text-text-muted">File CSV UTF-8, mở được bằng Excel.</p>

            {/* Present from the first render so the preview notice is announced when it appears. */}
            <p aria-live="polite" className="text-secondary font-medium text-text-strong empty:hidden" role="status">
              {notice}
            </p>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border-subtle px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <Button className="max-md:h-11" onClick={close} type="button" variant="secondary">
              Đóng
            </Button>
            {/* No `name`: a named submit would add a query key and the route would answer 400. */}
            <Button className="max-md:h-11" type="submit">
              Tải CSV
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
