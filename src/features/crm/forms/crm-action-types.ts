import type { z } from "zod";
import type {
  bookTrialSchema,
  convertStudentSchema,
  createCrmCaseSchema,
  transferLeadSchema,
} from "./crm-schemas";

export type CreateCrmCaseInput = z.infer<typeof createCrmCaseSchema>;
export type TransferLeadInput = z.infer<typeof transferLeadSchema>;
export type BookTrialInput = z.infer<typeof bookTrialSchema>;
export type ConvertStudentInput = z.infer<typeof convertStudentSchema>;

export type CrmActionFieldErrors = Record<string, string[] | undefined>;

export type CrmActionResultState =
  | {
      fieldErrors?: CrmActionFieldErrors;
      message: string;
      status: "error";
    }
  | {
      id: string;
      message: string;
      status: "success";
    };
