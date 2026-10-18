import { REPORT_CATALOG } from "@/features/reports/catalog";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

import type { ListsPreviewRole, ListsPreviewState, ListsPreviewView } from "./lists-preview";

/*
 * The permission codes each /dev/lists role holds, per view and state. One
 * source for the shell (nav, bell) and for the preview bodies that gate on
 * permissions (reports cards, the audit denial), so the two never disagree.
 */

// A teaching assistant: own credits only, no student or class pages. Like every
// role in the migrations it may request and view its own salary advances and
// view its own payroll (the advances preview's TA flags assume the same).
const taPermissions: readonly PermissionCode[] = [
  "advances.request",
  "advances.view",
  "attendance.mark",
  "attendance.view",
  "grading_credits.view",
  "payroll.view",
  "results.manage",
  "results.view",
  "sessions.view",
];

// The accountant (step 14b, design 16c): reviews salary advances, sees payroll, no sessions.
const accountantPermissions: readonly PermissionCode[] = ["advances.request", "advances.review", "advances.view", "payroll.view"];

// Step 14c finance views: the accountant's finance grants per migrations. Still no
// students.view, guardians.view, sessions.view or session_ledger.reverse.
const accountantFinancePermissions: readonly PermissionCode[] = [
  "cashflow.view",
  "finance.view",
  "payments.create_request",
  "payments.manage",
  "payments.view",
  "refunds.manage",
  "sepay.allocate",
  "sepay.view",
  "session_ledger.view",
  "tuition_periods.export",
  "tuition_periods.manage",
  "tuition_periods.view",
];

const financeViews: ReadonlySet<ListsPreviewView> = new Set(["finance-orders", "session-ledger", "payment-requests"]);

// Step 14d system views: per migrations every role with app access holds notifications.view,
// and reports.view comes with any domain view (the TA via sessions.view, the accountant via
// finance.view). audit.view stays owner-only, so the TA and the accountant get the route's denial.
const systemViews: ReadonlySet<ListsPreviewView> = new Set(["notifications", "audit", "reports"]);
const systemPermissions: readonly PermissionCode[] = ["notifications.view", "reports.view"];

// The module views a reports catalog card needs; "empty" on the reports view drops them all.
const reportCatalogPermissions: ReadonlySet<PermissionCode> = new Set(REPORT_CATALOG.map((report) => report.requiredPermission));

function rolePermissions(role: ListsPreviewRole, view: ListsPreviewView): PermissionCode[] {
  const system = systemViews.has(view) ? systemPermissions : [];
  if (role === "ta") return [...taPermissions, ...system];
  if (role === "accountant") {
    return financeViews.has(view) ? [...accountantPermissions, ...accountantFinancePermissions] : [...accountantPermissions, ...system];
  }
  return DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view");
}

export function getListsPreviewPermissions(role: ListsPreviewRole, view: ListsPreviewView, state: ListsPreviewState): PermissionCode[] {
  const permissions = rolePermissions(role, view);
  // Reports "empty": the role without any module view the catalog reads, so no card is visible.
  return view === "reports" && state === "empty" ? permissions.filter((code) => !reportCatalogPermissions.has(code)) : permissions;
}
