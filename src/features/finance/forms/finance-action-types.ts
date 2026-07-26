import type { z } from "zod";
import type {
  allocatePaymentSchema,
  createPaymentRequestSchema,
  processRefundSchema,
} from "./finance-schemas";

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>;
export type ProcessRefundInput = z.infer<typeof processRefundSchema>;

export type FinanceActionFieldErrors = Record<string, string[] | undefined>;

export type FinanceActionResultState =
  | {
      fieldErrors?: FinanceActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      id: string;
      message: string;
      status: "success";
    };
