"use client";

import {
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  endStudentEnrollmentAction,
  enrollStudentInClassAction,
  reserveStudentEnrollmentAction,
  resumeStudentEnrollmentAction,
  transferStudentClassAction,
} from "@/features/students/enrollment/student-enrollment-actions";
import type {
  StudentEnrollmentActionState,
  StudentEnrollmentRegisteredMode,
} from "@/features/students/enrollment/student-enrollment-action-types";
import type {
  StudentEnrollmentOperation,
  StudentEnrollmentUiModel,
} from "@/features/students/enrollment/student-enrollment-ui-types";
import {
  fieldControlClass,
  FieldShell,
  textAreaControlClass,
} from "@/features/students/form/components/form-controls";

interface StudentEnrollmentManagementProps {
  model: StudentEnrollmentUiModel;
  studentId: string;
  studentName: string;
}

interface EnrollmentDialogValues {
  classId: string;
  effectiveDate: string;
  reason: string;
  registeredMode: StudentEnrollmentRegisteredMode;
}

const operationOrder: StudentEnrollmentOperation[] = [
  "enroll",
  "transfer",
  "reserve",
  "end",
  "resume",
];

export const operationLabels: Record<
  StudentEnrollmentOperation,
  string
> = {
  end: "Kết thúc ghi danh",
  enroll: "Nhập lớp",
  reserve: "Bảo lưu",
  resume: "Quay lại học",
  transfer: "Chuyển lớp",
};

const operationDescriptions: Record<
  StudentEnrollmentOperation,
  string
> = {
  end:
    "Học viên nghỉ hẳn: kết thúc lớp hiện tại vào ngày nghỉ và chuyển sang trạng thái Đã nghỉ. Quay lại học dùng nghiệp vụ Quay lại học.",
  enroll:
    "Xếp lớp lần đầu và chuyển trạng thái học viên sang Đang học.",
  reserve:
    "Kết thúc lớp hiện tại và chuyển học viên sang trạng thái Bảo lưu.",
  resume:
    "Xếp lại lớp cho học viên đang bảo lưu.",
  transfer:
    "Kết thúc lớp hiện tại và chuyển sang lớp mới ngay hôm nay.",
};

export interface StudentEnrollmentOperationsOptions {
  model: StudentEnrollmentUiModel;
  studentId: string;
  studentName: string;
}

export interface StudentEnrollmentOperationsController {
  /** The dialog element; render it once wherever the feature lives. */
  dialog: ReactNode;
  isPending: boolean;
  /** Opens the dialog for an enabled operation; ignores disabled ones. */
  open: (
    operation: StudentEnrollmentOperation,
    trigger?: HTMLButtonElement | null,
  ) => void;
  successMessage: string | null;
  visibleOperations: StudentEnrollmentOperation[];
}

/**
 * Enrollment operations (enroll, transfer, reserve, end, resume) share one
 * dialog and one success banner. The hook owns that state so a page can put
 * the primary action in its header, the rest in an overflow menu, and still
 * open the same dialog from an enrollment card.
 */
