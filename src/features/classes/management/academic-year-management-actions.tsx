"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import {
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  activateAcademicYearAction,
  changeAcademicYearStatusAction,
  createAcademicYearAction,
} from "@/features/classes/actions/academic-year-actions";
import type {
  AcademicYearTargetStatus,
  ClassManagementActionState,
} from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";
import type {
  AcademicYearManagementItem,
} from "@/features/classes/read-models";

interface CreateAcademicYearFormProps {
  disabled?: boolean;
}

interface AcademicYearStatusActionsProps {
  academicYear: AcademicYearManagementItem;
  disabled?: boolean;
}

type StatusOperation =
  | "activate"
  | AcademicYearTargetStatus;

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-surface-base px-3 text-sm font-normal text-ink outline-none transition focus:border-action-primary focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function CreateAcademicYearForm({
  disabled = false,
}: CreateAcademicYearFormProps) {
  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [values, setValues] = useState({
    code: "",
    endsOn: "",
    name: "",
    startsOn: "",
  });

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const getFieldError = (
    fieldName: string,
  ): string | undefined =>
    actionState.fieldErrors?.[fieldName]?.[0];

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    startTransition(async () => {
      const result =
        await createAcademicYearAction(values);

      setActionState(result);

      if (result.status === "success") {
        setValues({
          code: "",
          endsOn: "",
          name: "",
          startsOn: "",
        });

        router.refresh();
      }
    });
  };

  return (
    <form
      className="grid gap-4 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card"
      onSubmit={handleSubmit}
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">
          Tạo năm học mới
        </h2>

        <p className="mt-1 text-sm text-ink-muted">
          Năm học mới được tạo ở trạng thái nháp.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          error={getFieldError("code")}
          label="Mã năm học"
        >
          <input
            className={inputClassName}
            disabled={disabled || isPending}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                code: event.target.value,
              }))
            }
            placeholder="Ví dụ: 2026-2027"
            required
            value={values.code}
          />
        </FormField>

        <FormField
          error={getFieldError("name")}
          label="Tên năm học"
        >
          <input
            className={inputClassName}
            disabled={disabled || isPending}
            maxLength={200}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Năm học 2026–2027"
            required
            value={values.name}
          />
        </FormField>

        <FormField
          error={getFieldError("startsOn")}
          label="Ngày bắt đầu"
        >
          <input
            className={inputClassName}
            disabled={disabled || isPending}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                startsOn: event.target.value,
              }))
            }
            required
            type="date"
            value={values.startsOn}
          />
        </FormField>

        <FormField
          error={getFieldError("endsOn")}
          label="Ngày kết thúc"
        >
          <input
            className={inputClassName}
            disabled={disabled || isPending}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                endsOn: event.target.value,
              }))
            }
            required
            type="date"
            value={values.endsOn}
          />
        </FormField>
      </div>

      {actionState.message ? (
        <ActionMessage state={actionState} />
      ) : null}

      <div className="flex justify-end">
        <Button
          disabled={disabled || isPending}
          type="submit"
        >
          {isPending
            ? "Đang tạo..."
            : "Tạo năm học"}
        </Button>
      </div>
    </form>
  );
}

