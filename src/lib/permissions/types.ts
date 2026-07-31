export const DATABASE_PERMISSION_CODES = [
  "app.access",
  "dashboard.view",
  "reports.view",
  "notifications.view",
  "classes.view",
  "classes.create",
  "classes.manage_schedule",
  "guardians.view",
  "imports.students",
  "students.view",
  "students.create",
  "students.update",
  "students.manage_status",
  "students.reserve",
  "students.transfer_class",
  "coaching.view",
  "coaching.manage",
  "crm.view",
  "crm.update",
  "crm.transfer",
  "students.confirm_official",
  "sepay.accountant_confirm",
  "sessions.view",
  "sessions.manage",
  "sessions.lock",
  "attendance.view",
  "attendance.mark",
  "results.view",
  "results.manage",
  "session_ledger.view",
  "session_ledger.reverse",
  "audit.view",
  "staff.view",
  "staff.manage",
  "staff.manage_rates",
  "staff.roles.view",
  "staff.roles.manage",
  "timekeeping.view",
  "timekeeping.check",
  "timekeeping.approve_adjustment",
  "advances.view",
  "advances.request",
  "advances.review",
  "advances.owner_approve",
  "payroll.view",
  "payroll.manage",
  "payroll.accountant_reconcile",
  "payroll.owner_approve",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "payments.manage",
  "sepay.view",
  "sepay.allocate",
  "sepay.webhook_manage",
  "refunds.manage",
  "cashflow.view",
  "commissions.view",
  "commissions.manage",
  "commissions.owner_adjust",
  "grading_credits.view",
  "grading_credits.view_all",
] as const;

export type PermissionCode = (typeof DATABASE_PERMISSION_CODES)[number];

export type DatabasePermissionErrorCode =
  | "configuration_missing"
  | "invalid_response"
  | "not_authenticated"
  | "query_failed";

export interface DatabasePermissionError {
  code: DatabasePermissionErrorCode;
  message: string;
}

export type DatabasePermissionsResult =
  | {
      ok: true;
      permissions: readonly PermissionCode[];
    }
  | {
      ok: false;
      error: DatabasePermissionError;
    };

export type DatabasePermissionCheckResult =
  | {
      ok: true;
      allowed: boolean;
    }
  | {
      ok: false;
      error: DatabasePermissionError;
    };
