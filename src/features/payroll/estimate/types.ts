import { z } from "zod";

export type PayrollEstimateStatus = "estimated" | "approved";
export type PayrollCompleteness = "complete" | "partial";
export type PayrollConnectionState = "connected" | "reconnecting" | "stale" | "error";

export const staffEstimateStatementSchema = z.object({
  advanceDeductionsVnd: z.number().int().default(0),
  payableVnd: z.number().int().default(0),
  pendingVerificationCount: z.number().int().default(0),
  positionCode: z.string().nullable().default(null),
  staffDisplayName: z.string().default(""),
  staffEmployeeCode: z.string().nullable().default(null),
  staffId: z.string().uuid(),
  totalDeductionsVnd: z.number().int().default(0),
  totalEarningsVnd: z.number().int().default(0),
  workHours: z.number().int().default(0),
  workedMinutes: z.number().int().default(0),
  workUnits: z.number().int().default(0),
});

export type StaffEstimateStatement = z.infer<typeof staffEstimateStatementSchema>;

export const staffEstimateLineSchema = z.object({
  amountVnd: z.number().int().default(0),
  direction: z.enum(["earning", "deduction"]),
  isPendingVerification: z.boolean().optional(),
  lineType: z.string(),
  note: z.string().nullable().default(null),
  policyCode: z.string().nullable().default(null),
  unitLabel: z.string().nullable().default(null),
  unitRateVnd: z.number().int().nullable().default(null),
  workedMinutes: z.number().int().nullable().default(null),
});

export type StaffEstimateLine = z.infer<typeof staffEstimateLineSchema>;

export const staffRecentShiftSchema = z.object({
  checkInAt: z.string().nullable().default(null),
  checkOutAt: z.string().nullable().default(null),
  id: z.string().uuid(),
  isPendingVerification: z.boolean().default(false),
  workDate: z.string(),
  workedMinutes: z.number().int().default(0),
  workMode: z.string().default("offline"),
});

export type StaffRecentShift = z.infer<typeof staffRecentShiftSchema>;

export const staffOpenShiftSchema = z.object({
  checkInAt: z.string(),
  id: z.string().uuid(),
  workDate: z.string(),
  workMode: z.string().default("offline"),
});

export type StaffOpenShift = z.infer<typeof staffOpenShiftSchema>;

export const staffPayrollEstimateSchema = z.object({
  approvedAt: z.string().nullable().optional(),
  asOf: z.string(),
  calculatedAt: z.string(),
  completeness: z.enum(["complete", "partial"]).default("complete"),
  issues: z.array(z.object({
    details: z.record(z.string(), z.unknown()).optional(),
    issueCode: z.string(),
    staffId: z.string().uuid().optional(),
  })).default([]),
  latestCompletedWorkAt: z.string().nullable().default(null),
  lines: z.array(staffEstimateLineSchema).default([]),
  month: z.string(),
  openShifts: z.array(staffOpenShiftSchema).default([]),
  payrollPeriodId: z.string().uuid().optional(),
  payrollStatementId: z.string().uuid().optional(),
  recentShifts: z.array(staffRecentShiftSchema).default([]),
  statement: staffEstimateStatementSchema.nullable().default(null),
  status: z.enum(["estimated", "approved"]).default("estimated"),
});

export type StaffPayrollEstimate = z.infer<typeof staffPayrollEstimateSchema>;

export const ownerPositionSummarySchema = z.object({
  payableVnd: z.number().int().default(0),
  positionCode: z.string(),
  staffCount: z.number().int().default(0),
  totalDeductionsVnd: z.number().int().default(0),
  totalEarningsVnd: z.number().int().default(0),
});

export type OwnerPositionSummary = z.infer<typeof ownerPositionSummarySchema>;

export const ownerFinanceSchema = z.object({
  payrollRatioPercent: z.number().nullable().optional(),
  status: z.enum(["available", "restricted"]).default("available"),
  tuitionNetVnd: z.number().int().optional(),
  tuitionReceivedVnd: z.number().int().optional(),
  tuitionRefundedVnd: z.number().int().optional(),
});

export type OwnerFinance = z.infer<typeof ownerFinanceSchema>;

export const ownerPayrollEstimateSchema = z.object({
  approvedAt: z.string().nullable().optional(),
  asOf: z.string(),
  byPosition: z.array(ownerPositionSummarySchema).default([]),
  calculatedAt: z.string(),
  completeness: z.enum(["complete", "partial"]).default("complete"),
  finance: ownerFinanceSchema,
  financeAsOf: z.string().optional(),
  issues: z.array(z.object({
    details: z.record(z.string(), z.unknown()).optional(),
    issueCode: z.string(),
    staffId: z.string().uuid().optional(),
  })).default([]),
  latestCompletedWorkAt: z.string().nullable().default(null),
  month: z.string(),
  payrollPeriodId: z.string().uuid().optional(),
  payrollSourceCutoff: z.string().optional(),
  selectedPositionCode: z.string().nullable().default(null),
  statements: z.array(staffEstimateStatementSchema).default([]),
  status: z.enum(["estimated", "approved"]).default("estimated"),
  summary: z.object({
    advanceDeductionsVnd: z.number().int().default(0),
    payableVnd: z.number().int().default(0),
    pendingVerificationCount: z.number().int().default(0),
    staffCount: z.number().int().default(0),
    totalDeductionsVnd: z.number().int().default(0),
    totalEarningsVnd: z.number().int().default(0),
  }),
});

export type OwnerPayrollEstimate = z.infer<typeof ownerPayrollEstimateSchema>;
