"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createCoachingRecordAction } from "@/features/coaching/actions/coaching-actions";
import { CoachingActionMessage } from "@/features/coaching/components/coaching-action-message";
import {
  initialCoachingManagementActionState,
  type CoachingManagementActionState,
} from "@/features/coaching/forms/coaching-action-types";
import type {
  CoachingAssigneeOption,
  CoachingPriority,
  CoachingStudentOption,
} from "@/features/coaching/read-models";

interface CreateCoachingDialogProps {
  assignees: readonly CoachingAssigneeOption[];
  students: readonly CoachingStudentOption[];
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-canvas";

export function CreateCoachingDialog({
  assignees,
  students,
}: CreateCoachingDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [assistantOwnerId, setAssistantOwnerId] = useState(assignees[0]?.id ?? "");
  const [campaignName, setCampaignName] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<CoachingPriority>("medium");
  const [reviewAt, setReviewAt] = useState("");
  const [actionState, setActionState] = useState<CoachingManagementActionState>(
    initialCoachingManagementActionState,
  );
  const [isPending, startTransition] = useTransition();

  const canCreate = students.length > 0 && assignees.length > 0;

  const resetForm = (): void => {
    setStudentId("");
    setAssistantOwnerId(assignees[0]?.id ?? "");
    setCampaignName("");
    setReason("");
    setPriority("medium");
    setReviewAt("");
    setActionState(initialCoachingManagementActionState);
  };

  const closeDialog = (): void => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const openDialog = (): void => {
    resetForm();
    setIsOpen(true);
  };

  const handleSubmit = (): void => {
    startTransition(async () => {
      const result = await createCoachingRecordAction({
        assistantOwnerId,
        campaignName,
        priority,
        reason,
        reviewAt,
        studentId,
      });

      setActionState(result);

      if (result.status === "success" && result.redirectTo) {
        setIsOpen(false);
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        disabled={!canCreate}
        onClick={openDialog}
        size="lg"
        title={
          canCreate
            ? undefined
            : "Cần có học viên và người phụ trách đang hoạt động."
        }
        type="button"
      >
        Tạo phiếu Coaching
      </Button>

      {isOpen ? (
        <div
          aria-labelledby="create-coaching-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4"
          role="dialog"
        >
          <div className="mx-auto my-6 w-full max-w-2xl rounded-lg border border-hairline bg-surface-1 p-5 shadow-xl">
            <h2
              className="text-lg font-bold text-ink"
              id="create-coaching-dialog-title"
            >
              Tạo phiếu Coaching
            </h2>

            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={actionState.fieldErrors?.studentId?.[0]}
                  label="Học viên"
                >
                  <select
                    className={inputClassName}
                    disabled={isPending}
                    onChange={(event) => setStudentId(event.target.value)}
                    required
                    value={studentId}
                  >
                    <option value="">Chọn học viên</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.publicCode} - {student.fullName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  error={actionState.fieldErrors?.assistantOwnerId?.[0]}
                  label="Người phụ trách"
                >
                  <select
                    className={inputClassName}
                    disabled={isPending}
                    onChange={(event) => setAssistantOwnerId(event.target.value)}
                    required
                    value={assistantOwnerId}
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.displayName}
                        {assignee.roleCode === "owner"
                          ? " - Chủ trung tâm"
                          : " - Trợ lý"}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField
                error={actionState.fieldErrors?.campaignName?.[0]}
                label="Tên đợt Coaching"
              >
                <input
                  className={inputClassName}
                  disabled={isPending}
                  maxLength={240}
                  onChange={(event) => setCampaignName(event.target.value)}
                  required
                  value={campaignName}
                />
              </FormField>

              <FormField
                error={actionState.fieldErrors?.reason?.[0]}
                label="Lý do theo dõi"
              >
                <textarea
                  className={`${inputClassName} min-h-28 resize-y py-3`}
                  disabled={isPending}
                  maxLength={4000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={actionState.fieldErrors?.priority?.[0]}
                  label="Mức ưu tiên"
                >
                  <select
                    className={inputClassName}
                    disabled={isPending}
                    onChange={(event) =>
                      setPriority(event.target.value as CoachingPriority)
                    }
                    value={priority}
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                  </select>
                </FormField>

                <FormField
                  error={actionState.fieldErrors?.reviewAt?.[0]}
                  label="Ngày xem lại"
                >
                  <input
                    className={inputClassName}
                    disabled={isPending}
                    onChange={(event) => setReviewAt(event.target.value)}
                    type="date"
                    value={reviewAt}
                  />
                </FormField>
              </div>

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
                  Tạo phiếu
                </Button>
              </div>
            </form>
          </div>
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
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-danger">{error}</span>
      ) : null}
    </label>
  );
}
