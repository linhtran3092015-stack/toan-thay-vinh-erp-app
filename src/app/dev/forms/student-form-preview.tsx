"use client";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { StudentFormActionOverrides } from "@/features/students/form/student-form-action-overrides";
import type { StudentFormActionState } from "@/features/students/form/student-form-action-types";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import { STUDENT_CREATE_DENIED, STUDENT_EDIT_DENIED } from "@/features/students/form/student-form-route-copy";

import { getFormsPreviewPermissions, type StudentFormsPreviewProps, type StudentFormsPreviewState } from "./forms-preview-params";
import { getStudentFormPreviewFixture, getStudentFormPreviewLookup } from "./student-form-fixtures";

const STUB = "Bản xem trước không ghi dữ liệu.";
const writeStub = async (): Promise<StudentFormActionState> => ({ message: STUB, status: "error" });

/** Where the preview's links go: the /dev list and profile previews, never a live route. */
export const STUDENT_FORM_PREVIEW_LIST_HREF = "/dev/lists?view=students";
export const STUDENT_FORM_PREVIEW_PROFILE_HREF = "/dev/student";

/**
 * Inert stand-ins for the three server actions the student form can reach.
 * The preview runs on localhost where .env.local may point at production:
 * create and update answer with an error, so nothing is written and nothing
 * navigates. The duplicate lookup answers the fixture guardian in the
 * duplicate and sibling states (so their panels render) and the same error
 * otherwise.
 */
export function getStudentFormPreviewActions(state: StudentFormsPreviewState): Required<StudentFormActionOverrides> {
  const lookup = getStudentFormPreviewLookup(state);
  return {
    createStudentWithPrimaryGuardian: writeStub,
    findStudentFormDuplicates: async () => lookup ?? { message: STUB, ok: false },
    updateStudentWithPrimaryGuardian: writeStub,
  };
}

/**
 * /dev/forms `view=student|student-edit` body (design 17a); rendered inside
 * the AppShell by FormsPreview. Gates like the routes: create needs
 * `students.create`, edit `students.view` + `students.update` (the TA and the
 * viewer get the route's denial). `state` picks a fixture: clean, dirty, error
 * (one invalid field, validated as after a submit), duplicate (exact
 * duplicate, needs the override reason) or sibling (existing guardian reused).
 * Hủy, the header link and the profile links stay on /dev.
 */
export function StudentFormPreviewBody({ role, state, view }: StudentFormsPreviewProps) {
  const mode = view === "student" ? "create" : "edit";
  const permissions = getFormsPreviewPermissions(role);

  if (mode === "create" && !permissions.includes("students.create")) {
    return <PermissionDeniedState description={STUDENT_CREATE_DENIED.description} title={STUDENT_CREATE_DENIED.title} />;
  }

  if (mode === "edit" && !(permissions.includes("students.view") && permissions.includes("students.update"))) {
    return <PermissionDeniedState description={STUDENT_EDIT_DENIED.description} title={STUDENT_EDIT_DENIED.title} />;
  }

  const fixture = getStudentFormPreviewFixture(mode, state);

  return (
    <StudentFormPage
      actions={getStudentFormPreviewActions(state)}
      cancelHref={mode === "create" ? STUDENT_FORM_PREVIEW_LIST_HREF : STUDENT_FORM_PREVIEW_PROFILE_HREF}
      defaultValues={fixture.defaultValues}
      initialDraft={fixture.draft}
      initialDuplicateLookup={fixture.duplicateLookup}
      initialValidation={fixture.validate}
      // A new form per view and state: the form reads its starting values once.
      key={`${view}-${state}`}
      lifecycleStatus={fixture.lifecycleStatus}
      mode={mode}
      studentHref={() => STUDENT_FORM_PREVIEW_PROFILE_HREF}
    />
  );
}
