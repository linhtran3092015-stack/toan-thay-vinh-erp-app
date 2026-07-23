export type StudentLifecycleStatus =
  | "active"
  | "completed"
  | "interested"
  | "pending_enrollment_confirmation"
  | "reserved"
  | "resumed"
  | "trial_booked"
  | "trial_completed"
  | "waiting_class";

export type UserRole =
  | "academic_admin"
  | "accountant"
  | "admin"
  | "consultant"
  | "owner"
  | "teacher"
  | "viewer";

export type PermissionCode =
  | "advances.view"
  | "attendance.mark"
  | "attendance.view"
  | "audit.view"
  | "cashflow.view"
  | "classes.create"
  | "classes.manage_schedule"
  | "classes.view"
  | "coaching.view"
  | "commissions.view"
  | "crm.transfer"
  | "crm.update"
  | "crm.view"
  | "dashboard.view"
  | "finance.view"
  | "guardians.view"
  | "imports.students"
  | "notifications.view"
  | "payroll.view"
  | "payments.view"
  | "permissions.manage"
  | "refunds.view"
  | "reports.view"
  | "results.view"
  | "sepay.accountant_confirm"
  | "sepay.view"
  | "session_ledger.view"
  | "sessions.view"
  | "settings.view"
  | "staff.view"
  | "students.confirm_official"
  | "students.create"
  | "students.export"
  | "students.reserve"
  | "students.transfer_class"
  | "students.update"
  | "students.view"
  | "timekeeping.view"
  | "users.manage";

export interface CurrentUser {
  id: string;
  fullName: string;
  initials: string;
  roleLabel: string;
  roleCode: UserRole;
  organizationName: string;
  academicYear: string;
  permissions: PermissionCode[];
  branchName?: string;
  email?: string;
}
