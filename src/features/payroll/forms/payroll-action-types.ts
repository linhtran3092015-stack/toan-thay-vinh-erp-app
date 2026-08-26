import type { z } from "zod";

import type {
  addPayrollManualLineSchema,
  createPayrollDraftSchema,
  createPayrollImportBatchSchema,
  decidePayrollImportBatchSchema,
  payrollPeriodActionSchema,
  recalculatePayrollSchema,
  resolvePayrollCorrectionSchema,
  submitPayrollCorrectionSchema,
} from "@/features/payroll/forms/payroll-schemas";

export type CreatePayrollDraftInput = z.infer<typeof createPayrollDraftSchema>;
export type AddPayrollManualLineInput = z.infer<typeof addPayrollManualLineSchema>;
export type PayrollPeriodActionInput = z.infer<typeof payrollPeriodActionSchema>;
export type RecalculatePayrollInput = z.infer<typeof recalculatePayrollSchema>;
export type SubmitPayrollCorrectionInput = z.infer<typeof submitPayrollCorrectionSchema>;
export type ResolvePayrollCorrectionInput = z.infer<typeof resolvePayrollCorrectionSchema>;
export type CreatePayrollImportBatchInput = z.infer<typeof createPayrollImportBatchSchema>;
export type DecidePayrollImportBatchInput = z.infer<typeof decidePayrollImportBatchSchema>;

export interface PayrollActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: "error" | "success";
}
