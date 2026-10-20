"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormSection } from "@/components/patterns/form-with-toc";
import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createClassAction,
  updateClassAction,
} from "@/features/classes/actions/class-actions";
import { LeaveConfirmDialog, useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
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
  /** The user holds sessions.manage: only then does step 4 link into /sessions/batch (edit route). */
  canManageSessions?: boolean;
  /** "Đi tới quản lý năm học" when no year is open; /dev previews pass a /dev page. */
  academicYearsHref?: string;
  /** Back link and "Hủy" (default: the class in edit, the list in create, with the directory query); /dev previews pass a /dev page. */
  cancelHref?: string;
  /** Step 3 "Thiết lập lịch tuần" in edit (default: the class with the directory query); /dev previews pass a /dev page. */
  classPageHref?: string;
  /** Step 4 "Tạo buổi hàng loạt" when it links (default: /sessions/batch for the class, without the class directory query). */
  batchHref?: string;
  /** /dev preview seam: replaces the real server actions. */
  actions?: ClassFormActionOverrides;
  /** /dev preview and test seeding: a server answer already on screen. */
  initialActionState?: ClassManagementActionState;
  /** /dev preview and test seeding: an update reason already typed (edit only); unsaved like a typed one. */
  initialReason?: string;
  /** /dev preview and test seeding: values already typed over the defaults; unsaved like typed ones. */
  initialValues?: Partial<ClassWriteFields>;
}

/** An in-form link click: asks before leaving while the form holds unsaved edits. */
type LinkClickHandler = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

const LEVEL_OPTIONS: ReadonlyArray<{ label: string; value: ClassLearningLevel }> = [
  { label: "A — Nâng cao", value: "A" },
  { label: "B — Cơ bản", value: "B" },
  { label: "CLC — Chất lượng cao", value: "CLC" },
];

const LEARNING_MODE_OPTIONS: readonly ClassLearningMode[] = ["offline", "online", "hybrid"];

const NO_OPEN_YEAR_REASON = "Cần có năm học đang mở để tạo lớp.";
const MISSING_UPDATE_REASON = "Nhập lý do cập nhật để lưu thay đổi.";
/** A rejected action (network, a deploy in between): said by the buttons, the typed values stay. */
const CONNECTION_ERROR_MESSAGE = "Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại.";

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

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Focuses the first control the server rejected, in page order (only server
 * field errors set aria-invalid here), after scrolling it to the middle of
 * the viewport; false when no rejected control is on the page.
 */
function focusFirstRejectedControl(form: HTMLFormElement | null): boolean {
  const control = form?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
  if (!control) return false;
  if (typeof control.scrollIntoView === "function") {
    control.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }
  control.focus({ preventScroll: true });
  return true;
}

/**
 * /classes/new and /classes/[classId]/edit (design 17b, left panel without
 * the weekly-schedule editor): "Thông tin lớp" in a 6-column grid, a "Lịch
 * tuần" section that says where the schedule is set up (a new class is a
 * draft and a schedule needs an active class), the update reason in edit,
 * then one inline action row: "Hủy" back where the user came from and the
 * page's only primary. Server field errors sit under their control
 * (aria-invalid + aria-describedby); the server message sits by the buttons.
 *
 * While a save runs every control is disabled, which drops focus to <body>.
 * When the save ends without leaving the page: server field errors focus the
 * first rejected control in page order; otherwise, if focus is still on
 * <body>, it goes back to the control the save started from (a field on
 * Enter, or the primary), or to the message by the buttons when that control
 * is gone or disabled. Focus the user moved elsewhere meanwhile stays put.
 *
 * Leave guard (as on the student form): while a value differs from the class
 * as the page opened it (or today's defaults) or a reason is typed, reload/close warns and the
 * page's own links (back, "Hủy", the no-year warning, the next steps) ask
 * before leaving; new-tab clicks pass through. While a save runs those links
 * wait for it, since the save navigates on its own.
 */
