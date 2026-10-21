"use client";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassScheduleBatchDetailPage } from "@/features/imports/classes/class-schedule-batch-detail-page";
import type { ClassScheduleImportActionOverrides } from "@/features/imports/classes/class-schedule-import-action-overrides";
import { ClassScheduleImportPage, type ClassScheduleImportStep } from "@/features/imports/classes/class-schedule-import-page";
import type { ClassScheduleImportParsedWorkbook, DryRunClassScheduleImportResult } from "@/features/imports/classes/types";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

import {
  CLASS_IMPORT_PREVIEW_DRY_RUN,
  CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS,
  CLASS_IMPORT_PREVIEW_WORKBOOK,
  CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS,
  getClassBatchPreviewDetail,
} from "./class-import-fixtures";
import { getImportsPreviewPermissions, type ClassImportPreviewProps, type ClassImportsPreviewState } from "./imports-preview-params";

const STUB = "Bản xem trước không ghi dữ liệu.";

/** Where the preview's created (or existing) batch opens: the batch view of /dev/imports, never /imports/*. */
export const CLASS_IMPORT_PREVIEW_BATCH_HREF = "/dev/imports?view=class-batch&state=ready";
/** The batch page's back link in the preview. */
export const CLASS_IMPORT_PREVIEW_IMPORT_HREF = "/dev/imports?view=classes";
/** Where the batch page's "Mở lớp" links open in the preview: the /dev class detail preview (fixture ids are not real classes). */
export const CLASS_IMPORT_PREVIEW_CLASS_HREF = "/dev/class?state=active";

/**
 * Inert stand-ins for every class & schedule import action (the preview runs
 * on localhost where .env.local may point at production): the dry-run
 * answers the clean file's fixture result (the real one writes nothing
 * either); creating a batch and committing answer the stub message.
 */
export const previewClassImportActions: Required<ClassScheduleImportActionOverrides> = {
  commitClassScheduleImportBatch: async () => ({ code: "forbidden", message: STUB, ok: false }),
  createClassScheduleImportBatch: async () => ({ code: "forbidden", message: STUB, ok: false }),
  dryRunClassScheduleImport: async () => ({ data: CLASS_IMPORT_PREVIEW_DRY_RUN, ok: true }),
};

/** `state=review-conflicts`: a re-run of the check answers the broken file's result. */
export const previewClassImportConflictActions: Required<ClassScheduleImportActionOverrides> = {
  ...previewClassImportActions,
  dryRunClassScheduleImport: async () => ({ data: CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS, ok: true }),
};

interface WizardSeed {
  dryRun: DryRunClassScheduleImportResult | null;
  step: ClassScheduleImportStep;
  workbook: ClassScheduleImportParsedWorkbook | null;
}

const WIZARD_SEEDS: Readonly<Record<ClassImportsPreviewState, WizardSeed>> = {
  file: { dryRun: null, step: "file", workbook: null },
  mapping: { dryRun: null, step: "mapping", workbook: CLASS_IMPORT_PREVIEW_WORKBOOK },
  "review-clean": { dryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, step: "review", workbook: CLASS_IMPORT_PREVIEW_WORKBOOK },
  "review-conflicts": { dryRun: CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS, step: "review", workbook: CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS },
};

/**
 * /dev/imports `view=classes` and `view=class-batch` body (design 17c);
 * rendered inside the AppShell by ImportsPreview. Without `imports.classes`
 * (maker, viewer) it shows the route's own denial; otherwise the real pages
 * with fixtures and the inert actions, every link to a batch, a class or back
 * to the wizard kept under /dev.
 */
export function ClassImportPreviewBody(props: ClassImportPreviewProps) {
  const canImport = getImportsPreviewPermissions(props.role).includes("imports.classes");

  if (props.view === "class-batch") {
    if (!canImport) {
      return (
        <PermissionDeniedState
          description="Tài khoản hiện tại không có quyền xem chi tiết batch import lớp học & lịch học."
          title="Không có quyền truy cập"
        />
      );
    }
    return (
      <ClassScheduleBatchDetailPage
        actions={previewClassImportActions}
        classHref={() => CLASS_IMPORT_PREVIEW_CLASS_HREF}
        detail={getClassBatchPreviewDetail(props.state)}
        importHref={CLASS_IMPORT_PREVIEW_IMPORT_HREF}
        key={props.state}
      />
    );
  }

  if (!canImport) {
    return <PermissionDeniedState description={permissionDeniedDescription("imports.classes")} title="Không có quyền import lớp & lịch học" />;
  }

  const seed = WIZARD_SEEDS[props.state];
  return (
    <ClassScheduleImportPage
      actions={props.state === "review-conflicts" ? previewClassImportConflictActions : previewClassImportActions}
      batchHref={() => CLASS_IMPORT_PREVIEW_BATCH_HREF}
      initialDryRun={seed.dryRun}
      initialStep={seed.step}
      initialWorkbook={seed.workbook}
      key={props.state}
    />
  );
}
