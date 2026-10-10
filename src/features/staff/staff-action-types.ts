export type StaffManagementActionStatus = "idle" | "error" | "success";

export interface StaffManagementActionState {
  fieldErrors?: Record<string, string[] | undefined>;
  message: string;
  status: StaffManagementActionStatus;
}

export interface UpdateStaffProfileActionInput {
  displayName: string;
  employeeCode: string;
  employmentStatus: "active" | "inactive" | "suspended";
  joinedAt: string;
  leftAt: string;
  phone: string;
  reason: string;
  staffId: string;
}

export interface CreateStaffRateVersionActionInput {
  effectiveFrom: string;
  note: string;
  offlineDailyRateVnd: number;
  reason: string;
  staffId: string;
}

export interface ConfigureStaffPayrollCompensationActionInput
  extends CreateStaffRateVersionActionInput {
  positionCode:
    | "teaching_assistant"
    | "operations_assistant"
    | "admissions_manager";
}

export interface CreateStaffGradeAssignmentActionInput {
  effectiveFrom: string;
  effectiveTo: string;
  grade: number;
  reason: string;
  staffId: string;
}

export interface EndStaffGradeAssignmentActionInput {
  assignmentId: string;
  effectiveTo: string;
  reason: string;
  staffId: string;
}

export interface CreateStaffPayrollTaskVersionActionInput {
  effectiveFrom: string;
  isEnabled: boolean;
  reason: string;
  staffId: string;
  taskCode:
    | "center_renewal_duty"
    | "record_excess"
    | "payroll_processing"
    | "staff_recruitment_care"
    | "student_coaching"
    | "daily_admin_reporting"
    | "addon_product_sales";
}

export interface SubmitStaffBankAccountChangeActionInput {
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  effectiveFrom: string;
  reason: string;
  staffId: string;
}

export interface DecideStaffBankAccountChangeActionInput {
  decision: "approved" | "rejected";
  requestId: string;
  reviewNote: string;
  staffId: string;
}

export const initialStaffManagementActionState: StaffManagementActionState = {
  message: "",
  status: "idle",
};
