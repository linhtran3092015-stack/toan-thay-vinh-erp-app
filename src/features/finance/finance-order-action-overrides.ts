import type { setFinanceOrderReviewAction } from "./actions/finance-actions";

/**
 * Optional replacement for the order review server action. The orders page
 * calls `actions?.setFinanceOrderReview ?? setFinanceOrderReviewAction` with
 * the same positional arguments, so the real route passes nothing while the
 * /dev/lists preview passes an inert stub (it runs on localhost where
 * .env.local may point at the production database). Type-only import: no
 * server module enters a bundle through this file.
 */
export interface FinanceOrderActionOverrides {
  setFinanceOrderReview?: typeof setFinanceOrderReviewAction;
}
