"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { FormSection } from "@/components/patterns/form-with-toc";
import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
  ClassLearningLevel,
  ClassLearningMode,
} from "@/features/classes/read-models";
import { formatLearningMode } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ClassFormActionOverrides } from "./class-form-action-overrides";

interface ClassFormPageProps {
  academicYears: AcademicYearManagementItem[];
  classDetail?: ClassDetailReadModel;
  directoryQuery?: string;
  /** /dev preview seam: replaces the real server actions. */
  actions?: ClassFormActionOverrides;
  /** /dev preview and test seeding: a server answer already on screen. */
  initialActionState?: ClassManagementActionState;
  /** /dev preview and test seeding: an update reason already typed (edit only). */
  initialReason?: string;
  /** /dev preview and test seeding: values already typed over the defaults. */
  initialValues?: Partial<ClassWriteFields>;
}

const LEVEL_OPTIONS: ReadonlyArray<{ label: string; value: ClassLearningLevel }> = [
  { label: "A — Nâng cao", value: "A" },
  { label: "B — Cơ bản", value: "B" },
  { label: "CLC — Chất lượng cao", value: "CLC" },
];

const LEARNING_MODE_OPTIONS: readonly ClassLearningMode[] = ["offline", "online", "hybrid"];

const NO_OPEN_YEAR_REASON = "Cần có năm học đang mở để tạo lớp.";
const MISSING_UPDATE_REASON = "Nhập lý do cập nhật để lưu thay đổi.";

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

function withQuery(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * /classes/new and /classes/[classId]/edit (design 17b, left panel without
 * the weekly-schedule editor): "Thông tin lớp" in a 6-column grid, a "Lịch
 * tuần" section that says where the schedule is set up (a new class is a
 * draft and a schedule needs an active class), the update reason in edit,
 * then one inline action row: "Hủy" back where the user came from and the
 * page's only primary. Server field errors sit under their control
 * (aria-invalid + aria-describedby); the server message sits by the buttons.
 */
