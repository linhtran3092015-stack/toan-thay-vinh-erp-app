import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { StudentImportActionOverrides } from "@/features/imports/students/student-import-action-overrides";
import { StudentImportPage, type StudentImportPageProps } from "@/features/imports/students/student-import-page";
import type { StudentImportActionFailure } from "@/features/imports/students/types";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

import { getImportsPreviewPermissions, type StudentImportPreviewProps, type StudentImportsPreviewState } from "./imports-preview-params";
import {
  studentPreviewCommitResult,
  studentPreviewValidationClean,
  studentPreviewValidationWithErrors,
  studentPreviewWorkbookClean,
  studentPreviewWorkbookUnmapped,
  studentPreviewWorkbookWithErrors,
} from "./student-import-fixtures";

export const STUDENT_IMPORT_PREVIEW_STUB_MESSAGE = "Bản xem trước không ghi dữ liệu.";

/** Result links of the done state, kept under /dev (the real list and audit routes are never linked from a preview). */
export const STUDENT_IMPORT_PREVIEW_RESULT_LINKS = {
  auditLog: "/dev/lists?view=audit",
  studentList: "/dev/lists?view=students",
} as const;

/**
 * Inert stand-ins for the two student import actions. The dry-run is read
 * only on the server, so it answers with the state's fixture result (the
 * review states need one); the commit never writes and answers with the
 * action's own failure shape.
 */
export function createStudentImportPreviewActions(state: StudentImportsPreviewState): Required<StudentImportActionOverrides> {
  const validation = state === "review-clean" || state === "done" ? studentPreviewValidationClean : studentPreviewValidationWithErrors;
  return {
    commitStudentImportRows: async () =>
      ({ code: "forbidden", message: STUDENT_IMPORT_PREVIEW_STUB_MESSAGE, ok: false }) satisfies StudentImportActionFailure,
    validateStudentImportRows: async () => ({ data: validation, ok: true }),
  };
}

/** Seeding props per state: which step opens and with which data. */
export function getStudentImportPreviewSeed(state: StudentImportsPreviewState): Partial<StudentImportPageProps> {
  switch (state) {
    case "mapping":
      return { initialStep: "mapping", initialWorkbook: studentPreviewWorkbookUnmapped };
    case "review-errors":
      return { initialDryRun: studentPreviewValidationWithErrors, initialStep: "review", initialWorkbook: studentPreviewWorkbookWithErrors };
    case "review-clean":
      return { initialDryRun: studentPreviewValidationClean, initialStep: "review", initialWorkbook: studentPreviewWorkbookClean };
    case "done":
      return {
        initialCommitResult: studentPreviewCommitResult,
        initialDryRun: studentPreviewValidationClean,
        initialStep: "confirm",
        initialWorkbook: studentPreviewWorkbookClean,
      };
    default:
      return { initialStep: "file" };
  }
}

/**
 * /dev/imports `view=students` body (design 17c); rendered inside the
 * AppShell by ImportsPreview. Mirrors the route gate: without
 * `imports.students` the role sees the route's denial; `students.create`
 * decides whether the commit step can ever be met. Keyed by state so a state
 * switch starts the wizard afresh.
 */
export function StudentImportPreviewBody({ role, state }: StudentImportPreviewProps) {
  const permissions = getImportsPreviewPermissions(role);

  if (!permissions.includes("imports.students")) {
    return (
      <PermissionDeniedState description={permissionDeniedDescription("imports.students")} title="Không có quyền import học viên" />
    );
  }

  return (
    <StudentImportPage
      actions={createStudentImportPreviewActions(state)}
      canCreateStudents={permissions.includes("students.create")}
      key={state}
      resultLinks={STUDENT_IMPORT_PREVIEW_RESULT_LINKS}
      {...getStudentImportPreviewSeed(state)}
    />
  );
}
