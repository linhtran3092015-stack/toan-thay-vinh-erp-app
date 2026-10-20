"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control, type FieldErrors, type FieldPath } from "react-hook-form";

import { FormSection, FormWithToc } from "@/components/patterns/form-with-toc";
import { PageHeader } from "@/components/patterns/page-header";
import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { LeaveConfirmDialog, useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
import type { StudentFormActionOverrides } from "@/features/students/form/student-form-action-overrides";
import type {
  StudentDuplicateLookupResult,
  StudentFormActionState,
} from "@/features/students/form/student-form-action-types";
import {
  createStudentWithPrimaryGuardianAction,
  findStudentFormDuplicatesAction,
  updateStudentWithPrimaryGuardianAction,
} from "@/features/students/form/student-form-actions";
import {
  getStudentFormFieldLabel,
  getStudentFormTocItems,
  sortStudentFormFields,
  STUDENT_FORM_FIELD_ORDER,
  type StudentFormFieldName,
} from "@/features/students/form/student-form-toc";
import {
  getStudentLifecycleStatusLabel,
  toCreateStudentActionInput,
  toUpdateStudentActionInput,
  type StudentProfileFormMode,
} from "@/features/students/form/student-profile-form-helpers";
import {
  normalizeStudentProfilePhone,
  studentProfileFormSchema,
  type StudentProfileFormValues,
} from "@/features/students/form/student-profile-form-schema";

import {
  DuplicateLookupNotices,
  ProfileField,
  SegmentedRadioGroup,
  type SuccessfulDuplicateLookup,
} from "./student-profile-sections";

export interface StudentProfileFormProps {
  /** Dev previews only: inert stand-ins for the server actions (production passes nothing). */
  actions?: StudentFormActionOverrides;
  cancelHref: string;
  defaultValues: StudentProfileFormValues;
  /** Dev previews only: start with these unsaved edits on top of `defaultValues`. */
  initialDraft?: Partial<StudentProfileFormValues>;
  /** Dev previews only: a duplicate lookup already run for the starting values (draft included). */
  initialDuplicateLookup?: SuccessfulDuplicateLookup;
  /** Dev previews only: validate the starting values as after a submit attempt. */
  initialValidation?: boolean;
  lifecycleStatus?: string;
  mode: StudentProfileFormMode;
  returnQuery?: string;
  /** Profile link of a student named in the duplicate result; defaults to `/students/{id}` with the directory query. */
  studentHref?: (studentId: string) => string;
}

const duplicateFields: FieldPath<StudentProfileFormValues>[] = ["fullName", "birthYear", "guardianPhone"];

const registeredModeOptions = [
  { label: "Offline", value: "offline" },
  { label: "Online", value: "online" },
] as const;

const gradeOptions = Array.from({ length: 12 }, (_, index) => index + 1);

const LOOKUP_CONNECTION_ERROR = "Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.";
const SAVE_CONNECTION_ERROR = "Không thể kết nối tới hệ thống lưu hồ sơ. Vui lòng thử lại.";

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Focuses the field (its control's id is the field name; a radiogroup hands
 * focus to its checked radio). With `scroll`, first scrolls it to the middle
 * of the viewport, clear of the topbar and the save bar.
 */
function focusField(root: HTMLElement | null, name: string, scroll = true) {
  const element = root?.querySelector<HTMLElement>(`#${CSS.escape(name)}`);
  if (!element) return;
  const target =
    element.getAttribute("role") === "radiogroup"
      ? (element.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ?? element)
      : element;
  if (scroll && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }
  target.focus({ preventScroll: true });
}

/**
 * Focuses the first of these fields in page order (a selector list matches in
 * document order, not in the order of `names`); false when none is on the page.
 */
function focusFirstField(root: HTMLElement | null, names: readonly string[], scroll = true): boolean {
  if (!root || names.length === 0) return false;
  const first = root.querySelector<HTMLElement>(names.map((name) => `#${CSS.escape(name)}`).join(", "));
  if (!first) return false;
  focusField(root, first.id, scroll);
  return true;
}

/**
 * The table of contents around the sections. It is the only part of the form
 * that watches every field (each section's status follows what is typed);
 * the sections arrive as `children`, already rendered by the form, so a
 * keystroke re-renders the table of contents and not the fields.
 */
function StudentFormToc({
  children,
  control,
  errorFields,
  showDuplicateConfirmation,
}: {
  children: ReactNode;
  control: Control<StudentProfileFormValues>;
  errorFields: ReadonlySet<string>;
  showDuplicateConfirmation: boolean;
}) {
  const values = useWatch({ control });
  return <FormWithToc items={getStudentFormTocItems({ errorFields, showDuplicateConfirmation, values })}>{children}</FormWithToc>;
}

/**
 * Student create/edit form (design 17a): a long page with a table of contents
 * ("Hồ sơ", "Phụ huynh chính", "Xác nhận tiếp tục lưu" while an exact
 * duplicate is shown, "Lý do thao tác") and the always-visible save bar.
 *
 * Every save first runs the duplicate lookup; an exact duplicate needs a
 * reason before the write, typed for that duplicate (a reason is emptied once
 * its duplicate leaves the screen, and a save that finds another one asks
 * again). Create: "Lưu học sinh" opens the new profile,
 * "Lưu và thêm tiếp" stays here with an empty form and a link to the new
 * profile (same server action; only the client's next step differs). Edit:
 * "Lưu thay đổi" returns to the profile. An invalid submit, client-side or
 * rejected by the server, focuses the first invalid field in page order.
 * While a save runs the sections are disabled (what is typed then would be
 * lost); once it ends, focus the save took away (a disabled field or save
 * button) goes back to that control, or to the save error when the control is
 * gone or still disabled. Unsaved edits: Hủy, the header link and the profile
 * links ask before leaving; reload/close asks through the browser.
 */
export function StudentProfileForm({
  actions,
  cancelHref,
  defaultValues,
  initialDraft,
  initialDuplicateLookup,
  initialValidation = false,
  lifecycleStatus,
  mode,
  returnQuery,
  studentHref,
}: StudentProfileFormProps) {
  const findDuplicates = actions?.findStudentFormDuplicates ?? findStudentFormDuplicatesAction;
  const createStudent = actions?.createStudentWithPrimaryGuardian ?? createStudentWithPrimaryGuardianAction;
  const updateStudent = actions?.updateStudentWithPrimaryGuardian ?? updateStudentWithPrimaryGuardianAction;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Dev previews only: start from a draft on top of the defaults, still dirty against them.
  const draftValues = useMemo(
    () => (initialDraft ? { ...defaultValues, ...initialDraft } : undefined),
    [defaultValues, initialDraft],
  );
  const form = useForm<StudentProfileFormValues>({
    defaultValues,
    mode: "onBlur",
    resetOptions: draftValues ? { keepDefaultValues: true } : undefined,
    resolver: zodResolver(studentProfileFormSchema),
    // The form focuses the first invalid field itself, in page order (RHF uses registration order).
    shouldFocusError: false,
    values: draftValues,
  });
  const { control, register } = form;
  const { dirtyFields, errors, isSubmitting } = form.formState;

  const [duplicateResult, setDuplicateResult] = useState<SuccessfulDuplicateLookup | null>(initialDuplicateLookup ?? null);
  const [checkedDuplicateKey, setCheckedDuplicateKey] = useState<string | null>(() =>
    initialDuplicateLookup ? createDuplicateKey({ ...defaultValues, ...initialDraft }) : null,
  );
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  /** Lookup failure of "Kiểm tra hồ sơ trùng", shown next to the result in "Phụ huynh chính". */
  const [lookupError, setLookupError] = useState<string | null>(null);
  /** Failure of a save (its lookup or its write), shown above the save bar. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  /** Set by a submit that met invalid fields; the bar then names the errors until a save succeeds. */
  const [submitAttempted, setSubmitAttempted] = useState(initialValidation);
  const [created, setCreated] = useState<{ href: string | null; label: string } | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  /** The new profile of a successful "Lưu và thêm tiếp", set inside the submit and shown once the submit has finished. */
  const createdForNext = useRef<{ href: string | null; label: string } | null>(null);
  /** Fields to focus once the submit has finished: a control in the disabled sections cannot take focus. */
  const pendingFocus = useRef<{ names: readonly string[]; scroll: boolean } | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  /**
   * The control inside the form that had focus when a submit started: a field
   * (Enter) or a save-bar button. The save disables it, which drops focus to <body>.
   */
  const focusBeforeSubmit = useRef<HTMLElement | null>(null);
  /** Focusable wrapper of the save error: where focus goes when the control it left is gone or still disabled. */
  const saveErrorRef = useRef<HTMLDivElement>(null);

  // Only the fields this component reads; the table of contents watches the rest (StudentFormToc).
  const [watchedFullName, watchedBirthYear, watchedGuardianPhone] = useWatch({
    control,
    exact: true,
    name: ["fullName", "birthYear", "guardianPhone"],
  });
  const currentDuplicateKey = createDuplicateKey({
    birthYear: Number(watchedBirthYear),
    fullName: watchedFullName ?? "",
    guardianPhone: watchedGuardianPhone ?? "",
  });
  const visibleDuplicateResult = checkedDuplicateKey === currentDuplicateKey ? duplicateResult : null;
  const showDuplicateConfirmation = Boolean(visibleDuplicateResult?.hasExactStudentDuplicate);
  /** The exact duplicate "Xác nhận tiếp tục lưu" asks about (key + exact matches), or null while it is hidden. */
  const shownConfirmation = visibleDuplicateResult?.hasExactStudentDuplicate
    ? createConfirmationKey(currentDuplicateKey, visibleDuplicateResult)
    : null;
  /** The confirmation on screen at the last commit: what the reason typed so far answers. */
  const confirmationOnScreen = useRef(shownConfirmation);
  const isOwnGuardian =
    mode === "edit" &&
    normalizeStudentProfilePhone(watchedGuardianPhone ?? "") === normalizeStudentProfilePhone(defaultValues.guardianPhone);

  const dirtyNames = STUDENT_FORM_FIELD_ORDER.filter((name) => dirtyFields[name]);
  const isDirty = dirtyNames.length > 0;
  // The override reason only counts while its section is shown.
  const errorNames = sortStudentFormFields(Object.keys(errors)).filter(
    (name) => name !== "duplicateOverrideReason" || showDuplicateConfirmation,
  );
  const errorSet = new Set<string>(errorNames);
  const showErrorSummary = submitAttempted && errorNames.length > 0;

  useLeaveGuard(isDirty && !isSubmitting);
  useSaveInFlightGuard(isSubmitting);

  // Runs after the commit that re-enables the sections and renders the messages (aria-invalid, describedby).
  useEffect(() => {
    if (isSubmitting) return;
    const pending = pendingFocus.current;
    const before = focusBeforeSubmit.current;
    pendingFocus.current = null;
    focusBeforeSubmit.current = null;
    if (pending && focusFirstField(formRef.current, pending.names, pending.scroll)) return;
    if (!before || (document.activeElement !== null && document.activeElement !== document.body)) return;
    // The submit disabled the control that had focus: give it back, else move to the save error.
    if (before.isConnected && !before.matches(":disabled")) {
      before.focus({ preventScroll: true });
    } else {
      saveErrorRef.current?.focus({ preventScroll: true });
    }
  }, [focusRequest, isSubmitting]);

  // The override reason answers the duplicate it was typed for. Once that one leaves the screen (another
  // key, or the lookup names another match) the reason is emptied: no other duplicate, and no later
  // return to this one, inherits it. Dirty is recomputed against the defaults, so the bar drops it.
  useEffect(() => {
    const previous = confirmationOnScreen.current;
    confirmationOnScreen.current = shownConfirmation;
    if (previous === null || previous === shownConfirmation) return;
    form.setValue("duplicateOverrideReason", "", { shouldDirty: true });
    // A save that found another duplicate has just set this error for it; only a hidden section drops it.
    if (shownConfirmation === null) form.clearErrors("duplicateOverrideReason");
  }, [form, shownConfirmation]);

  // Dev previews only: validate the starting draft once, as after a submit attempt.
  useEffect(() => {
    if (initialValidation) void form.trigger();
  }, [form, initialValidation]);

  const fieldError = (name: StudentFormFieldName): string | undefined => {
    const message = errors[name]?.message;
    return typeof message === "string" ? message : undefined;
  };

  const linkToStudent = studentHref ?? ((studentId: string) => withReturnQuery(`/students/${studentId}`, returnQuery));

  /** Focuses the first of these fields in page order once no submit runs (the sections are enabled again). */
  function requestFocus(names: readonly string[], scroll = true) {
    pendingFocus.current = { names, scroll };
    setFocusRequest((count) => count + 1);
  }

  function rememberFocusBeforeSubmit() {
    const active = document.activeElement;
    focusBeforeSubmit.current = active instanceof HTMLElement && formRef.current?.contains(active) ? active : null;
  }

  async function runDuplicateLookup(lookupValues: StudentProfileFormValues): Promise<StudentDuplicateLookupResult> {
    form.clearErrors("duplicateOverrideReason");

    let result: StudentDuplicateLookupResult;
    try {
      result = await findDuplicates({
        birthYear: lookupValues.birthYear,
        fullName: lookupValues.fullName,
        guardianPhone: lookupValues.guardianPhone,
        studentId: mode === "edit" ? lookupValues.studentId : undefined,
      });
    } catch {
      // A rejected call must not escape the handler: typed values stay and the message explains.
      result = { message: LOOKUP_CONNECTION_ERROR, ok: false };
    }

    // A failed lookup says nothing new about duplicates: the last successful result stays on screen
    // with its key, so "Xác nhận tiếp tục lưu" and the reason typed for it survive a retry.
    if (result.ok) {
      setCheckedDuplicateKey(createDuplicateKey(lookupValues));
      setDuplicateResult(result);
    }
    return result;
  }

  async function handleDuplicateCheck() {
    setLookupError(null);
    setSaveError(null);

    const valid = await form.trigger(duplicateFields);
    if (!valid) {
      focusFirstField(formRef.current, duplicateFields.filter((name) => form.getFieldState(name).invalid));
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      const result = await runDuplicateLookup(form.getValues());
      if (!result.ok) setLookupError(result.message);
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  async function submitValues(submitted: StudentProfileFormValues, intent: "save" | "save-and-add") {
    setLookupError(null);
    setSaveError(null);
    setStatusMessage("");

    // The exact duplicate on screen as this save starts: the only one a typed reason can answer.
    const confirmed = confirmationOnScreen.current;
    const lookup = await runDuplicateLookup(submitted);
    if (!lookup.ok) {
      setSaveError(lookup.message);
      return;
    }

    const overrideReason = submitted.duplicateOverrideReason.trim();
    if (
      lookup.hasExactStudentDuplicate &&
      (!overrideReason || createConfirmationKey(createDuplicateKey(submitted), lookup) !== confirmed)
    ) {
      // Another duplicate than the one on screen (or none was): ask again, never pass the earlier reason.
      form.setError("duplicateOverrideReason", {
        message: "Có học viên trùng họ tên, năm sinh và số điện thoại phụ huynh. Cần nhập lý do để tiếp tục.",
        type: "manual",
      });
      setSubmitAttempted(true);
      // The section renders with this commit; focus it once the submit has finished.
      requestFocus(["duplicateOverrideReason"]);
      return;
    }

    let actionState: StudentFormActionState;
    try {
      actionState =
        mode === "create"
          ? await createStudent(toCreateStudentActionInput(submitted))
          : await updateStudent(toUpdateStudentActionInput(submitted));
    } catch {
      actionState = { message: SAVE_CONNECTION_ERROR, status: "error" };
    }

    if (actionState.status === "error") {
      const rejected = applyActionFieldErrors(form, actionState);
      if (rejected.length > 0) {
        setSubmitAttempted(true);
        // Like a client-side invalid submit: the first rejected field in page order, once the sections are enabled again.
        requestFocus(rejected);
      }
      setSaveError(actionState.message);
      return;
    }

    if (intent === "save-and-add" && mode === "create") {
      // Client-only: the profile exists; saveAndAdd starts the next one once the submit has finished.
      createdForNext.current = {
        href: actionState.redirectTo ? withReturnQuery(actionState.redirectTo, returnQuery) : null,
        label: actionState.studentPublicCode || submitted.fullName,
      };
      return;
    }

    form.reset(submitted);
    setSubmitAttempted(false);

    if (actionState.redirectTo) {
      router.push(withReturnQuery(actionState.redirectTo, returnQuery));
      router.refresh();
      return;
    }

    setStatusMessage(actionState.message);
  }

  function handleInvalidSubmit(invalid: FieldErrors<StudentProfileFormValues>) {
    setSubmitAttempted(true);
    requestFocus(Object.keys(invalid));
  }

  const submit = (intent: "save" | "save-and-add") =>
    form.handleSubmit((submitted) => submitValues(submitted, intent), handleInvalidSubmit);

  /**
   * "Lưu và thêm tiếp": the same submit, then (on success) an empty form for
   * the next student. The reset waits for handleSubmit to finish: RHF marks
   * the form submitted after the submit handler returns, so a reset inside it
   * would leave the next, untouched record validating on every keystroke
   * instead of on blur like the first one.
   */
  async function saveAndAdd() {
    createdForNext.current = null;
    rememberFocusBeforeSubmit();
    await submit("save-and-add")();
    const next = createdForNext.current;
    createdForNext.current = null;
    if (!next) return;
    form.reset(defaultValues);
    setDuplicateResult(null);
    setCheckedDuplicateKey(null);
    setSubmitAttempted(false);
    setCreated(next);
    window.scrollTo({ behavior: prefersReducedMotion() ? "auto" : "smooth", top: 0 });
    requestFocus(["fullName"], false);
  }

  function requestLeave(href: string) {
    if (isSubmitting) return;
    if (isDirty) setLeaveHref(href);
    else router.push(href);
  }

  /** Plain left clicks on in-form links ask first while there are unsaved edits; new-tab clicks pass through. */
  function onGuardedLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (isSubmitting) {
      // Leaving mid-save would let the save navigate afterwards; wait for it.
      event.preventDefault();
      return;
    }
    if (!isDirty) return;
    event.preventDefault();
    setLeaveHref(href);
  }

  const changedLabels = dirtyNames.map((name) => getStudentFormFieldLabel(name, mode));
  const firstErrorLabel = errorNames[0] ? getStudentFormFieldLabel(errorNames[0], mode) : null;
  const saveBlocked = !isDirty || isCheckingDuplicates;
  const lifecycleLabel = lifecycleStatus ? getStudentLifecycleStatusLabel(lifecycleStatus) : null;
  const createdHref = created?.href ?? null;

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={
          <Link
            aria-disabled={isSubmitting || undefined}
            className={getButtonClassName({ className: "max-md:h-11", variant: "ghost" })}
            href={cancelHref}
            onClick={(event) => onGuardedLinkClick(event, cancelHref)}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            {mode === "create" ? "Về danh sách" : "Về hồ sơ"}
          </Link>
        }
        title={mode === "create" ? "Thêm học sinh" : watchedFullName || "Học viên"}
      >
        <p className="mt-1 text-secondary text-text-muted">
          {mode === "create" ? (
            "Mã học sinh (TV-…) được cấp tự động khi lưu · các trường có dấu * là bắt buộc"
          ) : (
            <>
              <span className="font-mono tabular-nums">{defaultValues.publicCode || "—"}</span>
              {lifecycleLabel ? ` · ${lifecycleLabel}` : null}
            </>
          )}
        </p>
      </PageHeader>

      {created ? (
        <ResultBanner
          action={
            createdHref ? (
              <Link
                // 44px tap target on phones; plain inline text from md.
                className="inline-flex min-h-11 items-center md:min-h-0"
                href={createdHref}
                onClick={(event) => onGuardedLinkClick(event, createdHref)}
              >
                Mở hồ sơ
              </Link>
            ) : undefined
          }
          title={`Đã tạo hồ sơ ${created.label}.`}
          tone="success"
        />
      ) : null}

      <form
        className="grid min-w-0"
        noValidate
        onSubmit={(event) => {
          rememberFocusBeforeSubmit();
          void submit("save")(event);
        }}
        ref={formRef}
      >
        <input type="hidden" {...register("studentId")} />

        <StudentFormToc control={control} errorFields={errorSet} showDuplicateConfirmation={showDuplicateConfirmation}>
          {/* Disabled while a save runs (edits typed then would be lost); `contents` keeps the sections as the column's own items. */}
          <fieldset className="contents" disabled={isSubmitting}>
            <FormSection id="ho-so" title="Hồ sơ">
              <div className="grid gap-x-6 gap-y-4 md:grid-cols-12">
                {mode === "edit" ? (
                  <>
                    <ProfileField className="md:col-span-6" label="Mã học viên" name="publicCode">
                      {(props) => (
                        <Input
                          {...props}
                          className="font-mono font-semibold read-only:bg-surface-sunken"
                          readOnly
                          {...register("publicCode")}
                        />
                      )}
                    </ProfileField>
                    <ProfileField className="md:col-span-6" label="Trạng thái hiện tại" name="lifecycleStatus">
                      {(props) => (
                        <Input {...props} className="read-only:bg-surface-sunken" readOnly value={lifecycleLabel ?? "-"} />
                      )}
                    </ProfileField>
                  </>
                ) : (
                  <input type="hidden" {...register("publicCode")} />
                )}

                <ProfileField className="md:col-span-6" error={fieldError("fullName")} label="Họ và tên" name="fullName" required>
                  {(props) => <Input {...props} {...register("fullName")} />}
                </ProfileField>
                <ProfileField className="md:col-span-3" error={fieldError("nickname")} label="Tên thường gọi" name="nickname">
                  {(props) => <Input {...props} {...register("nickname")} />}
                </ProfileField>
                <ProfileField className="md:col-span-3" error={fieldError("birthYear")} label="Năm sinh" name="birthYear" required>
                  {(props) => (
                    <Input
                      {...props}
                      className="tabular-nums"
                      inputMode="numeric"
                      type="number"
                      {...register("birthYear", { valueAsNumber: true })}
                    />
                  )}
                </ProfileField>

                <ProfileField className="md:col-span-3" error={fieldError("currentGrade")} label="Khối hiện tại" name="currentGrade" required>
                  {(props) => (
                    <Select {...props} {...register("currentGrade", { valueAsNumber: true })}>
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          Khối {grade}
                        </option>
                      ))}
                    </Select>
                  )}
                </ProfileField>
                <ProfileField className="md:col-span-3" error={fieldError("learningLevel")} label="Mức học tập" name="learningLevel" required>
                  {(props) => (
                    <Select {...props} {...register("learningLevel")}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="CLC">CLC</option>
                    </Select>
                  )}
                </ProfileField>
                <div className="min-w-0 md:col-span-3">
                  <Controller
                    control={control}
                    name="registeredMode"
                    render={({ field }) => {
                      const error = fieldError("registeredMode");
                      return (
                        <>
                          <SegmentedRadioGroup
                            controlRef={field.ref}
                            describedBy={error ? "registeredMode-error" : undefined}
                            id="registeredMode"
                            invalid={Boolean(error)}
                            label="Hình thức đăng ký"
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            options={registeredModeOptions}
                            required
                            value={field.value}
                          />
                          {error ? (
                            <p className="mt-1.5 text-caption font-medium text-danger" id="registeredMode-error" role="alert">
                              {error}
                            </p>
                          ) : null}
                        </>
                      );
                    }}
                  />
                </div>
                <ProfileField className="md:col-span-3" error={fieldError("provinceName")} label="Tỉnh/thành phố" name="provinceName">
                  {(props) => <Input {...props} {...register("provinceName")} />}
                </ProfileField>

                <ProfileField className="md:col-span-12" error={fieldError("learningGoal")} label="Mục tiêu học tập" name="learningGoal">
                  {(props) => <Textarea {...props} {...register("learningGoal")} />}
                </ProfileField>
                <ProfileField className="md:col-span-12" error={fieldError("internalNote")} label="Ghi chú nội bộ" name="internalNote">
                  {(props) => <Textarea {...props} {...register("internalNote")} />}
                </ProfileField>
              </div>
            </FormSection>

            <FormSection
              description="Bắt buộc để tạo yêu cầu thanh toán và nhận thông báo học phí."
              headerAction={
                <Button
                  className="max-md:h-11"
                  disabled={isCheckingDuplicates || isSubmitting}
                  isLoading={isCheckingDuplicates}
                  onClick={handleDuplicateCheck}
                  variant="secondary"
                >
                  {isCheckingDuplicates ? "Đang kiểm tra…" : "Kiểm tra hồ sơ trùng"}
                </Button>
              }
              id="phu-huynh"
              title="Phụ huynh chính"
            >
              <div className="grid gap-x-6 gap-y-4 md:grid-cols-12">
                <ProfileField className="md:col-span-5" error={fieldError("guardianFullName")} label="Họ tên phụ huynh" name="guardianFullName" required>
                  {(props) => <Input {...props} {...register("guardianFullName")} />}
                </ProfileField>
                <ProfileField className="md:col-span-3" error={fieldError("guardianRelationship")} label="Quan hệ với học viên" name="guardianRelationship" required>
                  {(props) => (
                    <Select {...props} {...register("guardianRelationship")}>
                      <option value="">Chọn quan hệ</option>
                      <option value="Mẹ">Mẹ</option>
                      <option value="Bố">Bố</option>
                      <option value="Người giám hộ">Người giám hộ</option>
                      <option value="Khác">Khác</option>
                    </Select>
                  )}
                </ProfileField>
                <ProfileField
                  className="md:col-span-4"
                  error={fieldError("guardianPhone")}
                  hint="Hệ thống chuẩn hóa số và dùng lại phụ huynh đã có cùng số điện thoại."
                  label="Số điện thoại"
                  name="guardianPhone"
                  required
                >
                  {(props) => (
                    <Input {...props} className="tabular-nums" inputMode="tel" type="tel" {...register("guardianPhone")} />
                  )}
                </ProfileField>

                <ProfileField className="md:col-span-4" error={fieldError("guardianZalo")} label="Zalo" name="guardianZalo">
                  {(props) => <Input {...props} className="tabular-nums" {...register("guardianZalo")} />}
                </ProfileField>
                <ProfileField className="md:col-span-8" error={fieldError("guardianEmail")} label="Email" name="guardianEmail">
                  {(props) => <Input {...props} type="email" {...register("guardianEmail")} />}
                </ProfileField>

                {lookupError || visibleDuplicateResult ? (
                  <div className="grid gap-3 md:col-span-12">
                    {lookupError ? <ResultBanner description={lookupError} title="Chưa kiểm tra được hồ sơ trùng." tone="danger" /> : null}
                    {visibleDuplicateResult ? (
                      <DuplicateLookupNotices
                        currentStudentId={mode === "edit" ? defaultValues.studentId : undefined}
                        isOwnGuardian={isOwnGuardian}
                        onLinkClick={onGuardedLinkClick}
                        result={visibleDuplicateResult}
                        studentHref={linkToStudent}
                      />
                    ) : null}
                  </div>
                ) : null}

                <ProfileField className="md:col-span-12" error={fieldError("guardianNote")} label="Ghi chú phụ huynh" name="guardianNote">
                  {(props) => <Textarea {...props} {...register("guardianNote")} />}
                </ProfileField>
              </div>
            </FormSection>

            {showDuplicateConfirmation ? (
              <FormSection
                description="Chỉ cần khi đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh."
                id="xac-nhan"
                title="Xác nhận tiếp tục lưu"
              >
                <ProfileField
                  error={fieldError("duplicateOverrideReason")}
                  hint="Lý do này được lưu cùng audit của thao tác."
                  label="Lý do vẫn tạo hoặc cập nhật hồ sơ"
                  name="duplicateOverrideReason"
                  required
                >
                  {(props) => <Textarea {...props} {...register("duplicateOverrideReason")} />}
                </ProfileField>
              </FormSection>
            ) : null}

            <FormSection id="ly-do" title="Lý do thao tác">
              <ProfileField
                error={fieldError("reason")}
                hint="Nội dung được lưu trong nhật ký audit."
                label={mode === "create" ? "Lý do tạo hồ sơ" : "Lý do cập nhật hồ sơ"}
                name="reason"
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    placeholder={
                      mode === "create"
                        ? "Ví dụ: Tạo hồ sơ sau khi phụ huynh đăng ký tư vấn."
                        : "Ví dụ: Cập nhật thông tin theo xác nhận của phụ huynh."
                    }
                    {...register("reason")}
                  />
                )}
              </ProfileField>
            </FormSection>

            <p className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3 text-secondary text-text-muted">
              <Info aria-hidden="true" className="mt-px shrink-0" size={16} strokeWidth={1.8} />
              Nguồn học viên, đơn giá học phí và ghi danh vào lớp được thiết lập trên hồ sơ học sinh sau khi lưu.
            </p>
          </fieldset>
        </StudentFormToc>

        <StickySaveBar
          changedLabels={showErrorSummary && firstErrorLabel ? [firstErrorLabel] : changedLabels}
          dirtyCount={dirtyNames.length}
          error={
            saveError ? (
              <div
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                ref={saveErrorRef}
                tabIndex={-1}
              >
                <ResultBanner description={saveError} title="Chưa lưu được hồ sơ." tone="danger" />
              </div>
            ) : null
          }
          isSaving={isSubmitting}
          onCancel={() => requestLeave(cancelHref)}
          saveDisabled={saveBlocked}
          saveDisabledReason={isDirty && isCheckingDuplicates ? "Đang kiểm tra hồ sơ trùng…" : undefined}
          saveLabel={mode === "create" ? "Lưu học sinh" : "Lưu thay đổi"}
          saveType="submit"
          savingLabel="Đang lưu…"
          secondaryAction={
            mode === "create"
              ? { disabled: saveBlocked, label: "Lưu và thêm tiếp", onClick: () => void saveAndAdd() }
              : undefined
          }
          stateLabel={showErrorSummary ? `Đang nhập · ${errorNames.length} lỗi cần sửa` : undefined}
          stateTone={showErrorSummary ? "danger" : "default"}
          statusMessage={statusMessage}
        />
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

