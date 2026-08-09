"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createStudentWithPrimaryGuardianAction,
  findStudentFormDuplicatesAction,
  updateStudentWithPrimaryGuardianAction,
} from "@/features/students/form/student-form-actions";
import type {
  StudentDuplicateLookupResult,
  StudentFormActionState,
} from "@/features/students/form/student-form-action-types";
import {
  getStudentLifecycleStatusLabel,
  toCreateStudentActionInput,
  toUpdateStudentActionInput,
  type StudentProfileFormMode,
} from "@/features/students/form/student-profile-form-helpers";
import {
  studentProfileFormSchema,
  type StudentProfileFormValues,
} from "@/features/students/form/student-profile-form-schema";

import {
  describedBy,
  fieldControlClass,
  FieldShell,
  textAreaControlClass,
} from "./form-controls";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

interface StudentProfileFormProps {
  cancelHref: string;
  defaultValues: StudentProfileFormValues;
  lifecycleStatus?: string;
  mode: StudentProfileFormMode;
  returnQuery?: string;
}

type SuccessfulDuplicateLookup = Extract<
  StudentDuplicateLookupResult,
  { ok: true }
>;

const duplicateFields: Array<
  FieldPath<StudentProfileFormValues>
> = [
  "fullName",
  "birthYear",
  "guardianPhone",
];

