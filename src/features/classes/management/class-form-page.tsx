"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import {
  createClassAction,
  updateClassAction,
} from "@/features/classes/actions/class-actions";
import type {
  ClassManagementActionState,
  ClassWriteFields,
} from "@/features/classes/forms/class-action-types";
import { initialClassManagementActionState } from "@/features/classes/forms/class-action-types";
import type {
  AcademicYearManagementItem,
  ClassDetailReadModel,
} from "@/features/classes/read-models";

interface ClassFormPageProps {
  academicYears: AcademicYearManagementItem[];
  classDetail?: ClassDetailReadModel;
  directoryQuery?: string;
}

function createInitialValues(
  academicYears: AcademicYearManagementItem[],
  classDetail?: ClassDetailReadModel,
): ClassWriteFields {
  if (classDetail) {
    return {
      academicYearId:
        classDetail.academicYear?.id ?? "",
      classinUrl: classDetail.classinUrl ?? "",
      code: classDetail.code,
      defaultLearningMode:
        classDetail.defaultLearningMode,
      grade: classDetail.grade,
      level: classDetail.level,
      name: classDetail.name,
      notes: classDetail.notes ?? "",
      weeklySessionCount:
        classDetail.weeklySessionCount,
    };
  }

  const selectedAcademicYear =
    academicYears.find(
      (academicYear) => academicYear.isCurrent,
    ) ?? academicYears[0];

  return {
    academicYearId:
      selectedAcademicYear?.id ?? "",
    classinUrl: "",
    code: "",
    defaultLearningMode: "hybrid",
    grade: 1,
    level: "A",
    name: "",
    notes: "",
    weeklySessionCount: 2,
  };
}

