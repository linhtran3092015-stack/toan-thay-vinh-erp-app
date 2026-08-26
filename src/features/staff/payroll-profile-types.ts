import { z } from "zod";

export const payrollPositionCodes = [
  "teaching_assistant",
  "operations_assistant",
  "admissions_manager",
] as const;

export type PayrollPositionCode = (typeof payrollPositionCodes)[number];

export const payrollPositionLabels: Record<PayrollPositionCode, string> = {
  admissions_manager: "Quản lý tuyển sinh",
  operations_assistant: "Trợ lý vận hành",
  teaching_assistant: "Trợ giảng",
};

export const payrollTaskCodes = [
  "center_renewal_duty",
  "record_excess",
  "payroll_processing",
  "staff_recruitment_care",
  "student_coaching",
  "daily_admin_reporting",
  "addon_product_sales",
] as const;

export type PayrollTaskCode = (typeof payrollTaskCodes)[number];

export const payrollTaskLabels: Record<PayrollTaskCode, string> = {
  addon_product_sales: "Bán sản phẩm phụ",
  center_renewal_duty: "Quản lý nhân sự và trực tin nhắn",
  daily_admin_reporting: "Nhập dòng tiền và báo cáo tăng trưởng",
  payroll_processing: "Tính lương nhân sự",
  record_excess: "Cải tiến quy trình và doanh thu vượt kỷ lục",
  staff_recruitment_care: "Tuyển dụng và chăm sóc nhân sự",
  student_coaching: "Coaching học sinh",
};

const positionVersionSchema = z.object({
  createdAt: z.string(),
  effectiveFrom: z.string(),
  id: z.string().uuid(),
  positionCode: z.enum(payrollPositionCodes),
  reason: z.string(),
});

const dailyRateVersionSchema = z.object({
  createdAt: z.string(),
  effectiveFrom: z.string(),
  id: z.string().uuid(),
  note: z.string().nullable(),
  offlineDailyRateVnd: z.number().int().nonnegative(),
  onlineDailyRateVnd: z.number().int().nonnegative(),
  onlineRateBasisPoints: z.number().int().min(0).max(10_000),
  reason: z.string(),
});

const gradeAssignmentSchema = z.object({
  createdAt: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  grade: z.number().int().min(2).max(12),
  id: z.string().uuid(),
  reason: z.string(),
});

const taskVersionSchema = z.object({
  createdAt: z.string(),
  effectiveFrom: z.string(),
  id: z.string().uuid(),
  isEnabled: z.boolean(),
  reason: z.string(),
  taskCode: z.enum(payrollTaskCodes),
});

const bankAccountSchema = z.object({
  accountHolderName: z.string(),
  accountNumber: z.string(),
  approvedAt: z.string(),
  bankName: z.string(),
  effectiveFrom: z.string(),
  id: z.string().uuid(),
  isMasked: z.boolean(),
});

const bankChangeRequestSchema = z.object({
  accountHolderName: z.string(),
  accountNumber: z.string(),
  bankName: z.string(),
  effectiveFrom: z.string(),
  id: z.string().uuid(),
  isMasked: z.boolean(),
  reason: z.string(),
  requestedAt: z.string(),
  reviewNote: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
});

export const staffPayrollProfileSchema = z.object({
  bankAccounts: z.array(bankAccountSchema),
  bankChangeRequests: z.array(bankChangeRequestSchema),
  dailyRates: z.array(dailyRateVersionSchema),
  gradeAssignments: z.array(gradeAssignmentSchema),
  positions: z.array(positionVersionSchema),
  staffId: z.string().uuid(),
  tasks: z.array(taskVersionSchema),
});

export type StaffPayrollProfile = z.infer<typeof staffPayrollProfileSchema>;
export type StaffDailyRateVersion = StaffPayrollProfile["dailyRates"][number];
export type StaffPayrollPositionVersion = StaffPayrollProfile["positions"][number];
export type StaffGradeAssignment = StaffPayrollProfile["gradeAssignments"][number];
export type StaffPayrollTaskVersion = StaffPayrollProfile["tasks"][number];
export type StaffBankAccount = StaffPayrollProfile["bankAccounts"][number];