export function ClassFormPage({
  academicYears,
  classDetail,
  directoryQuery = "",
  canManageSessions = false,
  academicYearsHref = "/classes/academic-years",
  cancelHref,
  classPageHref,
  batchHref,
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

  // What the leave guard compares against, read once at mount like the form's own values: a
  // refresh that brings a colleague's edit of the class must not make an untouched form dirty.
  const [savedValues] = useState<ClassWriteFields>(() =>
    createInitialValues(academicYears, classDetail),
  );

  const [values, setValues] = useState<
    ClassWriteFields
  >(() => ({
    ...savedValues,
    ...initialValues,
  }));

  const [actionState, setActionState] =
    useState<ClassManagementActionState>(
      initialActionState ?? initialClassManagementActionState,
    );

  const [reason, setReason] = useState(initialReason);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  /** Focusable wrapper of the message by the buttons: where focus goes when the control it left is gone or disabled. */
  const messageRef = useRef<HTMLDivElement>(null);
  /** The control inside the form that had focus when the save started (a field on Enter, or the primary). */
  const focusBeforeSave = useRef<HTMLElement | null>(null);
  /** The answer of a save that ended on this page; focus follows it once the form is enabled again. */
  const unsavedResult = useRef<ClassManagementActionState | null>(null);

  // Runs after the commit that re-enables the controls and renders the answer (aria-invalid, the message).
  useEffect(() => {
    const result = unsavedResult.current;
    if (isPending || !result || actionState !== result) return;
    const before = focusBeforeSave.current;
    unsavedResult.current = null;
    focusBeforeSave.current = null;
    if (result.fieldErrors && focusFirstRejectedControl(formRef.current)) return;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    if (before?.isConnected && !before.matches(":disabled")) {
      before.focus();
    } else {
      messageRef.current?.focus();
    }
  }, [actionState, isPending]);

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
    const active = document.activeElement;
    focusBeforeSave.current =
      active instanceof HTMLElement && event.currentTarget.contains(active) ? active : null;
    unsavedResult.current = null;

    startTransition(async () => {
      let result: ClassManagementActionState;
      try {
        result = classDetail
          ? await updateClass({
              ...values,
              classId: classDetail.id,
              reason,
            })
          : await createClass(values);
      } catch {
        // Without this the rejection reaches the error boundary and the typed form is lost.
        result = { message: CONNECTION_ERROR_MESSAGE, status: "error" };
      }

      // Focus follows an answer that keeps the user on this page (the effect above).
      unsavedResult.current = result.status === "success" && result.redirectTo ? null : result;
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

  // Seeded values (/dev preview) count as typed, as on the student form.
  const isDirty =
    reason.length > 0 ||
    (Object.keys(savedValues) as Array<keyof ClassWriteFields>).some((key) => values[key] !== savedValues[key]);

  useLeaveGuard(isDirty && !isPending);
  useSaveInFlightGuard(isPending);

  /** Plain left clicks on in-form links ask first while there are unsaved edits; new-tab clicks pass through. */
  const onGuardedLinkClick: LinkClickHandler = (event, href) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (isPending) {
      // Leaving mid-save would let the save navigate afterwards; wait for it.
      event.preventDefault();
      return;
    }
    if (!isDirty) return;
    event.preventDefault();
    setLeaveHref(href);
  };

  const hasAcademicYears =
    academicYears.length > 0;
  const backHref = cancelHref ?? (classDetail
    ? withQuery(`/classes/${classDetail.id}`, directoryQuery)
    : withQuery("/classes", directoryQuery));
  const saveBlockReason = !hasAcademicYears && !classDetail
    ? NO_OPEN_YEAR_REASON
    : classDetail && reason.trim().length === 0
      ? MISSING_UPDATE_REASON
      : null;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-5">
      <PageHeader
        actions={
          <Link
            className={getButtonClassName({ className: "max-md:h-11", variant: "ghost" })}
            href={backHref}
            onClick={(event) => onGuardedLinkClick(event, backHref)}
          >
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
          action={
            // 44px target below md; inline text from md.
            <Link
              className="inline-flex min-h-11 items-center md:min-h-0"
              href={academicYearsHref}
              onClick={(event) => onGuardedLinkClick(event, academicYearsHref)}
            >
              Đi tới quản lý năm học
            </Link>
          }
          description="Cần tạo hoặc kích hoạt năm học trước khi tạo lớp."
          title="Chưa có năm học đang mở"
          tone="warning"
        />
      ) : null}

      <form className="grid min-w-0 gap-5" onSubmit={handleSubmit} ref={formRef}>
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

            <Field className="lg:col-span-3" error={getFieldError("academicYearId")} label="Năm học" required>
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

            <Field className="lg:col-span-2" error={getFieldError("level")} label="Trình độ">
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

            <Field className="lg:col-span-3" error={getFieldError("defaultLearningMode")} label="Hình thức mặc định">
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
              className="lg:col-span-3"
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

        <ClassScheduleNextSteps
          batchHref={batchHref}
          canManageSessions={canManageSessions}
          classDetail={classDetail}
          classPageHref={classPageHref}
          directoryQuery={directoryQuery}
          onLinkClick={onGuardedLinkClick}
        />

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
            <div
              className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              ref={messageRef}
              tabIndex={-1}
            >
              <ResultBanner
                title={actionState.message}
                tone={actionState.status === "error" ? "error" : "success"}
              />
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-end">
            <Link
              className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })}
              href={backHref}
              onClick={(event) => onGuardedLinkClick(event, backHref)}
            >
              Hủy
            </Link>
            <Button
              className="max-md:h-11"
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

      <LeaveConfirmDialog
        isOpen={leaveHref !== null}
        onLeave={() => {
          const href = leaveHref;
          setLeaveHref(null);
          if (href) router.push(href);
        }}
        onStay={() => setLeaveHref(null)}
      />
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
 * the class page, and step 4 links to the batch tool under the class detail
 * page's own rule: an active class, not a composite parent, and a user with
 * sessions.manage (the tool only lists active classes and its route denies
 * everyone else). A composite parent ("lớp ghép") holds neither schedules nor
 * sessions — the database rejects both — so steps 3 and 4 stay plain text
 * and the section says they belong to the component classes.
 */
