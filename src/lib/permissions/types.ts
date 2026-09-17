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
  "imports.session_balances",
  "imports.session_balances.approve",
  "imports.classes",
  "imports.enrollments",
  "students.view",
  "students.create",
  "students.update",
  "students.manage_status",
  "students.reserve",
  "students.transfer_class",
  "coaching.view",
  "student_care.view",
  "student_care.handle",
  "student_care.assign",
  "student_care.configure",
  "coaching.manage",
  "coaching_forms.view",
  "coaching_forms.manage",
  "coaching_forms.publish",
  "coaching_forms.close",
  "coaching_links.manage",
  "coaching_responses.view",
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
  "staff.manage_payroll_profile",
  "staff.bank.view",
  "staff.bank.manage",
  "staff.roles.view",
  "staff.roles.manage",
  "timekeeping.view",
  "timekeeping.check",
  "timekeeping.approve_adjustment",
  "timekeeping.manage_verification",
  "advances.view",
  "advances.request",
  "advances.review",
  "advances.owner_approve",
  "payroll.view",
  "payroll.dashboard.view",
  "payroll.manage",
  "payroll.accountant_reconcile",
  "payroll.owner_approve",
  "payroll.policy.manage",
  "payroll.import",
  "payroll.feedback.resolve",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "payments.manage",
  "sepay.view",
  "sepay.allocate",
  "sepay.webhook_manage",
  "sepay.sync_history.manage",
  "refunds.manage",
  "cashflow.view",
  "commissions.view",
  "commissions.manage",
  "commissions.owner_adjust",
  "grading_credits.view",
  "grading_credits.view_all",
  "tuition_periods.view",
  "tuition_periods.manage",
  "tuition_periods.lock",
  "tuition_periods.export",
  "tuition_periods.adjust",
  "students.manage_tuition_rates",
  "students.correct_acquisition_source",
  "settings.receipts.manage",
  "settings.sepay_receiving_accounts.manage",
  "settings.view",
  "settings.manage",
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
