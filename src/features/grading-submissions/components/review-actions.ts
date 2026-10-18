import {
  ignoreGradingSubmissionAction,
  loadGradingMatchCandidatesAction,
  matchGradingSubmissionAction,
  rematchGradingSubmissionsAction,
} from "@/features/grading-submissions/actions";

/** The server actions the review screen calls; the dev preview and tests pass stand-ins. */
export interface GradingReviewActions {
  ignore: typeof ignoreGradingSubmissionAction;
  loadCandidates: typeof loadGradingMatchCandidatesAction;
  match: typeof matchGradingSubmissionAction;
  rematch: typeof rematchGradingSubmissionsAction;
}

export const gradingReviewServerActions: GradingReviewActions = {
  ignore: ignoreGradingSubmissionAction,
  loadCandidates: loadGradingMatchCandidatesAction,
  match: matchGradingSubmissionAction,
  rematch: rematchGradingSubmissionsAction,
};
