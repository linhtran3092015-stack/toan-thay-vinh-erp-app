"use client";

import Link from "next/link";
import { Fragment, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Label } from "@/components/ui/field";
import type {
  StudentDuplicateLinkedStudent,
  StudentDuplicateLookupResult,
} from "@/features/students/form/student-form-action-types";
import { cn } from "@/lib/utils";

export type SuccessfulDuplicateLookup = Extract<StudentDuplicateLookupResult, { ok: true }>;

/** Props a `ProfileField` hands its control: the field id and the aria wiring of its hint or error. */
export interface ProfileControlProps {
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  id: string;
}

/**
 * Label on top, control, then the hint or (instead of it) the error, 12px.
 * The control id is the form field name, so the hint/error ids
 * (`{name}-hint`, `{name}-error`) and "focus the first invalid field" can rely
 * on it. The required asterisk is CSS on the label (clean accessible name).
 */
export function ProfileField({
  children,
  className,
  error,
  hint,
  label,
  name,
  required,
}: {
  children: (props: ProfileControlProps) => ReactNode;
  className?: string;
  error?: string;
  hint?: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      {children({ "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}), id: name })}
      {error ? (
        <p className="text-caption font-medium text-danger" id={`${name}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-text-muted" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Single choice drawn as a segmented control (design 17a "Hình thức đăng ký"):
 * a `radiogroup` of `radio` buttons with `aria-checked`, one tab stop on the
 * checked option, arrow keys (and Home/End) move and select. The group is
 * labelled by a visible caption with the same look as a field label;
 * `controlRef` receives the button that takes focus (the form's "focus this
 * field").
 */
export function SegmentedRadioGroup<T extends string>({
  controlRef,
  describedBy,
  id,
  invalid,
  label,
  onBlur,
  onChange,
  options,
  required,
  value,
}: {
  controlRef?: (element: HTMLButtonElement | null) => void;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  label: string;
  onBlur?: () => void;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  required?: boolean;
  value: T | undefined;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = checkedIndex === -1 ? 0 : checkedIndex;
  const labelId = `${id}-label`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    optionRefs.current[next]?.focus();
  };

  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <span
        className={cn(
          "text-label font-medium text-text-strong",
          required && "after:ml-0.5 after:text-danger after:content-['*']",
        )}
        id={labelId}
      >
        {label}
      </span>
      {/* The 1px border sits outside the options: each option itself is 44px tall below md, 40px from md. */}
      <div
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-labelledby={labelId}
        aria-required={required || undefined}
        className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-border-strong aria-[invalid=true]:border-danger"
        id={id}
        role="radiogroup"
      >
        {options.map((option, index) => {
          const checked = index === checkedIndex;
          return (
            <button
              aria-checked={checked}
              className={cn(
                "min-h-11 min-w-0 truncate px-2 text-control transition-colors duration-150 disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus md:min-h-10",
                index > 0 && "border-l border-border-strong",
                checked
                  ? "bg-surface-selected font-semibold text-action-primary"
                  : "bg-surface-base font-normal text-text-default hover:bg-interactive-hover",
              )}
              key={option.value}
              onBlur={onBlur}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              ref={(element) => {
                optionRefs.current[index] = element;
                if (index === focusIndex) controlRef?.(element);
              }}
              role="radio"
              tabIndex={index === focusIndex ? 0 : -1}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type LinkClickHandler = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

/** "A (TV-…), B (TV-…) và C (TV-…)", each a link to the student's profile. */
function StudentLinks({
  onLinkClick,
  studentHref,
  students,
}: {
  onLinkClick: LinkClickHandler;
  studentHref: (studentId: string) => string;
  students: readonly StudentDuplicateLinkedStudent[];
}) {
  return students.map((student, index) => {
    const href = studentHref(student.id);
    const separator = index === 0 ? null : index === students.length - 1 ? " và " : ", ";
    return (
      <Fragment key={student.id}>
        {separator}
        <Link
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={href}
          onClick={(event) => onLinkClick(event, href)}
        >
          {student.fullName} ({student.publicCode})
        </Link>
      </Fragment>
    );
  });
}

/**
 * Result of the duplicate lookup, inside "Phụ huynh chính" (truthful to the
 * RPCs, map F4):
 * - no guardian with this phone → success line;
 * - an exact duplicate (same name, birth year and guardian phone) → danger,
 *   saving then needs the reason in "Xác nhận tiếp tục lưu";
 * - the phone of the student's own primary guardian (edit, phone unchanged) →
 *   info: saving updates that guardian with what was typed;
 * - any other existing guardian → warning: saving links that guardian and
 *   ignores the guardian details typed here.
 */
export function DuplicateLookupNotices({
  currentStudentId,
  isOwnGuardian,
  onLinkClick,
  result,
  studentHref,
}: {
  /** The student being edited (edit mode): never listed as a sibling. */
  currentStudentId?: string;
  isOwnGuardian: boolean;
  onLinkClick: LinkClickHandler;
  result: SuccessfulDuplicateLookup;
  studentHref: (studentId: string) => string;
}) {
  const { guardian } = result;

  if (!guardian) {
    return <ResultBanner title="Không tìm thấy phụ huynh hoặc học sinh trùng theo số điện thoại này." tone="success" />;
  }

  const exactDuplicates = guardian.children.filter((student) => student.isExactDuplicate);
  const linkedStudents = guardian.children.filter((student) => student.id !== currentStudentId);
  const links = (students: readonly StudentDuplicateLinkedStudent[]) => (
    <StudentLinks onLinkClick={onLinkClick} studentHref={studentHref} students={students} />
  );

  return (
    <div className="grid gap-3">
      {result.hasExactStudentDuplicate && exactDuplicates.length > 0 ? (
        <ResultBanner title="Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh:" tone="danger">
          {" "}
          {links(exactDuplicates)}. Cần nhập lý do ở mục “Xác nhận tiếp tục lưu” để vẫn lưu.
        </ResultBanner>
      ) : null}
      {isOwnGuardian ? (
        <ResultBanner title={`Số điện thoại của phụ huynh chính hiện tại: ${guardian.fullName}`} tone="info">
          . Khi lưu, hồ sơ phụ huynh này được cập nhật theo thông tin vừa nhập
          {linkedStudents.length > 0 ? <> (dùng chung với {links(linkedStudents)})</> : null}.
        </ResultBanner>
      ) : (
        <ResultBanner title={`Số điện thoại này đã thuộc phụ huynh ${guardian.fullName}`} tone="warning">
          {linkedStudents.length > 0 ? <> của {links(linkedStudents)}</> : null}. Khi lưu, hồ sơ phụ huynh hiện có được
          dùng lại; thông tin phụ huynh vừa nhập không ghi đè hồ sơ đó.
        </ResultBanner>
      )}
    </div>
  );
}
