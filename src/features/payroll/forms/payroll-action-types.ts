import type { z } from "zod";

import type {
  addPayrollManualLineSchema,
  createPayrollDraftSchema,
  payrollPeriodActionSchema,
} from "@/features/payroll/forms/payroll-schemas";

export type CreatePayrollDraftInput = z.infer<typeof createPayrollDraftSchema>;
export type AddPayrollManualLineInput = z.infer<typeof addPayrollManualLineSchema>;
export type PayrollPeriodActionInput = z.infer<typeof payrollPeriodActionSchema>;

export interface PayrollActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "error" | "success";
}