export function AcademicYearStatusActions({
  academicYear,
  disabled = false,
}: AcademicYearStatusActionsProps) {
  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [operation, setOperation] =
    useState<StatusOperation | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [reason, setReason] = useState("");

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const openDialog = (
    nextOperation: StatusOperation,
  ): void => {
    setReason("");
    setActionState(
      initialClassManagementActionState,
    );
    setOperation(nextOperation);
  };

  const closeDialog = (): void => {
    if (isPending) {
      return;
    }

    setOperation(null);
    setReason("");
    setActionState(
      initialClassManagementActionState,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    if (!operation) {
      return;
    }

    startTransition(async () => {
      const result =
        operation === "activate"
          ? await activateAcademicYearAction({
              academicYearId:
                academicYear.id,
              reason,
            })
          : await changeAcademicYearStatusAction({
              academicYearId:
                academicYear.id,
              reason,
              targetStatus: operation,
            });

      setActionState(result);

      if (result.status === "success") {
        setOperation(null);
        setReason("");
        router.refresh();
      }
    });
  };

  if (academicYear.status === "archived") {
    return (
      <p className="text-sm text-ink-muted">
        Năm học đã lưu trữ, không còn thao tác.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(academicYear.status === "draft" ||
          (academicYear.status === "active" &&
            !academicYear.isCurrent)) ? (
          <Button
            disabled={disabled}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              openDialog("activate");
            }}
            type="button"
            variant="secondary"
          >
            Kích hoạt
          </Button>
        ) : null}

        {academicYear.status === "draft" ||
        academicYear.status === "active" ? (
          <Button
            disabled={disabled}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              openDialog("closed");
            }}
            type="button"
            variant="ghost"
          >
            Đóng năm học
          </Button>
        ) : null}

        {academicYear.status === "draft" ||
        academicYear.status === "closed" ? (
          <Button
            disabled={disabled}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              openDialog("archived");
            }}
            type="button"
            variant="ghost"
          >
            Lưu trữ
          </Button>
        ) : null}
      </div>

      <Dialog ariaDescribedBy="academic-year-status-description" ariaLabelledBy="academic-year-status-title" className="max-w-lg p-5" isOpen={operation !== null} onClose={closeDialog} returnFocusRef={triggerRef}>
        {operation ? (
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <div>
              <h2 className="text-section-title font-semibold text-text-strong" id="academic-year-status-title">
                {getOperationTitle(operation)}
              </h2>

              <p className="mt-1 text-sm text-ink-muted">
                {academicYear.code}
                {" — "}
                {academicYear.name}
              </p>

              <p className="mt-3 text-secondary text-text-muted" id="academic-year-status-description">
                {getOperationDescription(
                  operation,
                )}
              </p>
            </div>

            <FormField
              error={
                actionState.fieldErrors
                  ?.reason?.[0]
              }
              label="Lý do thao tác"
            >
              <textarea
                autoFocus
                className={`${inputClassName} min-h-28 resize-y py-3`}
                disabled={isPending}
                maxLength={2000}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Nhập lý do thực hiện"
                required
                value={reason}
              />
            </FormField>

            {actionState.message ? (
              <ActionMessage
                state={actionState}
              />
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                disabled={isPending}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                Hủy
              </Button>

              <Button
                disabled={
                  isPending ||
                  reason.trim().length === 0
                }
                type="submit"
              >
                {isPending
                  ? "Đang xử lý..."
                  : getOperationSubmitLabel(
                      operation,
                    )}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}

function getOperationTitle(
  operation: StatusOperation,
): string {
  const labels: Record<
    StatusOperation,
    string
  > = {
    activate: "Kích hoạt năm học",
    archived: "Lưu trữ năm học",
    closed: "Đóng năm học",
  };

  return labels[operation];
}

function getOperationSubmitLabel(
  operation: StatusOperation,
): string {
  const labels: Record<
    StatusOperation,
    string
  > = {
    activate: "Xác nhận kích hoạt",
    archived: "Xác nhận lưu trữ",
    closed: "Xác nhận đóng",
  };

  return labels[operation];
}

function getOperationDescription(
  operation: StatusOperation,
): string {
  const descriptions: Record<
    StatusOperation,
    string
  > = {
    activate:
      "Năm học này sẽ trở thành năm học hiện tại. Năm học hiện tại cũ sẽ được bỏ đánh dấu hiện tại.",
    archived:
      "Chỉ có thể lưu trữ khi toàn bộ lớp thuộc năm học đã được lưu trữ.",
    closed:
      "Chỉ có thể đóng khi không còn lớp nháp hoặc lớp đang hoạt động.",
  };

  return descriptions[operation];
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  label: string;
}

function FormField({
  children,
  error,
  label,
}: FormFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>

      {children}

      {error ? (
        <span className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ActionMessage({
  state,
}: {
  state: ClassManagementActionState;
}) {
  return (
    <div
      aria-live="polite"
      className={
        state.status === "error"
          ? "rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger"
          : "rounded-md border border-success-border bg-success-bg p-3 text-sm text-success"
      }
    >
      {state.message}
    </div>
  );
}
