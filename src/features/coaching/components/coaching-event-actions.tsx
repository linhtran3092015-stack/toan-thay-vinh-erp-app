"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  addCoachingNoteAction,
  advanceCoachingStatusAction,
} from "@/features/coaching/actions/coaching-actions";
import { CoachingActionMessage } from "@/features/coaching/components/coaching-action-message";
import {
  initialCoachingManagementActionState,
  type CoachingManagementActionState,
} from "@/features/coaching/forms/coaching-action-types";
import type { CoachingStatus } from "@/features/coaching/read-models";

interface CoachingEventActionsProps {
  coachingRecordId: string;
  currentStatus: CoachingStatus;
}

type DialogMode = "close" | "note" | "start";

const textAreaClassName =
  "min-h-28 w-full resize-y rounded-md border border-hairline bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-canvas";

export function CoachingEventActions({
  coachingRecordId,
  currentStatus,
}: CoachingEventActionsProps) {
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actionState, setActionState] = useState<CoachingManagementActionState>(
    initialCoachingManagementActionState,
  );
  const [isPending, startTransition] = useTransition();

  if (currentStatus === "closed") {
    return null;
  }

  const openDialog = (mode: DialogMode): void => {
    setDialogMode(mode);
    setNote("");
    setOutcome("");
    setActionState(initialCoachingManagementActionState);
  };

  const closeDialog = (): void => {
    if (!isPending) {
      setDialogMode(null);
    }
  };

  const handleSubmit = (): void => {
    if (!dialogMode) {
      return;
    }

    startTransition(async () => {
      const result =
        dialogMode === "note"
          ? await addCoachingNoteAction({ coachingRecordId, note })
          : await advanceCoachingStatusAction({
              coachingRecordId,
              note,
              outcome,
              targetStatus: dialogMode === "start" ? "in_progress" : "closed",
            });

      setActionState(result);

      if (result.status === "success") {
        setDialogMode(null);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => openDialog("note")}
          size="lg"
          type="button"
          variant="outline"
        >
          Thêm ghi chú
        </Button>
        {currentStatus === "open" ? (
          <Button
            onClick={() => openDialog("start")}
            size="lg"
            type="button"
          >
            Bắt đầu xử lý
          </Button>
        ) : (
          <Button
            onClick={() => openDialog("close")}
            size="lg"
            type="button"
            variant="secondary"
          >
            Đóng phiếu
          </Button>
        )}
      </div>

      {dialogMode ? (
        <div
          aria-labelledby="coaching-event-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-10 w-full max-w-xl rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <h2
              className="text-lg font-bold text-ink"
              id="coaching-event-dialog-title"
            >
              {getDialogTitle(dialogMode)}
            </h2>

            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              {dialogMode === "close" ? (
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  <span>Kết quả Coaching</span>
                  <textarea
                    className={textAreaClassName}
                    disabled={isPending}
                    maxLength={4000}
                    onChange={(event) => setOutcome(event.target.value)}
                    required
                    value={outcome}
                  />
                  {actionState.fieldErrors?.outcome?.[0] ? (
                    <span className="text-xs font-medium text-danger">
                      {actionState.fieldErrors.outcome[0]}
                    </span>
                  ) : null}
                </label>
              ) : null}

              <label className="grid gap-2 text-sm font-semibold text-ink">
                <span>
                  {dialogMode === "close" ? "Ghi chú bổ sung" : "Nội dung"}
                </span>
                <textarea
                  className={textAreaClassName}
                  disabled={isPending}
                  maxLength={4000}
                  onChange={(event) => setNote(event.target.value)}
                  required={dialogMode !== "close"}
                  value={note}
                />
                {actionState.fieldErrors?.note?.[0] ? (
                  <span className="text-xs font-medium text-danger">
                    {actionState.fieldErrors.note[0]}
                  </span>
                ) : null}
              </label>

              <CoachingActionMessage actionState={actionState} />

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  disabled={isPending}
                  onClick={closeDialog}
                  size="lg"
                  type="button"
                  variant="ghost"
                >
                  Hủy
                </Button>
                <Button
                  disabled={isPending}
                  isLoading={isPending}
                  size="lg"
                  type="submit"
                >
                  {getSubmitLabel(dialogMode)}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
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
