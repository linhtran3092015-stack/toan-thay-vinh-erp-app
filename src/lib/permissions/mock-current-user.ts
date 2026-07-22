import type { CurrentUser, PermissionCode } from "@/types/domain";

export const allBootstrapPermissions: PermissionCode[] = [
  "dashboard.view",
  "notifications.view",
  "settings.view",
  "students.view",
  "students.create",
  "students.update",
  "students.transfer_class",
  "students.reserve",
  "students.confirm_official",
  "students.export",
  "classes.view",
  "sessions.view",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "finance.view",
  "payments.view",
  "sepay.view",
  "sepay.accountant_confirm",
  "refunds.view",
  "session_ledger.view",
  "cashflow.view",
  "crm.view",
  "crm.update",
  "crm.transfer",
  "staff.view",
  "timekeeping.view",
  "payroll.view",
  "advances.view",
  "commissions.view",
  "coaching.view",
  "reports.view",
  "users.manage",
  "permissions.manage",
  "audit.view",
  "imports.students",
];

export const mockCurrentUser: CurrentUser = {
  id: "mock-owner",
  fullName: "Nguyễn Văn Vinh",
  initials: "NV",
  roleLabel: "Chủ trung tâm",
  roleCode: "owner",
  organizationName: "TOÁN THẦY VINH",
  academicYear: "Năm học 2024 - 2025",
  permissions: allBootstrapPermissions,
};

export function hasPermission(
  user: CurrentUser,
  permission: PermissionCode,
): boolean {
  return user.permissions.includes(permission);
}
