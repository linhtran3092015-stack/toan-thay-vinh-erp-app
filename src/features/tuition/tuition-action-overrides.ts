import type { publishTuitionTemplateAction, reissueTuitionItemAction } from "@/features/tuition/actions";

/**
 * Injectable stand-ins for the fee-notice writes: `/dev/fee-notices` passes
 * inert stubs, production omits them and the components fall back to the
 * real server actions.
 */
export interface TuitionNoticeActionOverrides {
  publish?: typeof publishTuitionTemplateAction;
  reissue?: typeof reissueTuitionItemAction;
}
