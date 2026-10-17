import type {
  approveSalaryAdvanceAction,
  requestSalaryAdvanceAction,
  reviewSalaryAdvanceAction,
} from "./actions/advance-actions";

/**
 * Optional replacements for the salary advance server actions. The dialogs
 * take the one they call and fall back to the real action, so the real page
 * passes nothing while the /dev/lists preview passes inert stubs (it runs on
 * localhost where .env.local may point at the production database). Type-only
 * imports: no server module enters a bundle through this file.
 */
export interface AdvanceActionOverrides {
  approveSalaryAdvance?: typeof approveSalaryAdvanceAction;
  requestSalaryAdvance?: typeof requestSalaryAdvanceAction;
  reviewSalaryAdvance?: typeof reviewSalaryAdvanceAction;
}
