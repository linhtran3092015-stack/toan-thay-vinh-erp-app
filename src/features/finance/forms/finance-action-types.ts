import type { z } from "zod";
import type {
  allocatePaymentSchema,
  createPaymentRequestSchema,
} from "./finance-schemas";

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>;

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
      paymentRequest?: {
        accountHolder?: string;
        accountNumber: string;
        bankCode: string;
        expectedAmountVnd: number;
        publicCode: string;
        qrImageUrl: string;
        transferCode: string;
        transferDescription: string;
      };
      status: "success";
    };
