import type {
  addCaseNoteAction,
  bookTrialAction,
  changeCaseStatusAction,
  completeFollowUpAction,
  convertStudentAction,
  createCrmCaseAction,
  recordTrialResultAction,
  transferLeadAction,
} from "./actions/crm-actions";

/**
 * Optional replacements for every CRM server action. Each CRM component takes
 * the one it calls and falls back to the real action, so the real pages pass
 * nothing while the /dev/crm preview passes inert stubs (it runs on localhost
 * where .env.local may point at the production database). Type-only imports:
 * no server module enters a bundle through this file.
 */
export interface CrmActionOverrides {
  addCaseNote?: typeof addCaseNoteAction;
  bookTrial?: typeof bookTrialAction;
  changeCaseStatus?: typeof changeCaseStatusAction;
  completeFollowUp?: typeof completeFollowUpAction;
  convertStudent?: typeof convertStudentAction;
  /** /crm/new keeps its form unchanged (step 15); listed so the stub set is complete. */
  createCrmCase?: typeof createCrmCaseAction;
  recordTrialResult?: typeof recordTrialResultAction;
  transferLead?: typeof transferLeadAction;
}
