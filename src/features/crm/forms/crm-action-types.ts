import type { z } from "zod";
import type {
  addCaseNoteSchema,
  bookTrialSchema,
  changeCaseStatusSchema,
  completeFollowUpSchema,
  convertStudentSchema,
  createCrmCaseSchema,
  recordTrialResultSchema,
  transferLeadSchema,
} from "./crm-schemas";

export type CreateCrmCaseInput = z.infer<typeof createCrmCaseSchema>;
export type TransferLeadInput = z.infer<typeof transferLeadSchema>;
export type BookTrialInput = z.infer<typeof bookTrialSchema>;
export type ConvertStudentInput = z.infer<typeof convertStudentSchema>;
export type RecordTrialResultInput = z.infer<typeof recordTrialResultSchema>;
export type ChangeCaseStatusInput = z.infer<typeof changeCaseStatusSchema>;
export type AddCaseNoteInput = z.infer<typeof addCaseNoteSchema>;
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

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
