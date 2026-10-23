import type {
  commitClassScheduleImportBatchAction,
  createClassScheduleImportBatchAction,
  dryRunClassScheduleImportAction,
} from "./actions";

/**
 * Optional replacements for every server action the class & schedule import
 * can reach: the wizard (/imports/classes) calls the dry-run and the batch
 * creation, the batch page (/imports/classes/[batchId]) the commit. Each page
 * takes the slice it calls and falls back to the real action, so the routes
 * pass nothing while the /dev/imports preview passes inert stubs (it runs on
 * localhost where .env.local may point at the production database).
 * Type-only imports: no server module enters a bundle through this file.
 */
export interface ClassScheduleImportActionOverrides {
  commitClassScheduleImportBatch?: typeof commitClassScheduleImportBatchAction;
  createClassScheduleImportBatch?: typeof createClassScheduleImportBatchAction;
  dryRunClassScheduleImport?: typeof dryRunClassScheduleImportAction;
}
