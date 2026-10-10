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
import { createCoachingRecordAction } from "@/features/coaching/actions/coaching-actions";
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
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring/20 disabled:cursor-not-allowed disabled:bg-canvas";

export function CreateCoachingDialog({
  assignees,
  students,
}: CreateCoachingDialogProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const studentRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const studentId = useId();
  const assistantOwnerId = useId();
  const campaignNameId = useId();
  const reasonId = useId();
  const priorityId = useId();
  const reviewAtId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [studentIdValue, setStudentIdValue] = useState("");
  const [assistantOwnerIdValue, setAssistantOwnerIdValue] = useState(assignees[0]?.id ?? "");
  const [campaignName, setCampaignName] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<CoachingPriority>("medium");
  const [reviewAt, setReviewAt] = useState("");
  const [actionState, setActionState] = useState<CoachingManagementActionState>(
    initialCoachingManagementActionState,
  );
  const [isPending, startTransition] = useTransition();
  const isInteractionLocked = isPending && actionState.status !== "error";
  const fieldErrors = actionState.status === "error" ? actionState.fieldErrors ?? {} : {};
  const canCreate = students.length > 0 && assignees.length > 0;

  const resetForm = (): void => {
    setStudentIdValue("");
    setAssistantOwnerIdValue(assignees[0]?.id ?? "");
    setCampaignName("");
    setReason("");
    setPriority("medium");
    setReviewAt("");
    setActionState(initialCoachingManagementActionState);
  };

  const closeDialog = (): void => {
    if (isInteractionLocked) {
      return;
    }

    setIsOpen(false);
    setActionState(initialCoachingManagementActionState);
  };

  const openDialog = (): void => {
    resetForm();
    setIsOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isInteractionLocked) {
      return;
    }

    setActionState(initialCoachingManagementActionState);
    startTransition(async () => {
      const result = await createCoachingRecordAction({
        assistantOwnerId: assistantOwnerIdValue,
        campaignName,
        priority,
        reason,
        reviewAt,
        studentId: studentIdValue,
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
        className="min-h-11"
        disabled={!canCreate}
        onClick={openDialog}
        ref={triggerRef}
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

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="max-w-2xl"
        initialFocusRef={studentRef}
        isOpen={isOpen}
        onClose={closeDialog}
        returnFocusRef={triggerRef}
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id={titleId}>
            Tạo phiếu Coaching
          </h2>
          <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
            Ghi nhận một đợt theo dõi mới cho học viên. Hệ thống xác minh dữ liệu trước khi tạo phiếu.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField error={fieldErrors.studentId?.[0]} id={studentId} label="Học viên">
                <select
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={studentId}
                  onChange={(event) => setStudentIdValue(event.target.value)}
                  ref={studentRef}
                  required
                  value={studentIdValue}
                >
                  <option value="">Chọn học viên</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.publicCode} - {student.fullName}
                    </option>
                  ))}
                </select>
              </SelectField>

              <SelectField error={fieldErrors.assistantOwnerId?.[0]} id={assistantOwnerId} label="Người phụ trách">
                <select
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={assistantOwnerId}
                  onChange={(event) => setAssistantOwnerIdValue(event.target.value)}
                  required
                  value={assistantOwnerIdValue}
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
              </SelectField>
            </div>

            <TextField error={fieldErrors.campaignName?.[0]} id={campaignNameId} label="Tên đợt Coaching">
              <input
                className={inputClassName}
                disabled={isInteractionLocked}
                id={campaignNameId}
                maxLength={240}
                onChange={(event) => setCampaignName(event.target.value)}
                required
                value={campaignName}
              />
            </TextField>

            <TextField error={fieldErrors.reason?.[0]} id={reasonId} label="Lý do theo dõi">
              <textarea
                className={`${inputClassName} min-h-28 resize-y py-3`}
                disabled={isInteractionLocked}
                id={reasonId}
                maxLength={4000}
                onChange={(event) => setReason(event.target.value)}
                required
                value={reason}
              />
            </TextField>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField error={fieldErrors.priority?.[0]} id={priorityId} label="Mức ưu tiên">
                <select
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={priorityId}
                  onChange={(event) =>
                    setPriority(event.target.value as CoachingPriority)
                  }
                  value={priority}
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                </select>
              </SelectField>

              <TextField error={fieldErrors.reviewAt?.[0]} id={reviewAtId} label="Ngày xem lại">
                <input
                  className={inputClassName}
                  disabled={isInteractionLocked}
                  id={reviewAtId}
                  onChange={(event) => setReviewAt(event.target.value)}
                  type="date"
                  value={reviewAt}
                />
              </TextField>
            </div>

            {actionState.status === "error" ? (
              <ResultBanner
                description={actionState.message}
                title="Không thể tạo phiếu Coaching"
                tone="error"
              />
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" disabled={isInteractionLocked} onClick={closeDialog} size="lg" type="button" variant="ghost">
                Hủy
              </Button>
              <Button className="min-h-11" disabled={isInteractionLocked} isLoading={isInteractionLocked} size="lg" type="submit">
                {isInteractionLocked ? "Đang tạo phiếu…" : "Tạo phiếu"}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}

function TextField({
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
      <label className="text-label text-text-default" htmlFor={id}>{label}</label>
      {cloneElement(children, {
        "aria-describedby": error ? errorId : undefined,
        "aria-invalid": Boolean(error),
      })}
      {error ? <p className="text-caption font-medium text-danger" id={errorId}>{error}</p> : null}
    </div>
  );
}

function SelectField(props: Parameters<typeof TextField>[0]) {
  return <TextField {...props} />;
}
