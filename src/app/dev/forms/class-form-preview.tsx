"use client";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { ClassFormActionOverrides } from "@/features/classes/management/class-form-action-overrides";
import { ClassFormPage } from "@/features/classes/management/class-form-page";
import {
  CLASS_CREATE_DENIED,
  CLASS_EDIT_VIEW_DENIED,
  CLASS_EDIT_YEAR_CLOSED,
} from "@/features/classes/management/class-form-route-copy";

import {
  PREVIEW_ACADEMIC_YEARS,
  PREVIEW_CLASS_CREATE_ERROR,
  PREVIEW_CLASS_DETAIL,
  PREVIEW_CLASS_EDIT_ERROR,
} from "./class-batch-fixtures";
import type { ClassFormsPreviewProps } from "./forms-preview-params";

const STUB = "Bản xem trước không ghi dữ liệu.";

/**
 * Where the form's links go in the preview: /dev pages only (the class list
 * and class detail previews), never the live write routes.
 */
export const PREVIEW_CLASS_FORM_LINKS = {
  academicYearsHref: "/dev/lists?view=classes",
  batchHref: "/dev/forms?view=batch",
  classPageHref: "/dev/class?state=draft",
  createCancelHref: "/dev/lists?view=classes",
  editCancelHref: "/dev/class?state=draft",
} as const;

/**
 * Inert stand-ins for both writes the class form can reach. The preview runs
 * on localhost where .env.local may point at production, so saving answers
 * with the stub message and never navigates.
 */
export const previewClassFormActions: Required<ClassFormActionOverrides> = {
  createClass: async () => ({ message: STUB, status: "error" }),
  updateClass: async () => ({ message: STUB, status: "error" }),
};

/**
 * /dev/forms `view=class|class-edit` body (design 17b, left); rendered inside
 * the AppShell by FormsPreview. Roles meet what the routes show them: the TA
 * and the viewer have no classes.create (/classes/new) and no classes.view
 * (the edit route checks it first). `no-year` is /classes/new without an open
 * year, and on the edit route the error the route shows when the class's
 * year is closed.
 */
export function ClassFormPreviewBody({ role, state, view }: ClassFormsPreviewProps) {
  const isEdit = view === "class-edit";

  if (role !== "owner") {
    const denial = isEdit ? CLASS_EDIT_VIEW_DENIED : CLASS_CREATE_DENIED;
    return <PermissionDeniedState description={denial.description} title={denial.title} />;
  }

  if (isEdit) {
    if (state === "no-year") {
      return <ErrorState description={CLASS_EDIT_YEAR_CLOSED.description} title={CLASS_EDIT_YEAR_CLOSED.title} />;
    }
    const error = state === "error" ? PREVIEW_CLASS_EDIT_ERROR : null;
    return (
      <ClassFormPage
        academicYears={PREVIEW_ACADEMIC_YEARS}
        actions={previewClassFormActions}
        batchHref={PREVIEW_CLASS_FORM_LINKS.batchHref}
        // The owner holds sessions.manage, as on the route; the draft fixture keeps step 4 unlinked.
        canManageSessions
        cancelHref={PREVIEW_CLASS_FORM_LINKS.editCancelHref}
        classDetail={PREVIEW_CLASS_DETAIL}
        classPageHref={PREVIEW_CLASS_FORM_LINKS.classPageHref}
        initialActionState={error?.state}
        initialReason={error?.reason}
        initialValues={error?.values}
        key={`${view}-${state}`}
      />
    );
  }

  const error = state === "error" ? PREVIEW_CLASS_CREATE_ERROR : null;
  return (
    <ClassFormPage
      academicYears={state === "no-year" ? [] : PREVIEW_ACADEMIC_YEARS}
      academicYearsHref={PREVIEW_CLASS_FORM_LINKS.academicYearsHref}
      actions={previewClassFormActions}
      cancelHref={PREVIEW_CLASS_FORM_LINKS.createCancelHref}
      initialActionState={error?.state}
      initialValues={error?.values}
      key={`${view}-${state}`}
    />
  );
}