export function ClassFormPage({
  academicYears,
  classDetail,
  directoryQuery = "",
}: ClassFormPageProps) {
  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [values, setValues] = useState<
    ClassWriteFields
  >(() =>
    createInitialValues(
      academicYears,
      classDetail,
    ),
  );

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialClassManagementActionState,
    );

  const [reason, setReason] = useState("");

  const getFieldError = (
    fieldName: string,
  ): string | undefined =>
    actionState.fieldErrors?.[fieldName]?.[0];

  const updateValue = <
    Key extends keyof ClassWriteFields,
  >(
    key: Key,
    value: ClassWriteFields[Key],
  ): void => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    startTransition(async () => {
      const result = classDetail
        ? await updateClassAction({
            ...values,
            classId: classDetail.id,
            reason,
          })
        : await createClassAction(values);

      setActionState(result);

      if (
        result.status === "success" &&
        result.redirectTo
      ) {
        router.push(directoryQuery ? `${result.redirectTo}?${directoryQuery}` : result.redirectTo);
        router.refresh();
      }
    });
  };

  const hasAcademicYears =
    academicYears.length > 0;

  return (
    <main className="mx-auto grid max-w-4xl gap-6">
      <div className="grid gap-3">
        <Link className="inline-flex w-fit items-center gap-2 text-secondary font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={classDetail ? `/classes/${classDetail.id}${directoryQuery ? `?${directoryQuery}` : ""}` : `/classes${directoryQuery ? `?${directoryQuery}` : ""}`}>
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          {classDetail ? "Quay lại chi tiết lớp" : "Quay lại danh sách lớp"}
        </Link>
        <PageHeader title={classDetail ? "Chỉnh sửa lớp học" : "Tạo lớp học"} />
        <p className="text-secondary text-text-muted">
          {classDetail
            ? "Cập nhật thông tin vận hành của lớp. Database sẽ chặn thay đổi danh tính sau khi lớp đã có lịch hoặc enrollment."
            : "Lớp mới sẽ được tạo ở trạng thái nháp. Sau đó có thể thiết lập lịch và kích hoạt lớp."}
        </p>
      </div>

      {!hasAcademicYears && !classDetail ? (
        <section className="rounded-lg border border-warning-border bg-warning-bg p-5">
          <h2 className="font-semibold text-warning">
            Chưa có năm học đang mở
          </h2>

          <p className="mt-1 text-sm text-text-strong">
            Cần tạo hoặc kích hoạt năm học trước
            khi tạo lớp.
          </p>

          <Link
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-warning-border bg-surface-base px-4 text-sm font-semibold text-warning"
            href="/classes/academic-years"
          >
            Đi tới quản lý năm học
          </Link>
        </section>
      ) : null}

      <form
        className="grid gap-6 rounded-lg border border-border-subtle bg-surface-base p-5"
        onSubmit={handleSubmit}
      >
        <section className="grid gap-4 md:grid-cols-2">
          <FormField
            error={getFieldError(
              "academicYearId",
            )}
            label="Năm học"
          >
            <select
              className={inputClassName}
              disabled={
                isPending ||
                !hasAcademicYears
              }
              onChange={(event) =>
                updateValue(
                  "academicYearId",
                  event.target.value,
                )
              }
              required
              value={values.academicYearId}
            >
              {academicYears.map(
                (academicYear) => (
                  <option
                    key={academicYear.id}
                    value={academicYear.id}
                  >
                    {academicYear.code}
                    {" — "}
                    {academicYear.name}
                    {academicYear.isCurrent
                      ? " (Hiện tại)"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </FormField>

          <FormField
            error={getFieldError("code")}
            label="Mã lớp"
          >
            <input
              className={inputClassName}
              disabled={isPending}
              maxLength={100}
              onChange={(event) =>
                updateValue(
                  "code",
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="Ví dụ: 5A1"
              required
              value={values.code}
            />
          </FormField>

          <FormField
            error={getFieldError("name")}
            label="Tên lớp"
          >
            <input
              className={inputClassName}
              disabled={isPending}
              maxLength={200}
              onChange={(event) =>
                updateValue(
                  "name",
                  event.target.value,
                )
              }
              placeholder="Ví dụ: Toán 5 nâng cao"
              required
              value={values.name}
            />
          </FormField>

          <FormField
            error={getFieldError("grade")}
            label="Khối"
          >
            <select
              className={inputClassName}
              disabled={isPending}
              onChange={(event) =>
                updateValue(
                  "grade",
                  Number(event.target.value),
                )
              }
              value={values.grade}
            >
              {Array.from({
                length: 12,
              }).map((_, index) => (
                <option
                  key={index + 1}
                  value={index + 1}
                >
                  Khối {index + 1}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={getFieldError("level")}
            label="Trình độ"
          >
            <select
              className={inputClassName}
              disabled={isPending}
              onChange={(event) =>
                updateValue(
                  "level",
                  event.target.value as
                    | "A"
                    | "B"
                    | "CLC",
                )
              }
              value={values.level}
            >
              <option value="A">
                A — Nâng cao
              </option>
              <option value="B">
                B — Cơ bản
              </option>
              <option value="CLC">
                CLC — Chất lượng cao
              </option>
            </select>
          </FormField>

          <FormField
            error={getFieldError(
              "weeklySessionCount",
            )}
            label="Số buổi mỗi tuần"
          >
            <select
              className={inputClassName}
              disabled={isPending}
              onChange={(event) =>
                updateValue(
                  "weeklySessionCount",
                  Number(event.target.value),
                )
              }
              value={values.weeklySessionCount}
            >
              {Array.from({
                length: 7,
              }).map((_, index) => (
                <option
                  key={index + 1}
                  value={index + 1}
                >
                  {index + 1} buổi/tuần
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={getFieldError(
              "defaultLearningMode",
            )}
            label="Hình thức mặc định"
          >
            <select
              className={inputClassName}
              disabled={isPending}
              onChange={(event) =>
                updateValue(
                  "defaultLearningMode",
                  event.target.value as
                    | "online"
                    | "offline"
                    | "hybrid",
                )
              }
              value={
                values.defaultLearningMode
              }
            >
              <option value="offline">
                Offline
              </option>
              <option value="online">
                Online
              </option>
              <option value="hybrid">
                Kết hợp
              </option>
            </select>
          </FormField>

          <FormField
            error={getFieldError(
              "classinUrl",
            )}
            label="Đường dẫn ClassIn"
          >
            <input
              className={inputClassName}
              disabled={isPending}
              onChange={(event) =>
                updateValue(
                  "classinUrl",
                  event.target.value,
                )
              }
              placeholder="Có thể để trống"
              type="url"
              value={values.classinUrl}
            />
          </FormField>
        </section>

        <FormField
          error={getFieldError("notes")}
          label="Ghi chú"
        >
          <textarea
            className={`${inputClassName} min-h-28 resize-y py-3`}
            disabled={isPending}
            maxLength={10000}
            onChange={(event) =>
              updateValue(
                "notes",
                event.target.value,
              )
            }
            placeholder="Thông tin nội bộ về lớp học"
            value={values.notes}
          />
        </FormField>

        {classDetail ? (
          <FormField
            error={getFieldError("reason")}
            label="Lý do cập nhật"
          >
            <textarea
              className={`${inputClassName} min-h-24 resize-y py-3`}
              disabled={isPending}
              maxLength={2000}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder="Nhập lý do thay đổi thông tin lớp"
              required
              value={reason}
            />
          </FormField>
        ) : null}

      {actionState.message ? <ResultBanner title={actionState.message} tone={actionState.status === "error" ? "error" : "success"} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-hairline bg-surface-base px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
            href={
              classDetail
                ? `/classes/${classDetail.id}`
                : "/classes"
            }
          >
            Hủy
          </Link>

          <Button
            disabled={
              isPending ||
              (!hasAcademicYears &&
                !classDetail) ||
              Boolean(
                classDetail &&
                  reason.trim().length === 0,
              )
            }
            type="submit"
          >
            {isPending
              ? classDetail
                ? "Đang lưu..."
                : "Đang tạo lớp..."
              : classDetail
                ? "Lưu thay đổi"
                : "Tạo lớp"}
          </Button>
        </div>
      </form>
    </main>
  );
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

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-surface-base px-3 text-sm font-normal text-ink outline-none transition focus:border-action-primary focus:ring-[3px] focus:ring-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";
