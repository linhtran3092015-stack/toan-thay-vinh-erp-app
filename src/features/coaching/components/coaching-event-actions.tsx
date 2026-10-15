"use client";

import { useRouter } from "next/navigation";
import {
  cloneElement,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  addCoachingNoteAction,
  advanceCoachingStatusAction,
} from "@/features/coaching/actions/coaching-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { COACHING_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import {
  initialCoachingManagementActionState,
  type CoachingManagementActionState,
} from "@/features/coaching/forms/coaching-action-types";

interface CoachingEventActionsProps {
  /** Inert stubs in the /dev preview; the real page passes nothing. */
  actions?: Pick<CoachingActionOverrides, "addCoachingNote" | "advanceCoachingStatus">;
  coachingRecordId: string;
  currentStatus: string;
}

type DialogMode = "close" | "note" | "start";

const textAreaClassName =
  "min-h-28 w-full resize-y rounded-md border border-border-strong bg-surface-base px-3 py-3 text-body text-text-strong outline-hidden transition-colors hover:border-border-strong-hover focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-focus-ring aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

/**
 * Header actions of the Coaching record (design 13c). One primary per state:
 * "Bắt đầu xử lý" while open, "Đóng phiếu" while in progress (closing is
 * where the outcome is recorded, the design's "Ghi kết quả"), and the
 * secondary "Thêm ghi chú". Any other status (closed or unknown) renders
 * nothing. A call that never reaches the server keeps the dialog open with
 * what was typed and the connection message in its banner. Labels and
 * dialogs are pinned by the consequential-dialog tests.
 */
export function CoachingEventActions({
  actions,
  coachingRecordId,
  currentStatus,
}: CoachingEventActionsProps) {
  const addNote = actions?.addCoachingNote ?? addCoachingNoteAction;
  const advanceStatus = actions?.advanceCoachingStatus ?? advanceCoachingStatusAction;
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const outcomeRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const noteId = useId();
  const outcomeId = useId();
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actionState, setActionState] = useState<CoachingManagementActionState>(
    initialCoachingManagementActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};

  if (currentStatus !== "open" && currentStatus !== "in_progress") {
    return null;
  }

  const openDialog = (mode: DialogMode, trigger: HTMLButtonElement): void => {
    triggerRef.current = trigger;
    setDialogMode(mode);
    setNote("");
    setOutcome("");
    setActionState(initialCoachingManagementActionState);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setDialogMode(null);
    setActionState(initialCoachingManagementActionState);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!dialogMode || isInteractionLocked) {
      return;
    }

    setActionState(initialCoachingManagementActionState);
    startTransition(async () => {
      let result: CoachingManagementActionState;
      try {
        result =
          dialogMode === "note"
            ? await addNote({ coachingRecordId, note })
            : await advanceStatus({
                coachingRecordId,
                note,
                outcome,
                targetStatus: dialogMode === "start" ? "in_progress" : "closed",
              });
      } catch {
        // A rejected call (deploy skew, offline, a non-RSC 5xx) must not reach the error
        // boundary: the dialog stays open with the typed note/outcome and shows the banner.
        result = { message: COACHING_CONNECTION_ERROR_MESSAGE, status: "error" };
      }

      setActionState(result);

      if (result.status === "success") {
        setDialogMode(null);
        router.refresh();
      }
    });
  };

  const isOpen = dialogMode !== null;
  const title = dialogMode ? getDialogTitle(dialogMode) : "";
  const initialFocusRef = dialogMode === "close" ? outcomeRef : noteRef;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {currentStatus === "open" ? (
          <Button
            className="max-md:h-11"
            onClick={(event) => openDialog("start", event.currentTarget)}
            type="button"
          >
            Bắt đầu xử lý
          </Button>
        ) : (
          <Button
            className="max-md:h-11"
            onClick={(event) => openDialog("close", event.currentTarget)}
            type="button"
          >
            Đóng phiếu
          </Button>
        )}
        <Button
          className="max-md:h-11"
          onClick={(event) => openDialog("note", event.currentTarget)}
          type="button"
          variant="secondary"
        >
          Thêm ghi chú
        </Button>
      </div>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-xl"
        initialFocusRef={initialFocusRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            {title}
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            {dialogMode ? getDialogDescription(dialogMode) : ""}
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            {dialogMode === "close" ? (
              <TextAreaField error={fieldErrors.outcome?.[0]} id={outcomeId} label="Kết quả Coaching">
                <textarea
                  className={textAreaClassName}
                  disabled={isInteractionLocked}
                  id={outcomeId}
                  maxLength={4000}
                  onChange={(event) => setOutcome(event.target.value)}
                  ref={outcomeRef}
                  required
                  value={outcome}
                />
              </TextAreaField>
            ) : null}

            <TextAreaField error={fieldErrors.note?.[0]} id={noteId} label={dialogMode === "close" ? "Ghi chú bổ sung" : "Nội dung"}>
              <textarea
                className={textAreaClassName}
                disabled={isInteractionLocked}
                id={noteId}
                maxLength={4000}
                onChange={(event) => setNote(event.target.value)}
                ref={noteRef}
                required={dialogMode !== "close"}
                value={note}
              />
            </TextAreaField>

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể cập nhật Coaching"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                className="max-md:h-11"
                disabled={isInteractionLocked}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>
              <Button
                className="max-md:h-11"
                disabled={isInteractionLocked}
                isLoading={isInteractionLocked}
                type="submit"
              >
                {isInteractionLocked ? "Đang lưu…" : dialogMode ? getSubmitLabel(dialogMode) : "Lưu"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function TextAreaField({
  children,
  error,
  id,
  label,
}: {
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  error?: string;
  id: string;
  label: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <label className="text-label font-medium text-text-strong" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        "aria-describedby": error ? errorId : undefined,
        "aria-invalid": Boolean(error),
      })}
      {error ? (
        <p className="text-caption font-medium text-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getDialogDescription(mode: DialogMode): string {
  if (mode === "start") {
    return "Phiếu Coaching sẽ chuyển từ trạng thái Mở sang Đang xử lý sau khi hệ thống xác minh thao tác.";
  }

  if (mode === "close") {
    return "Ghi nhận kết quả trước khi yêu cầu hệ thống đóng phiếu Coaching. Phiếu đã đóng không nhận thêm ghi chú.";
  }

  return "Ghi chú được bổ sung vào lịch sử phiếu Coaching.";
}

function getDialogTitle(mode: DialogMode): string {
  if (mode === "start") {
    return "Bắt đầu xử lý Coaching";
  }

  if (mode === "close") {
    return "Đóng phiếu Coaching";
  }

  return "Thêm ghi chú Coaching";
}

function getSubmitLabel(mode: DialogMode): string {
  if (mode === "start") {
    return "Bắt đầu xử lý";
  }

  if (mode === "close") {
    return "Đóng phiếu";
  }

  return "Lưu ghi chú";
}
