import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { EnrollmentImportActionOverrides } from "@/features/imports/enrollments/enrollment-import-action-overrides";
import { EnrollmentImportPage, type EnrollmentImportPageProps } from "@/features/imports/enrollments/enrollment-import-page";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

import {
  enrollmentPreviewBatch,
  enrollmentPreviewCommitResult,
  enrollmentPreviewDryRunClean,
  enrollmentPreviewDryRunWithProblems,
  enrollmentPreviewFileClean,
  enrollmentPreviewFileWithProblems,
} from "./enrollment-import-fixtures";
import { getImportsPreviewPermissions, type EnrollmentImportPreviewProps, type EnrollmentImportsPreviewState } from "./imports-preview-params";

export const ENROLLMENT_IMPORT_PREVIEW_STUB_MESSAGE = "Bản xem trước không ghi dữ liệu.";

/**
 * Inert stand-ins for the three enrollment import actions. The dry-run is
 * read only on the server, so it answers with the state's fixture result
 * (the review step needs one); creating a batch and committing never write
 * and answer with the actions' own failure shape.
 */
export function createEnrollmentImportPreviewActions(state: EnrollmentImportsPreviewState): Required<EnrollmentImportActionOverrides> {
  const dryRun = state === "batch" || state === "done" ? enrollmentPreviewDryRunClean : enrollmentPreviewDryRunWithProblems;
  return {
    commitStudentEnrollmentImportBatch: async () => ({ error: ENROLLMENT_IMPORT_PREVIEW_STUB_MESSAGE, success: false }),
    createStudentEnrollmentImportBatch: async () => ({ error: ENROLLMENT_IMPORT_PREVIEW_STUB_MESSAGE, success: false }),
    dryRunStudentEnrollmentImport: async () => ({ data: dryRun, success: true }),
  };
}

/** Seeding props per state: which step opens and with which data. */
export function getEnrollmentImportPreviewSeed(state: EnrollmentImportsPreviewState): Partial<EnrollmentImportPageProps> {
  switch (state) {
    case "review":
      return { initialDryRun: enrollmentPreviewDryRunWithProblems, initialFile: enrollmentPreviewFileWithProblems, initialStep: "review" };
    case "batch":
      return {
        initialBatch: enrollmentPreviewBatch,
        initialDryRun: enrollmentPreviewDryRunClean,
        initialFile: enrollmentPreviewFileClean,
        initialStep: "commit",
      };
    case "done":
      return {
        initialBatch: enrollmentPreviewBatch,
        initialCommitResult: enrollmentPreviewCommitResult,
        initialDryRun: enrollmentPreviewDryRunClean,
        initialFile: enrollmentPreviewFileClean,
      };
    default:
      return { initialStep: "file" };
  }
}

/**
 * /dev/imports `view=enrollments` body (design 17c); rendered inside the
 * AppShell by ImportsPreview. Mirrors the route gate: without
 * `imports.enrollments` the role sees the route's denial. `state=batch`
 * opens on "Xác nhận ghi danh" with a created batch ("← Tạo lô" shows it);
 * keyed by state so a state switch starts the wizard afresh.
 */
export function EnrollmentImportPreviewBody({ role, state }: EnrollmentImportPreviewProps) {
  const permissions = getImportsPreviewPermissions(role);

  if (!permissions.includes("imports.enrollments")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("imports.enrollments")}
        title="Không có quyền import ghi danh học viên"
      />
    );
  }

  return <EnrollmentImportPage actions={createEnrollmentImportPreviewActions(state)} key={state} {...getEnrollmentImportPreviewSeed(state)} />;
}