export function useStudentEnrollmentOperations({
  model,
  studentId,
  studentName,
}: StudentEnrollmentOperationsOptions): StudentEnrollmentOperationsController {
  const router = useRouter();

  const [activeOperation, setActiveOperation] =
    useState<StudentEnrollmentOperation | null>(null);

  const [values, setValues] =
    useState<EnrollmentDialogValues>(() =>
      createInitialValues("enroll", model),
    );

  const [actionState, setActionState] =
    useState<StudentEnrollmentActionState | null>(
      null,
    );

  const [isPending, setIsPending] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  const visibleOperations = operationOrder.filter(
    (operation) =>
      model.actions[operation].visible,
  );

  function open(
    operation: StudentEnrollmentOperation,
    trigger?: HTMLButtonElement | null,
  ) {
    if (!model.actions[operation].enabled) {
      return;
    }

    setValues(
      createInitialValues(operation, model),
    );
    setActionState(null);
    setSuccessMessage(null);
    activeTriggerRef.current = trigger ?? null;
    setActiveOperation(operation);
  }

  function closeDialog() {
    if (isPending) {
      return;
    }

    setActiveOperation(null);
    setActionState(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!activeOperation) {
      return;
    }

    setIsPending(true);
    setActionState(null);

    try {
      const result = await runOperation({
        operation: activeOperation,
        studentId,
        values,
      });

      setActionState(result);

      if (result.status === "success") {
        setSuccessMessage(result.message);
        setActiveOperation(null);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  const dialog = activeOperation ? (
    <EnrollmentOperationDialog
      actionState={actionState}
      isPending={isPending}
      model={model}
      onClose={closeDialog}
      onSubmit={handleSubmit}
      operation={activeOperation}
      setValues={setValues}
      studentName={studentName}
      returnFocusRef={activeTriggerRef}
      values={values}
    />
  ) : null;

  return { dialog, isPending, open, successMessage, visibleOperations };
}

export function StudentEnrollmentManagement({
  model,
  studentId,
  studentName,
}: StudentEnrollmentManagementProps) {
  const { dialog, open, successMessage, visibleOperations } =
    useStudentEnrollmentOperations({ model, studentId, studentName });

  if (visibleOperations.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nghiệp vụ xếp lớp</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          {successMessage ? (
            <div
              className="rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm font-semibold leading-6 text-success"
              role="status"
            >
              {successMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {visibleOperations.map(
              (operation) => {
                const availability =
                  model.actions[operation];

                return (
                  <div
                    className="grid content-between gap-3 rounded-lg border border-hairline bg-canvas p-4"
                    key={operation}
                  >
                    <div>
                      <p className="font-semibold text-ink">
                        {operationLabels[operation]}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {
                          operationDescriptions[
                            operation
                          ]
                        }
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Button
                        className="min-h-10 justify-self-start"
                        disabled={
                          !availability.enabled
                        }
                        onClick={(event) =>
                          open(operation, event.currentTarget)
                        }
                        size="sm"
                        type="button"
                        variant={
                          operation === "reserve"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {operationLabels[operation]}
                      </Button>

                      {availability.reason ? (
                        <p className="text-xs font-semibold leading-5 text-warning">
                          {availability.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          <p className="text-xs leading-5 text-ink-muted">
            Chuyển lớp và bảo lưu chỉ có hiệu lực
            trong ngày thao tác. Mọi thay đổi đều
            được lưu vào lịch sử xếp lớp và nhật ký
            hệ thống.
          </p>
        </CardContent>
      </Card>

      {dialog}
    </>
  );
}

interface EnrollmentOperationDialogProps {
  actionState: StudentEnrollmentActionState | null;
  isPending: boolean;
  model: StudentEnrollmentUiModel;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  operation: StudentEnrollmentOperation;
  setValues: React.Dispatch<
    React.SetStateAction<EnrollmentDialogValues>
  >;
  studentName: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  values: EnrollmentDialogValues;
}

function EnrollmentOperationDialog({
  actionState,
  isPending,
  model,
  onClose,
  onSubmit,
  operation,
  setValues,
  studentName,
  returnFocusRef,
  values,
}: EnrollmentOperationDialogProps) {
  const usesClass =
    operation === "enroll" ||
    operation === "resume" ||
    operation === "transfer";

  const usesRegisteredMode =
    operation !== "reserve" && operation !== "end";

  const classOptions =
    operation === "transfer"
      ? model.transferClassOptions
      : model.classOptions;

  const classFieldName =
    operation === "enroll"
      ? "classId"
      : "targetClassId";

  const dateFieldName =
    operation === "reserve"
      ? "reservedFrom"
      : operation === "end"
        ? "effectiveTo"
        : "effectiveFrom";

  const dateLabel =
    operation === "end"
      ? "Ngày nghỉ (không được ở tương lai)"
      : operation === "reserve"
      ? "Ngày bắt đầu bảo lưu"
      : operation === "transfer"
        ? "Ngày chuyển lớp"
        : operation === "resume"
          ? "Ngày quay lại học"
          : "Ngày bắt đầu học";

  const fixedToToday =
    operation === "reserve" ||
    operation === "transfer";

  const minimumDate =
    operation === "resume"
      ? getResumeMinimumDate(model)
      : undefined;

  return (
    <Dialog
      ariaDescribedBy="enrollment-operation-description"
      ariaLabelledBy="enrollment-operation-title"
      className="sm:max-w-[640px]"
      isOpen
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <form className="grid gap-5 p-5 md:p-6" onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
            <p className="text-sm font-semibold text-primary">
              {operationLabels[operation]}
            </p>

            <h2 className="mt-1 text-xl font-bold text-ink" id="enrollment-operation-title">
              {studentName}
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-muted" id="enrollment-operation-description">
              {operationDescriptions[operation]}
            </p>
            </div>

            <button
              aria-label="Đóng hộp thoại nghiệp vụ xếp lớp"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover hover:text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
          </div>

          {actionState?.status === "error" ? (
            <div
              className="rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm font-semibold leading-6 text-danger"
              role="alert"
            >
              {actionState.message}
            </div>
          ) : null}

          {usesClass ? (
            <FieldShell
              error={getFieldError(
                actionState,
                classFieldName,
              )}
              id="enrollmentClassId"
              label={
                operation === "transfer"
                  ? "Lớp mới"
                  : "Lớp xếp học"
              }
              required
            >
              <select
                className={fieldControlClass(
                  getFieldError(
                    actionState,
                    classFieldName,
                  ),
                )}
                disabled={isPending}
                id="enrollmentClassId"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    classId:
                      event.target.value,
                  }))
                }
                required
                value={values.classId}
              >
                <option value="">
                  Chọn lớp
                </option>

                {classOptions.map(
                  (classOption) => (
                    <option
                      key={classOption.id}
                      value={classOption.id}
                    >
                      {classOption.code}
                      {" — "}
                      {classOption.name}
                      {" — Khối "}
                      {classOption.grade}
                      {" — "}
                      {classOption.level}
                    </option>
                  ),
                )}
              </select>
            </FieldShell>
          ) : null}

          {usesRegisteredMode ? (
            <FieldShell
              error={getFieldError(
                actionState,
                "registeredMode",
              )}
              id="enrollmentRegisteredMode"
              label="Hình thức đăng ký"
              required
            >
              <select
                className={fieldControlClass(
                  getFieldError(
                    actionState,
                    "registeredMode",
                  ),
                )}
                disabled={isPending}
                id="enrollmentRegisteredMode"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    registeredMode:
                      event.target
                        .value as StudentEnrollmentRegisteredMode,
                  }))
                }
                value={values.registeredMode}
              >
                <option value="offline">
                  Offline
                </option>
                <option value="online">
                  Online
                </option>
              </select>
            </FieldShell>
          ) : null}

          <FieldShell
            error={getFieldError(
              actionState,
              dateFieldName,
            )}
            hint={
              fixedToToday
                ? "Theo quy trình hiện tại, thao tác này bắt buộc có hiệu lực trong ngày."
                : undefined
            }
            id="enrollmentEffectiveDate"
            label={dateLabel}
            required
          >
            <input
              className={fieldControlClass(
                getFieldError(
                  actionState,
                  dateFieldName,
                ),
              )}
              disabled={isPending}
              id="enrollmentEffectiveDate"
              min={minimumDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  effectiveDate:
                    event.target.value,
                }))
              }
              readOnly={fixedToToday}
              required
              type="date"
              value={values.effectiveDate}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(
              actionState,
              "reason",
            )}
            hint="Lý do được lưu vào lịch sử nghiệp vụ."
            id="enrollmentReason"
            label="Lý do thao tác"
            required
          >
            <textarea
              className={textAreaControlClass(
                getFieldError(
                  actionState,
                  "reason",
                ),
              )}
              disabled={isPending}
              id="enrollmentReason"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder={getReasonPlaceholder(
                operation,
              )}
              required
              value={values.reason}
            />
          </FieldShell>

          {operation === "end" ? (
            <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm leading-6 text-danger">
              Sau khi xác nhận, lớp hiện tại kết thúc từ ngày nghỉ và học viên
              chuyển sang trạng thái Đã nghỉ. Số buổi còn lại được giữ nguyên
              trên sổ buổi để đối chiếu hoàn phí nếu có.
            </div>
          ) : null}

          {operation === "reserve" ? (
            <div className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm leading-6 text-warning">
              Sau khi xác nhận, lớp hiện tại sẽ kết
              thúc từ ngày hôm qua và học viên chuyển
              sang trạng thái Bảo lưu.
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>

            <Button
              disabled={isPending}
              type="submit"
              variant={
                operation === "end"
                  ? "danger"
                  : operation === "reserve"
                    ? "primary"
                    : "secondary"
              }
            >
              {isPending
                ? "Đang xử lý..."
                : `Xác nhận ${operationLabels[
                    operation
                  ].toLowerCase()}`}
            </Button>
          </div>
      </form>
    </Dialog>
  );
}

async function runOperation({
  operation,
  studentId,
  values,
}: {
  operation: StudentEnrollmentOperation;
  studentId: string;
  values: EnrollmentDialogValues;
}): Promise<StudentEnrollmentActionState> {
  if (operation === "enroll") {
    return enrollStudentInClassAction({
      classId: values.classId,
      effectiveFrom: values.effectiveDate,
      reason: values.reason,
      registeredMode: values.registeredMode,
      studentId,
    });
  }

  if (operation === "transfer") {
    return transferStudentClassAction({
      effectiveFrom: values.effectiveDate,
      reason: values.reason,
      registeredMode: values.registeredMode,
      studentId,
      targetClassId: values.classId,
    });
  }

  if (operation === "reserve") {
    return reserveStudentEnrollmentAction({
      reason: values.reason,
      reservedFrom: values.effectiveDate,
      studentId,
    });
  }

  if (operation === "end") {
    return endStudentEnrollmentAction({
      effectiveTo: values.effectiveDate,
      reason: values.reason,
      studentId,
    });
  }

  return resumeStudentEnrollmentAction({
    effectiveFrom: values.effectiveDate,
    reason: values.reason,
    registeredMode: values.registeredMode,
    studentId,
    targetClassId: values.classId,
  });
}

function createInitialValues(
  operation: StudentEnrollmentOperation,
  model: StudentEnrollmentUiModel,
): EnrollmentDialogValues {
  const classOptions =
    operation === "transfer"
      ? model.transferClassOptions
      : model.classOptions;

  const effectiveDate =
    operation === "resume"
      ? getResumeMinimumDate(model)
      : model.businessDate;

  return {
    classId: classOptions[0]?.id ?? "",
    effectiveDate,
    reason: "",
    registeredMode:
      model.defaultRegisteredMode,
  };
}

function getResumeMinimumDate(
  model: StudentEnrollmentUiModel,
): string {
  const previousEndDate =
    model.latestEnrollment?.effectiveTo;

  if (!previousEndDate) {
    return model.businessDate;
  }

  const nextDate =
    addDays(previousEndDate, 1);

  return nextDate > model.businessDate
    ? nextDate
    : model.businessDate;
}

function addDays(
  isoDate: string,
  days: number,
): string {
  const date = new Date(
    `${isoDate}T00:00:00.000Z`,
  );

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getFieldError(
  state: StudentEnrollmentActionState | null,
  fieldName: string,
): string | undefined {
  return state?.fieldErrors?.[fieldName]?.[0];
}

function getReasonPlaceholder(
  operation: StudentEnrollmentOperation,
): string {
  const placeholders: Record<
    StudentEnrollmentOperation,
    string
  > = {
    end:
      "Ví dụ: Phụ huynh báo nghỉ hẳn từ tháng này vì chuyển trường.",
    enroll:
      "Ví dụ: Phụ huynh đã xác nhận nhập học và hoàn tất điều kiện xếp lớp.",
    reserve:
      "Ví dụ: Phụ huynh đề nghị bảo lưu từ hôm nay.",
    resume:
      "Ví dụ: Phụ huynh xác nhận học viên quay lại học.",
    transfer:
      "Ví dụ: Chuyển lớp theo đánh giá trình độ và xác nhận của phụ huynh.",
  };

  return placeholders[operation];
}