export function ClassFormPage({
  academicYears,
  classDetail,
  directoryQuery = "",
  actions,
  initialActionState,
  initialReason = "",
  initialValues,
}: ClassFormPageProps) {
  const router = useRouter();
  const createClass = actions?.createClass ?? createClassAction;
  const updateClass = actions?.updateClass ?? updateClassAction;

  const [isPending, startTransition] =
    useTransition();

  const [values, setValues] = useState<
    ClassWriteFields
  >(() => ({
    ...createInitialValues(
      academicYears,
      classDetail,
    ),
    ...initialValues,
  }));

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialActionState ?? initialClassManagementActionState,
    );

  const [reason, setReason] = useState(initialReason);

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
        ? await updateClass({
            ...values,
            classId: classDetail.id,
            reason,
          })
        : await createClass(values);

      setActionState(result);

      if (
        result.status === "success" &&
        result.redirectTo
      ) {
        router.push(withQuery(result.redirectTo, directoryQuery));
        router.refresh();
      }
    });
  };

  const hasAcademicYears =
    academicYears.length > 0;
  const backHref = classDetail
    ? withQuery(`/classes/${classDetail.id}`, directoryQuery)
    : withQuery("/classes", directoryQuery);
  const saveBlockReason = !hasAcademicYears && !classDetail
    ? NO_OPEN_YEAR_REASON
    : classDetail && reason.trim().length === 0
      ? MISSING_UPDATE_REASON
      : null;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-5">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ variant: "ghost" })} href={backHref}>
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            {classDetail ? "Quay lại chi tiết lớp" : "Quay lại danh sách lớp"}
          </Link>
        }
        title={classDetail ? "Chỉnh sửa lớp học" : "Tạo lớp"}
      >
        <p className="mt-1 text-secondary text-text-muted">
          {classDetail
            ? `Lớp ${classDetail.code} — ${classDetail.name}. Sau khi lớp đã có lịch hoặc học sinh ghi danh, không thể đổi năm học, mã lớp, khối hoặc trình độ.`
            : "Lớp mới ở trạng thái Nháp cho đến khi kích hoạt."}
        </p>
      </PageHeader>

      {!hasAcademicYears && !classDetail ? (
        <ResultBanner
          action={<Link href="/classes/academic-years">Đi tới quản lý năm học</Link>}
          description="Cần tạo hoặc kích hoạt năm học trước khi tạo lớp."
          title="Chưa có năm học đang mở"
          tone="warning"
        />
      ) : null}

      <form className="grid min-w-0 gap-5" onSubmit={handleSubmit}>
        <FormSection id="thong-tin" title="Thông tin lớp">
          <div className="grid items-start gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-6">
            <Field className="sm:col-span-2 lg:col-span-4" error={getFieldError("name")} label="Tên lớp" required>
              {(control) => (
                <Input
                  {...control}
                  disabled={isPending}
                  maxLength={200}
                  onChange={(event) => updateValue("name", event.target.value)}
                  placeholder="Ví dụ: Toán 5 nâng cao"
                  required
                  value={values.name}
                />
              )}
            </Field>

            <Field className="lg:col-span-2" error={getFieldError("code")} label="Mã lớp" required>
              {(control) => (
                <Input
                  {...control}
                  autoCapitalize="characters"
                  disabled={isPending}
                  maxLength={100}
                  onChange={(event) => updateValue("code", event.target.value.toUpperCase())}
                  placeholder="Ví dụ: 5A1"
                  required
                  spellCheck={false}
                  value={values.code}
                />
              )}
            </Field>

            <Field className="lg:col-span-2" error={getFieldError("academicYearId")} label="Năm học" required>
              {(control) => (
                <Select
                  {...control}
                  disabled={isPending || !hasAcademicYears}
                  onChange={(event) => updateValue("academicYearId", event.target.value)}
                  required
                  value={values.academicYearId}
                >
                  {academicYears.map((academicYear) => (
                    <option key={academicYear.id} value={academicYear.id}>
                      {academicYear.code} — {academicYear.name}
                      {academicYear.isCurrent ? " (hiện tại)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field className="lg:col-span-1" error={getFieldError("grade")} label="Khối">
              {(control) => (
                <Select
                  {...control}
                  disabled={isPending}
                  onChange={(event) => updateValue("grade", Number(event.target.value))}
                  value={values.grade}
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Khối {index + 1}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field className="lg:col-span-1" error={getFieldError("level")} label="Trình độ">
              {(control) => (
                <Select
                  {...control}
                  disabled={isPending}
                  onChange={(event) => updateValue("level", event.target.value as ClassLearningLevel)}
                  value={values.level}
                >
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field className="lg:col-span-2" error={getFieldError("defaultLearningMode")} label="Hình thức mặc định">
              {(control) => (
                <Select
                  {...control}
                  disabled={isPending}
                  onChange={(event) => updateValue("defaultLearningMode", event.target.value as ClassLearningMode)}
                  value={values.defaultLearningMode}
                >
                  {LEARNING_MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {formatLearningMode(mode)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              className="lg:col-span-2"
              error={getFieldError("weeklySessionCount")}
              hint="Giới hạn số dòng lịch tuần đang hiệu lực"
              label="Số buổi mỗi tuần"
            >
              {(control) => (
                <Select
                  {...control}
                  disabled={isPending}
                  onChange={(event) => updateValue("weeklySessionCount", Number(event.target.value))}
                  value={values.weeklySessionCount}
                >
                  {Array.from({ length: 7 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1} buổi/tuần
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field className="sm:col-span-2 lg:col-span-6" error={getFieldError("classinUrl")} label="Đường dẫn ClassIn">
              {(control) => (
                <Input
                  {...control}
                  disabled={isPending}
                  onChange={(event) => updateValue("classinUrl", event.target.value)}
                  placeholder="Chỉ cần cho lớp trực tuyến hoặc kết hợp"
                  type="url"
                  value={values.classinUrl}
                />
              )}
            </Field>

            <Field className="sm:col-span-2 lg:col-span-6" error={getFieldError("notes")} label="Ghi chú">
              {(control) => (
                <Textarea
                  {...control}
                  className="min-h-28 resize-y"
                  disabled={isPending}
                  maxLength={10000}
                  onChange={(event) => updateValue("notes", event.target.value)}
                  placeholder="Thông tin nội bộ về lớp học"
                  value={values.notes}
                />
              )}
            </Field>
          </div>
        </FormSection>

        <ClassScheduleNextSteps classDetail={classDetail} directoryQuery={directoryQuery} />

        {classDetail ? (
          <FormSection
            description="Lý do được ghi vào nhật ký thao tác của lớp."
            id="ly-do"
            title="Lý do thao tác"
          >
            <Field error={getFieldError("reason")} label="Lý do cập nhật" required>
              {(control) => (
                <Textarea
                  {...control}
                  className="min-h-24 resize-y"
                  disabled={isPending}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Nhập lý do thay đổi thông tin lớp"
                  required
                  value={reason}
                />
              )}
            </Field>
          </FormSection>
        ) : null}

        <div className="grid gap-3">
          {actionState.message ? (
            <ResultBanner
              title={actionState.message}
              tone={actionState.status === "error" ? "error" : "success"}
            />
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-end">
            <Link className={getButtonClassName({ variant: "secondary" })} href={backHref}>
              Hủy
            </Link>
            <Button
              disabled={isPending || saveBlockReason !== null}
              disabledReason={saveBlockReason ?? undefined}
              isLoading={isPending}
              type="submit"
            >
              {isPending ? "Đang lưu…" : classDetail ? "Lưu thay đổi" : "Lưu lớp (Nháp)"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

const NEXT_STEPS = [
  "Lưu lớp (Nháp)",
  "Kích hoạt lớp",
  "Thiết lập lịch tuần",
  "Tạo buổi hàng loạt",
] as const;

/**
 * "Lịch tuần" (design 17b): the schedule cannot be saved with the class (a
 * new class is a draft; a weekly slot needs an active class and starts from
 * today), so the section says where it is set up instead of offering an
 * editor. In edit, the steps the class has passed say so, step 3 links to
 * the class page and step 4 to the batch tool once the class is active (the
 * tool only lists active classes).
 */
function ClassScheduleNextSteps({
  classDetail,
  directoryQuery,
}: {
  classDetail?: ClassDetailReadModel;
  directoryQuery: string;
}) {
  const isActive = classDetail?.status === "active";
  const done = [Boolean(classDetail), isActive, false, false];
  const links: ReadonlyArray<string | null> = [
    null,
    null,
    classDetail ? withQuery(`/classes/${classDetail.id}`, directoryQuery) : null,
    classDetail && isActive ? `/sessions/batch?classId=${classDetail.id}` : null,
  ];

  return (
    <FormSection id="lich-tuan" title="Lịch tuần">
      <div className="grid gap-4">
        <p className="text-body text-text-default">
          Lịch tuần được thiết lập trên trang lớp sau khi kích hoạt lớp.
          {classDetail
            ? ` Hiện lớp có ${classDetail.activeScheduleCount} dòng lịch tuần đang hiệu lực.`
            : null}
        </p>
        <ol aria-label="Các bước tiếp theo" className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {NEXT_STEPS.map((label, index) => {
            const href = links[index];
            return (
              <li
                className={cn(
                  "flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-3 py-2 text-body",
                  done[index]
                    ? "border-success-border bg-success-bg text-success-ink"
                    : "border-border-subtle bg-surface-sunken text-text-default",
                )}
                key={label}
              >
                <span className="tabular-nums">{index + 1}.</span>
                {href ? (
                  <Link className="font-semibold text-action-link hover:underline" href={href}>
                    {label}
                  </Link>
                ) : (
                  <span>{label}</span>
                )}
                {done[index] ? (
                  <span className="inline-flex items-center gap-1 text-caption font-medium">
                    <Check aria-hidden="true" size={14} strokeWidth={2.5} />
                    đã xong
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </FormSection>
  );
}
