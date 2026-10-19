import type { commitStudentImportRowsAction, validateStudentImportRowsAction } from "./actions";

/**
 * Optional replacements for the two server actions the student import wizard
 * can reach (dry-run check and commit). Production passes nothing and the page
 * falls back to the real actions; the /dev/imports preview passes inert stubs
 * (it runs on localhost where .env.local may point at the production
 * database). Keys are the action names without the `Action` suffix.
 * Type-only imports: no server module enters the bundle through this file.
 */
export interface StudentImportActionOverrides {
  commitStudentImportRows?: typeof commitStudentImportRowsAction;
  validateStudentImportRows?: typeof validateStudentImportRowsAction;
}