function withReturnQuery(pathname: string, query?: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

function createDuplicateKey(
  values: Pick<StudentProfileFormValues, "birthYear" | "fullName" | "guardianPhone">,
): string {
  return [
    values.fullName.trim().toLowerCase(),
    String(values.birthYear),
    values.guardianPhone.replace(/[\s.-]/g, ""),
  ].join("|");
}

/** What an override reason answers: the lookup key and the exact matches the lookup named for it. */
function createConfirmationKey(duplicateKey: string, lookup: SuccessfulDuplicateLookup): string {
  const exactIds = (lookup.guardian?.children ?? [])
    .filter((student) => student.isExactDuplicate)
    .map((student) => student.id)
    .sort();
  return `${duplicateKey}#${exactIds.join(",")}`;
}

/** Puts the action's field errors on their fields; returns the names of the fields that got one. */
function applyActionFieldErrors(
  form: ReturnType<typeof useForm<StudentProfileFormValues>>,
  state: StudentFormActionState,
): string[] {
  const applied: string[] = [];
  for (const [fieldName, messages] of Object.entries(state.fieldErrors ?? {})) {
    const message = messages?.[0];
    if (!message) continue;
    form.setError(fieldName as FieldPath<StudentProfileFormValues>, { message, type: "server" });
    applied.push(fieldName);
  }
  return applied;
}
