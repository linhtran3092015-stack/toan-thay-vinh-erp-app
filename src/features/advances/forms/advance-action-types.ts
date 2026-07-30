import type { z } from "zod";

import type {
  approveSalaryAdvanceSchema,
  requestSalaryAdvanceSchema,
  reviewSalaryAdvanceSchema,
} from "@/features/advances/forms/advance-schemas";

export type RequestSalaryAdvanceInput = z.infer<typeof requestSalaryAdvanceSchema>;
export type ReviewSalaryAdvanceInput = z.infer<typeof reviewSalaryAdvanceSchema>;
export type ApproveSalaryAdvanceInput = z.infer<typeof approveSalaryAdvanceSchema>;

export interface AdvanceActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "error" | "success";
}
