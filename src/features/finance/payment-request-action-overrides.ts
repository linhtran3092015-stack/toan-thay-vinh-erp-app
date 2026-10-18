import type { cancelPaymentRequestAction } from "./actions/finance-actions";

/**
 * Optional replacements for the server actions the payment-request list can
 * reach (today only "Hủy phiếu"). The cancel dialog takes the one it calls and
 * falls back to the real action, so the real page passes nothing while the
 * /dev/lists preview passes an inert stub (it runs on localhost where
 * .env.local may point at the production database). Type-only import: no
 * server module enters a bundle through this file.
 */
export interface PaymentRequestActionOverrides {
  cancelPaymentRequest?: typeof cancelPaymentRequestAction;
}
