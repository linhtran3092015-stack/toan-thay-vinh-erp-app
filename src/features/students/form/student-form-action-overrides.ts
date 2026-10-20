import type {
  createStudentWithPrimaryGuardianAction,
  findStudentFormDuplicatesAction,
  updateStudentWithPrimaryGuardianAction,
} from "./student-form-actions";

/**
 * Optional replacements for the three server actions the student form can
 * reach: the duplicate lookup ("Kiểm tra hồ sơ trùng" and the lookup every
 * save runs first), create (/students/new) and update (/students/[id]/edit).
 * The form calls `actions?.createStudentWithPrimaryGuardian ??
 * createStudentWithPrimaryGuardianAction` with the same argument, so the real
 * routes pass nothing while the /dev/forms preview passes inert stubs (it runs
 * on localhost where .env.local may point at the production database).
 * Type-only import: no server module enters a bundle through this file.
 */
export interface StudentFormActionOverrides {
  createStudentWithPrimaryGuardian?: typeof createStudentWithPrimaryGuardianAction;
  findStudentFormDuplicates?: typeof findStudentFormDuplicatesAction;
  updateStudentWithPrimaryGuardian?: typeof updateStudentWithPrimaryGuardianAction;
}