function ClassScheduleNextSteps({
  batchHref,
  canManageSessions,
  classDetail,
  classPageHref,
  directoryQuery,
  onLinkClick,
}: {
  batchHref?: string;
  canManageSessions: boolean;
  classDetail?: ClassDetailReadModel;
  classPageHref?: string;
  directoryQuery: string;
  onLinkClick: LinkClickHandler;
}) {
  const isActive = classDetail?.status === "active";
  const components = classDetail?.componentClasses ?? [];
  const isCompositeParent = components.length > 0;
  const done = [Boolean(classDetail), isActive, false, false];
  const links: ReadonlyArray<string | null> = [
    null,
    null,
    classDetail && !isCompositeParent
      ? (classPageHref ?? withQuery(`/classes/${classDetail.id}`, directoryQuery))
      : null,
    classDetail && isActive && !isCompositeParent && canManageSessions
      ? // The batch tool reads the session directory's params, never the class directory's.
        (batchHref ?? `/sessions/batch?classId=${classDetail.id}`)
      : null,
  ];

  return (
    <FormSection id="lich-tuan" title="Lịch tuần">
      <div className="grid gap-4">
        {isCompositeParent ? (
          <p className="text-body text-text-default">
            Lớp ghép không có lịch riêng. Lịch tuần và buổi học thuộc các lớp thành phần:{" "}
            {components.map((component) => component.code).join(", ")}.
          </p>
        ) : (
          <p className="text-body text-text-default">
            Lịch tuần được thiết lập trên trang lớp sau khi kích hoạt lớp.
            {classDetail
              ? ` Hiện lớp có ${classDetail.activeScheduleCount} dòng lịch tuần đang hiệu lực.`
              : null}
          </p>
        )}
        <ol aria-label="Các bước tiếp theo" className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {NEXT_STEPS.map((label, index) => {
            const href = links[index];
            return (
              <li
                className={cn(
                  "flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-3 text-body",
                  done[index]
                    ? "border-success-border bg-success-bg text-success-ink"
                    : "border-border-subtle bg-surface-sunken text-text-default",
                )}
                key={label}
              >
                <span className="tabular-nums">{index + 1}.</span>
                {href ? (
                  // The whole rest of the row is the link: a 44px target on every width.
                  <Link
                    className="flex min-h-11 flex-1 items-center font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={href}
                    onClick={(event) => onLinkClick(event, href)}
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="py-2">{label}</span>
                )}
                {done[index] ? (
                  <span className="inline-flex items-center gap-1 py-2 text-caption font-medium">
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