export function StudentProfileForm({
  cancelHref,
  defaultValues,
  lifecycleStatus,
  mode,
  returnQuery,
}: StudentProfileFormProps) {
  const router = useRouter();

  const form = useForm<StudentProfileFormValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(studentProfileFormSchema),
  });

  const [duplicateResult, setDuplicateResult] =
    useState<SuccessfulDuplicateLookup | null>(null);

  const [checkedDuplicateKey, setCheckedDuplicateKey] =
    useState<string | null>(null);

  const [isCheckingDuplicates, setIsCheckingDuplicates] =
    useState(false);

  const [actionMessage, setActionMessage] =
    useState<string | null>(null);

  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] =
    useState(false);

  const duplicateValues = useWatch({
    control: form.control,
    name: [
      "fullName",
      "birthYear",
      "guardianPhone",
    ],
  });

  const currentDuplicateKey = createDuplicateKey({
    birthYear: Number(duplicateValues[1]),
    fullName: duplicateValues[0] ?? "",
    guardianPhone: duplicateValues[2] ?? "",
  });

  const watchedFullName = useWatch({
    control: form.control,
    name: "fullName",
  });
  const isSubmitting = form.formState.isSubmitting;

  const visibleDuplicateResult =
    checkedDuplicateKey === currentDuplicateKey
      ? duplicateResult
      : null;

  async function runDuplicateLookup(
    values: StudentProfileFormValues,
  ): Promise<StudentDuplicateLookupResult> {
    form.clearErrors("duplicateOverrideReason");

    const result =
      await findStudentFormDuplicatesAction({
        birthYear: values.birthYear,
        fullName: values.fullName,
        guardianPhone: values.guardianPhone,
        studentId:
          mode === "edit"
            ? values.studentId
            : undefined,
      });

    const lookupKey = createDuplicateKey(values);
    setCheckedDuplicateKey(lookupKey);

    if (result.ok) {
      setDuplicateResult(result);
    } else {
      setDuplicateResult(null);
    }

    return result;
  }

  async function handleDuplicateCheck() {
    setActionMessage(null);

    const valid = await form.trigger(
      duplicateFields,
      {
        shouldFocus: true,
      },
    );

    if (!valid) {
      return;
    }

    setIsCheckingDuplicates(true);

    try {
      const result = await runDuplicateLookup(
        form.getValues(),
      );

      if (!result.ok) {
        setActionMessage(result.message);
      }
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  async function handleValidSubmit(
    values: StudentProfileFormValues,
  ) {
    setActionMessage(null);

    const duplicateLookup =
      await runDuplicateLookup(values);

    if (!duplicateLookup.ok) {
      setActionMessage(duplicateLookup.message);
      return;
    }

    if (
      duplicateLookup.hasExactStudentDuplicate &&
      !values.duplicateOverrideReason.trim()
    ) {
      form.setError("duplicateOverrideReason", {
        message:
          "Có học viên trùng họ tên, năm sinh và số điện thoại phụ huynh. Cần nhập lý do để tiếp tục.",
        type: "manual",
      });

      window.setTimeout(() => {
        form.setFocus("duplicateOverrideReason");
      }, 0);

      return;
    }

    const actionState =
      mode === "create"
        ? await createStudentWithPrimaryGuardianAction(
            toCreateStudentActionInput(values),
          )
        : await updateStudentWithPrimaryGuardianAction(
            toUpdateStudentActionInput(values),
          );

    if (actionState.status === "error") {
      applyActionFieldErrors(form, actionState);
      setActionMessage(actionState.message);
      return;
    }

    form.reset(values);

    if (actionState.redirectTo) {
      router.push(withReturnQuery(actionState.redirectTo, returnQuery));
      router.refresh();
      return;
    }

    setActionMessage(actionState.message);
  }

  function handleInvalidSubmit(
    errors: FieldErrors<StudentProfileFormValues>,
  ) {
    const firstError = Object.keys(errors)[0] as
      | FieldPath<StudentProfileFormValues>
      | undefined;

    if (firstError) {
      window.setTimeout(() => {
        form.setFocus(firstError);
      }, 0);
    }
  }

  function handleCancel() {
    if (form.formState.isDirty) {
      setIsUnsavedDialogOpen(true);
      return;
    }

    router.push(cancelHref);
  }

  return (
    <FormProvider {...form}>
      <form
        className="mx-auto grid w-full max-w-[1000px] gap-5"
        onSubmit={form.handleSubmit(
          handleValidSubmit,
          handleInvalidSubmit,
        )}
      >
        <input
          type="hidden"
          {...form.register("studentId")}
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              {mode === "create"
                ? "Hồ sơ học viên mới"
                : "Chỉnh sửa hồ sơ"}
            </p>

            <h1 className="text-2xl font-bold text-ink md:text-3xl">
              {mode === "create"
                ? "Thêm học viên"
                : watchedFullName || "Học viên"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Lưu thông tin học viên và phụ huynh chính.
              Lớp học, học phí, nguồn tuyển sinh và sổ liên
              lạc được quản lý tại các nghiệp vụ riêng.
            </p>
          </div>

          <Button
            className="min-h-11 self-start md:self-auto"
            disabled={isSubmitting}
            onClick={handleCancel}
            type="button"
            variant="outline"
          >
            Về hồ sơ
          </Button>
        </div>

        {actionMessage ? (
          <div
            className="rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm font-semibold leading-6 text-danger"
            role="alert"
          >
            {actionMessage}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Thông tin học viên</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            {mode === "edit" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell
                  id="publicCode"
                  label="Mã học viên"
                >
                  <input
                    className={fieldControlClass(
                      undefined,
                      "font-mono font-semibold",
                    )}
                    id="publicCode"
                    readOnly
                    {...form.register("publicCode")}
                  />
                </FieldShell>

                <FieldShell
                  id="lifecycleStatus"
                  label="Trạng thái hiện tại"
                >
                  <input
                    className={fieldControlClass()}
                    id="lifecycleStatus"
                    readOnly
                    value={
                      lifecycleStatus
                        ? getStudentLifecycleStatusLabel(
                            lifecycleStatus,
                          )
                        : "-"
                    }
                  />
                </FieldShell>
              </div>
            ) : (
              <input
                type="hidden"
                {...form.register("publicCode")}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "fullName",
                )}
                id="fullName"
                label="Họ và tên"
                required
              >
                <input
                  aria-describedby={describedBy(
                    "fullName",
                    getProfileFieldError(
                      form.formState.errors,
                      "fullName",
                    ),
                  )}
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "fullName",
                    ),
                  )}
                  id="fullName"
                  {...form.register("fullName")}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "nickname",
                )}
                id="nickname"
                label="Tên thường gọi"
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "nickname",
                    ),
                  )}
                  id="nickname"
                  {...form.register("nickname")}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "birthYear",
                )}
                id="birthYear"
                label="Năm sinh"
                required
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "birthYear",
                    ),
                  )}
                  id="birthYear"
                  inputMode="numeric"
                  type="number"
                  {...form.register("birthYear", {
                    valueAsNumber: true,
                  })}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "currentGrade",
                )}
                id="currentGrade"
                label="Khối hiện tại"
                required
              >
                <select
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "currentGrade",
                    ),
                  )}
                  id="currentGrade"
                  {...form.register("currentGrade", {
                    valueAsNumber: true,
                  })}
                >
                  {Array.from({ length: 12 }).map(
                    (_, index) => {
                      const grade = index + 1;

                      return (
                        <option
                          key={grade}
                          value={grade}
                        >
                          Khối {grade}
                        </option>
                      );
                    },
                  )}
                </select>
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "provinceName",
                )}
                id="provinceName"
                label="Tỉnh/thành phố"
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "provinceName",
                    ),
                  )}
                  id="provinceName"
                  {...form.register("provinceName")}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "learningLevel",
                )}
                id="learningLevel"
                label="Mức học tập"
                required
              >
                <select
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "learningLevel",
                    ),
                  )}
                  id="learningLevel"
                  {...form.register("learningLevel")}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="CLC">CLC</option>
                </select>
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "registeredMode",
                )}
                id="registeredMode"
                label="Hình thức đăng ký"
                required
              >
                <select
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "registeredMode",
                    ),
                  )}
                  id="registeredMode"
                  {...form.register("registeredMode")}
                >
                  <option value="offline">
                    Offline
                  </option>
                  <option value="online">
                    Online
                  </option>
                </select>
              </FieldShell>
            </div>

            <FieldShell
              error={getProfileFieldError(
                form.formState.errors,
                "learningGoal",
              )}
              id="learningGoal"
              label="Mục tiêu học tập"
            >
              <textarea
                className={textAreaControlClass(
                  getProfileFieldError(
                    form.formState.errors,
                    "learningGoal",
                  ),
                )}
                id="learningGoal"
                {...form.register("learningGoal")}
              />
            </FieldShell>

            <FieldShell
              error={getProfileFieldError(
                form.formState.errors,
                "internalNote",
              )}
              id="internalNote"
              label="Ghi chú nội bộ"
            >
              <textarea
                className={textAreaControlClass(
                  getProfileFieldError(
                    form.formState.errors,
                    "internalNote",
                  ),
                )}
                id="internalNote"
                {...form.register("internalNote")}
              />
            </FieldShell>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phụ huynh chính</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-info-border bg-info-bg p-4 text-sm leading-6 text-info">
              Hệ thống chuẩn hóa số điện thoại và tự động
              sử dụng lại phụ huynh đã tồn tại. Một phụ
              huynh có thể liên kết với nhiều học viên.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "guardianFullName",
                )}
                id="guardianFullName"
                label="Họ tên phụ huynh"
                required
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "guardianFullName",
                    ),
                  )}
                  id="guardianFullName"
                  {...form.register(
                    "guardianFullName",
                  )}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "guardianPhone",
                )}
                id="guardianPhone"
                label="Số điện thoại"
                required
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "guardianPhone",
                    ),
                  )}
                  id="guardianPhone"
                  inputMode="tel"
                  type="tel"
                  {...form.register("guardianPhone")}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "guardianRelationship",
                )}
                id="guardianRelationship"
                label="Quan hệ với học viên"
                required
              >
                <select
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "guardianRelationship",
                    ),
                  )}
                  id="guardianRelationship"
                  {...form.register(
                    "guardianRelationship",
                  )}
                >
                  <option value="">
                    Chọn quan hệ
                  </option>
                  <option value="Mẹ">Mẹ</option>
                  <option value="Bố">Bố</option>
                  <option value="Người giám hộ">
                    Người giám hộ
                  </option>
                  <option value="Khác">Khác</option>
                </select>
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "guardianZalo",
                )}
                id="guardianZalo"
                label="Zalo"
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "guardianZalo",
                    ),
                  )}
                  id="guardianZalo"
                  {...form.register("guardianZalo")}
                />
              </FieldShell>

              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "guardianEmail",
                )}
                id="guardianEmail"
                label="Email"
              >
                <input
                  className={fieldControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "guardianEmail",
                    ),
                  )}
                  id="guardianEmail"
                  type="email"
                  {...form.register("guardianEmail")}
                />
              </FieldShell>
            </div>

            <FieldShell
              error={getProfileFieldError(
                form.formState.errors,
                "guardianNote",
              )}
              id="guardianNote"
              label="Ghi chú phụ huynh"
            >
              <textarea
                className={textAreaControlClass(
                  getProfileFieldError(
                    form.formState.errors,
                    "guardianNote",
                  ),
                )}
                id="guardianNote"
                {...form.register("guardianNote")}
              />
            </FieldShell>

            <Button
              className="min-h-11 justify-self-start"
              disabled={
                isCheckingDuplicates ||
                isSubmitting
              }
              onClick={handleDuplicateCheck}
              type="button"
              variant="outline"
            >
              {isCheckingDuplicates
                ? "Đang kiểm tra..."
                : "Kiểm tra hồ sơ trùng"}
            </Button>
          </CardContent>
        </Card>

        {visibleDuplicateResult ? (
          <DuplicateLookupPanel
            result={visibleDuplicateResult}
          />
        ) : null}

        {visibleDuplicateResult?.hasExactStudentDuplicate ? (
          <Card className="border-warning-border bg-warning-bg shadow-none">
            <CardHeader>
              <CardTitle>
                Xác nhận tiếp tục lưu
              </CardTitle>
            </CardHeader>

            <CardContent>
              <FieldShell
                error={getProfileFieldError(
                  form.formState.errors,
                  "duplicateOverrideReason",
                )}
                hint="Lý do này được lưu cùng audit của thao tác."
                id="duplicateOverrideReason"
                label="Lý do vẫn tạo hoặc cập nhật hồ sơ"
                required
              >
                <textarea
                  className={textAreaControlClass(
                    getProfileFieldError(
                      form.formState.errors,
                      "duplicateOverrideReason",
                    ),
                  )}
                  id="duplicateOverrideReason"
                  {...form.register(
                    "duplicateOverrideReason",
                  )}
                />
              </FieldShell>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Lý do thao tác</CardTitle>
          </CardHeader>

          <CardContent>
            <FieldShell
              error={getProfileFieldError(
                form.formState.errors,
                "reason",
              )}
              hint="Nội dung được lưu trong nhật ký audit."
              id="reason"
              label={
                mode === "create"
                  ? "Lý do tạo hồ sơ"
                  : "Lý do cập nhật hồ sơ"
              }
              required
            >
              <textarea
                className={textAreaControlClass(
                  getProfileFieldError(
                    form.formState.errors,
                    "reason",
                  ),
                )}
                id="reason"
                placeholder={
                  mode === "create"
                    ? "Ví dụ: Tạo hồ sơ sau khi phụ huynh đăng ký tư vấn."
                    : "Ví dụ: Cập nhật thông tin theo xác nhận của phụ huynh."
                }
                {...form.register("reason")}
              />
            </FieldShell>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-30 -mx-4 border-t border-hairline bg-canvas/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-lg md:border md:bg-surface-1 md:shadow-card">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="min-h-11"
              disabled={isSubmitting}
              onClick={handleCancel}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>

            <Button
              className="min-h-11"
              disabled={
                isSubmitting ||
                isCheckingDuplicates
              }
              type="submit"
              variant="secondary"
            >
              {isSubmitting
                ? "Đang lưu..."
                : mode === "create"
                  ? "Tạo hồ sơ"
                  : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </form>

      {isUnsavedDialogOpen ? (
        <UnsavedChangesDialog
          onConfirmLeave={() =>
            router.push(cancelHref)
          }
          onStay={() =>
            setIsUnsavedDialogOpen(false)
          }
        />
      ) : null}
    </FormProvider>
  );
}

function withReturnQuery(pathname: string, query?: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

function DuplicateLookupPanel({
  result,
}: {
  result: SuccessfulDuplicateLookup;
}) {
  if (!result.guardian) {
    return (
      <div className="rounded-lg border border-success-border bg-success-bg p-4 text-sm font-semibold leading-6 text-success">
        Không tìm thấy phụ huynh hoặc học viên trùng
        theo số điện thoại này.
      </div>
    );
  }

  return (
    <Card
      className={
        result.hasExactStudentDuplicate
          ? "border-warning-border bg-warning-bg shadow-none"
          : "border-info-border bg-info-bg shadow-none"
      }
    >
      <CardHeader>
        <CardTitle>
          {result.hasExactStudentDuplicate
            ? "Phát hiện học viên trùng"
            : "Phụ huynh đã tồn tại"}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 text-sm leading-6">
        <div>
          <p className="font-semibold text-ink">
            {result.guardian.fullName}
          </p>
          <p className="text-ink-muted">
            {result.guardian.phone}
          </p>
        </div>

        {result.guardian.children.length > 0 ? (
          <div className="grid gap-2">
            {result.guardian.children.map(
              (student) => (
                <div
                  className="rounded-md border border-hairline bg-white px-3 py-2"
                  key={student.id}
                >
                  <p className="font-semibold text-ink">
                    {student.fullName}
                  </p>

                  <p className="text-xs text-ink-muted">
                    {student.publicCode}
                    {" · "}
                    {student.birthYear}
                    {" · "}
                    {getStudentLifecycleStatusLabel(
                      student.lifecycleStatus,
                    )}
                  </p>

                  {student.isExactDuplicate ? (
                    <p className="mt-1 text-xs font-semibold text-warning">
                      Trùng họ tên, năm sinh và số điện
                      thoại phụ huynh
                    </p>
                  ) : null}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-ink-muted">
            Phụ huynh này chưa có học viên đang liên
            kết.
          </p>
        )}

        {!result.hasExactStudentDuplicate ? (
          <p className="font-semibold text-info">
            Khi lưu, hệ thống sẽ dùng lại hồ sơ phụ
            huynh hiện có.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getProfileFieldError(
  errors: FieldErrors<StudentProfileFormValues>,
  field: keyof StudentProfileFormValues,
): string | undefined {
  const error = errors[field];

  return typeof error?.message === "string"
    ? error.message
    : undefined;
}

function createDuplicateKey(
  values: Pick<
    StudentProfileFormValues,
    "birthYear" | "fullName" | "guardianPhone"
  >,
): string {
  return [
    values.fullName.trim().toLowerCase(),
    String(values.birthYear),
    values.guardianPhone.replace(
      /[\s.-]/g,
      "",
    ),
  ].join("|");
}

function applyActionFieldErrors(
  form: ReturnType<
    typeof useForm<StudentProfileFormValues>
  >,
  state: StudentFormActionState,
) {
  if (!state.fieldErrors) {
    return;
  }

  for (const [fieldName, messages] of Object.entries(
    state.fieldErrors,
  )) {
    const message = messages?.[0];

    if (!message) {
      continue;
    }

    form.setError(
      fieldName as FieldPath<StudentProfileFormValues>,
      {
        message,
        type: "server",
      },
    );
  }
}
