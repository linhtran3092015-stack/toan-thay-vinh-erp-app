"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  };

  const hasAcademicYears =
    academicYears.length > 0;

  return (
    <main className="mx-auto grid max-w-4xl gap-6">
      <header className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <Link
          className="text-sm font-semibold text-secondary hover:underline"
          href={
            classDetail
              ? `/classes/${classDetail.id}`
              : "/classes"
          }
        >
          ← {classDetail
            ? "Quay lại chi tiết lớp"
            : "Quay lại danh sách lớp"}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-ink">
          {classDetail
            ? "Chỉnh sửa lớp học"
            : "Tạo lớp học"}
        </h1>

        <p className="mt-1 text-sm text-ink-muted">
          {classDetail
            ? "Cập nhật thông tin vận hành của lớp. Database sẽ chặn thay đổi danh tính sau khi lớp đã có lịch hoặc enrollment."
            : "Lớp mới sẽ được tạo ở trạng thái nháp. Sau đó có thể thiết lập lịch và kích hoạt lớp."}
        </p>
      </header>

      {!hasAcademicYears && !classDetail ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">
            Chưa có năm học đang mở
          </h2>

          <p className="mt-1 text-sm text-amber-800">
            Cần tạo hoặc kích hoạt năm học trước
            khi tạo lớp.
          </p>

          <Link
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900"
            href="/classes/academic-years"
          >
            Đi tới quản lý năm học
          </Link>
        </section>
      ) : null}

      <form
        className="grid gap-6 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card"
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

        {actionState.message ? (
          <div
            aria-live="polite"
            className={
              actionState.status === "error"
                ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
            }
          >
            {actionState.message}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
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
        <span className="text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const inputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";
