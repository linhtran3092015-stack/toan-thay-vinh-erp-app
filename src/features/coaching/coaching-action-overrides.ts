import type {
  addCoachingNoteAction,
  advanceCoachingStatusAction,
  createCoachingRecordAction,
} from "./actions/coaching-actions";
import type {
  createCoachingFormVersionDraftAction,
  issueCoachingPublicLinkAction,
  publishCoachingFormAction,
  revokeCoachingPublicLinkAction,
  saveCoachingFormDraftAction,
} from "./actions/coaching-form-actions";
import type { submitPublicCoachingFormAction } from "./actions/public-coaching-form-actions";

/**
 * Optional replacements for every Coaching server action. Each Coaching
 * component takes the ones it calls and falls back to the real action, so the
 * real pages pass nothing while the /dev/coaching preview passes inert stubs
 * (it runs on localhost where .env.local may point at the production
 * database). Type-only imports: no server module enters a bundle through this
 * file.
 */
export interface CoachingActionOverrides {
  addCoachingNote?: typeof addCoachingNoteAction;
  advanceCoachingStatus?: typeof advanceCoachingStatusAction;
  /** The /coaching list keeps its create dialog (step 14); listed so the stub set is complete. */
  createCoachingRecord?: typeof createCoachingRecordAction;
  createCoachingFormVersionDraft?: typeof createCoachingFormVersionDraftAction;
  issueCoachingPublicLink?: typeof issueCoachingPublicLinkAction;
  publishCoachingForm?: typeof publishCoachingFormAction;
  revokeCoachingPublicLink?: typeof revokeCoachingPublicLinkAction;
  saveCoachingFormDraft?: typeof saveCoachingFormDraftAction;
  submitPublicCoachingForm?: typeof submitPublicCoachingFormAction;
}
