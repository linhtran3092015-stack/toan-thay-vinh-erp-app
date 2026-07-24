"use client";

import {
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
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
  "resume",
];

const operationLabels: Record<
  StudentEnrollmentOperation,
  string
> = {
  enroll: "Nhập lớp",
  reserve: "Bảo lưu",
  resume: "Quay lại học",
  transfer: "Chuyển lớp",
};

const operationDescriptions: Record<
  StudentEnrollmentOperation,
  string
> = {
  enroll:
    "Xếp lớp lần đầu và chuyển trạng thái học viên sang Đang học.",
  reserve:
    "Kết thúc lớp hiện tại và chuyển học viên sang trạng thái Bảo lưu.",
  resume:
    "Xếp lại lớp cho học viên đang bảo lưu.",
  transfer:
    "Kết thúc lớp hiện tại và chuyển sang lớp mới ngay hôm nay.",
};

export function StudentEnrollmentManagement({
  model,
  studentId,
  studentName,
}: StudentEnrollmentManagementProps) {
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

  const visibleOperations = operationOrder.filter(
    (operation) =>
      model.actions[operation].visible,
  );

  if (visibleOperations.length === 0) {
    return null;
  }

  function openDialog(
    operation: StudentEnrollmentOperation,
  ) {
    if (!model.actions[operation].enabled) {
      return;
    }

    setValues(
      createInitialValues(operation, model),
    );
    setActionState(null);
    setSuccessMessage(null);
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
                        onClick={() =>
                          openDialog(operation)
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

      {activeOperation ? (
        <EnrollmentOperationDialog
          actionState={actionState}
          isPending={isPending}
          model={model}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          operation={activeOperation}
          setValues={setValues}
          studentName={studentName}
          values={values}
        />
      ) : null}
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
  values,
}: EnrollmentOperationDialogProps) {
  const usesClass =
    operation === "enroll" ||
    operation === "resume" ||
    operation === "transfer";

  const usesRegisteredMode =
    operation !== "reserve";

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
      : "effectiveFrom";

  const dateLabel =
    operation === "reserve"
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
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-modal sm:max-w-[640px] sm:rounded-xl">
        <form
          className="grid gap-5 p-5 md:p-6"
          onSubmit={onSubmit}
        >
          <div>
            <p className="text-sm font-semibold text-primary">
              {operationLabels[operation]}
            </p>

            <h2 className="mt-1 text-xl font-bold text-ink">
              {studentName}
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {operationDescriptions[operation]}
            </p>
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
                operation === "reserve"
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
      </div>
    </div>
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
