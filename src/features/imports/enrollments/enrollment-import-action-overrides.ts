import type {
  commitStudentEnrollmentImportBatchAction,
  createStudentEnrollmentImportBatchAction,
  dryRunStudentEnrollmentImportAction,
} from "./actions";

/**
 * Optional replacements for the three server actions the enrollment import
 * wizard can reach (dry-run, create batch, commit). Production passes nothing
 * and the page falls back to the real actions; the /dev/imports preview passes
 * inert stubs (it runs on localhost where .env.local may point at the
 * production database). Keys are the action names without the `Action`
 * suffix. Type-only imports: no server module enters the bundle through this
 * file.
 */
export interface EnrollmentImportActionOverrides {
  commitStudentEnrollmentImportBatch?: typeof commitStudentEnrollmentImportBatchAction;
  createStudentEnrollmentImportBatch?: typeof createStudentEnrollmentImportBatchAction;
  dryRunStudentEnrollmentImport?: typeof dryRunStudentEnrollmentImportAction;
}
