import { getFormsPreviewPermissions } from "@/app/dev/forms/forms-preview-params";
import type { AuthUser } from "@/features/auth/types";
import type { PermissionCode } from "@/lib/permissions/types";

/*
 * Query params of /dev/imports (design 17c): one source for the page's
 * whitelist, the shell wrapper and the lane preview bodies.
 */

export type ImportsPreviewView = "students" | "enrollments" | "classes" | "class-batch" | "balances" | "balance-batch";
export type ImportsPreviewRole = "owner" | "maker" | "viewer";

export type StudentImportsPreviewState = "file" | "mapping" | "review-errors" | "review-clean" | "done";
export type EnrollmentImportsPreviewState = "file" | "review" | "batch" | "done";
export type ClassImportsPreviewState = "file" | "mapping" | "review-conflicts" | "review-clean";
export type ClassBatchImportsPreviewState = "ready" | "committed" | "previewed";
export type BalanceImportsPreviewState = "file" | "review" | "list";
export type BalanceBatchImportsPreviewState = "reconcile" | "approve" | "approve-own" | "post" | "posted";
export type ImportsPreviewState =
  | StudentImportsPreviewState
  | EnrollmentImportsPreviewState
  | ClassImportsPreviewState
  | ClassBatchImportsPreviewState
  | BalanceImportsPreviewState
  | BalanceBatchImportsPreviewState;

/** What each lane body receives; `state` always belongs to `view`. */
export type StudentImportPreviewProps = { role: ImportsPreviewRole; state: StudentImportsPreviewState; view: "students" };
export type EnrollmentImportPreviewProps = { role: ImportsPreviewRole; state: EnrollmentImportsPreviewState; view: "enrollments" };
export type ClassImportPreviewProps =
  | { role: ImportsPreviewRole; state: ClassImportsPreviewState; view: "classes" }
  | { role: ImportsPreviewRole; state: ClassBatchImportsPreviewState; view: "class-batch" };
export type BalanceImportPreviewProps =
  | { role: ImportsPreviewRole; state: BalanceImportsPreviewState; view: "balances" }
  | { role: ImportsPreviewRole; state: BalanceBatchImportsPreviewState; view: "balance-batch" };
export type ImportsPreviewParams =
  | StudentImportPreviewProps
  | EnrollmentImportPreviewProps
  | ClassImportPreviewProps
  | BalanceImportPreviewProps;

export const IMPORTS_PREVIEW_VIEWS: readonly ImportsPreviewView[] = [
  "students",
  "enrollments",
  "classes",
  "class-batch",
  "balances",
  "balance-batch",
];
export const IMPORTS_PREVIEW_ROLES: readonly ImportsPreviewRole[] = ["owner", "maker", "viewer"];

const studentStates: readonly StudentImportsPreviewState[] = ["file", "mapping", "review-errors", "review-clean", "done"];
const enrollmentStates: readonly EnrollmentImportsPreviewState[] = ["file", "review", "batch", "done"];
const classStates: readonly ClassImportsPreviewState[] = ["file", "mapping", "review-conflicts", "review-clean"];
const classBatchStates: readonly ClassBatchImportsPreviewState[] = ["ready", "committed", "previewed"];
const balanceStates: readonly BalanceImportsPreviewState[] = ["file", "review", "list"];
const balanceBatchStates: readonly BalanceBatchImportsPreviewState[] = ["reconcile", "approve", "approve-own", "post", "posted"];

/** Allowed `state` values per view; the first is the fallback. */
export const IMPORTS_PREVIEW_STATES: Readonly<Record<ImportsPreviewView, readonly ImportsPreviewState[]>> = {
  "balance-batch": balanceBatchStates,
  balances: balanceStates,
  "class-batch": classBatchStates,
  classes: classStates,
  enrollments: enrollmentStates,
  students: studentStates,
};

/**
 * The real route each view previews (the shell's active nav item and
 * breadcrumb). Never linked to: the batch views use a placeholder segment.
 */
export const IMPORTS_PREVIEW_PATHNAMES: Readonly<Record<ImportsPreviewView, string>> = {
  "balance-batch": "/imports/session-balances/batch-preview",
  balances: "/imports/session-balances",
  "class-batch": "/imports/classes/batch-preview",
  classes: "/imports/classes",
  enrollments: "/imports/enrollments",
  students: "/imports/students",
};

/** Fixed clock of every /dev/imports fixture (Vietnam business date). */
export const IMPORTS_PREVIEW_TODAY = "2026-10-19";

/**
 * Fixed shell users, one per preview role. Bodies use the same ids as the
 * signed-in user (e.g. `approve-own`: a batch created by the viewer).
 */
export const IMPORTS_PREVIEW_USERS: Readonly<Record<ImportsPreviewRole, AuthUser>> = {
  maker: { displayName: "Trần Thu Hà", email: "ha@example.com", id: "dev-maker", initials: "TH" },
  owner: { displayName: "Nguyễn Văn Vinh", email: "vinh@example.com", id: "dev-user", initials: "NV" },
  viewer: { displayName: "Lê Minh Châu", email: "chau@example.com", id: "dev-viewer", initials: "LC" },
};

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const first = Array.isArray(value) ? value[0] : value;
  return allowed.find((item) => item === first) ?? fallback;
}

/** Whitelists `view`, `role` and `state` (per view), each falling back to its first value. */
export function parseImportsPreviewParams(params: {
  role?: string | string[];
  state?: string | string[];
  view?: string | string[];
}): ImportsPreviewParams {
  const role = pick(params.role, IMPORTS_PREVIEW_ROLES, "owner");
  const view = pick(params.view, IMPORTS_PREVIEW_VIEWS, "students");
  switch (view) {
    case "enrollments":
      return { role, state: pick(params.state, enrollmentStates, enrollmentStates[0]), view };
    case "classes":
      return { role, state: pick(params.state, classStates, classStates[0]), view };
    case "class-batch":
      return { role, state: pick(params.state, classBatchStates, classBatchStates[0]), view };
    case "balances":
      return { role, state: pick(params.state, balanceStates, balanceStates[0]), view };
    case "balance-batch":
      return { role, state: pick(params.state, balanceBatchStates, balanceBatchStates[0]), view };
    default:
      return { role, state: pick(params.state, studentStates, studentStates[0]), view: "students" };
  }
}

/**
 * Permission codes per preview role, for the shell and for bodies that gate
 * on them. Owner: the /dev/forms owner set (every code but student_care.view),
 * so every `imports.*` code incl. `imports.session_balances.approve`,
 * `students.create` and `app.access`. Maker: app access and
 * `imports.session_balances` only (creates and reconciles balance batches,
 * cannot approve or post; every other import route shows its own denial).
 * Viewer: app access only.
 */
export function getImportsPreviewPermissions(role: ImportsPreviewRole): PermissionCode[] {
  if (role === "maker") return ["app.access", "imports.session_balances"];
  if (role === "viewer") return ["app.access"];
  return getFormsPreviewPermissions("owner");
}
