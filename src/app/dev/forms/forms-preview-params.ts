import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

/*
 * Query params of /dev/forms (design 17a/17b): one source for the page's
 * whitelist, the shell wrapper and the lane preview bodies.
 */

export type FormsPreviewView = "student" | "student-edit" | "class" | "class-edit" | "batch";
export type FormsPreviewRole = "owner" | "ta" | "viewer";

export type StudentFormsPreviewState = "clean" | "dirty" | "error" | "duplicate" | "sibling";
export type ClassFormsPreviewState = "clean" | "error" | "no-year";
export type BatchFormsPreviewState = "default" | "holidays" | "capped" | "empty";
export type FormsPreviewState = StudentFormsPreviewState | ClassFormsPreviewState | BatchFormsPreviewState;

/** What each lane body receives; `state` always belongs to `view`. */
export type StudentFormsPreviewProps = { role: FormsPreviewRole; state: StudentFormsPreviewState; view: "student" | "student-edit" };
export type ClassFormsPreviewProps = { role: FormsPreviewRole; state: ClassFormsPreviewState; view: "class" | "class-edit" };
export type BatchFormsPreviewProps = { role: FormsPreviewRole; state: BatchFormsPreviewState; view: "batch" };
export type FormsPreviewParams = StudentFormsPreviewProps | ClassFormsPreviewProps | BatchFormsPreviewProps;

export const FORMS_PREVIEW_VIEWS: readonly FormsPreviewView[] = ["student", "student-edit", "class", "class-edit", "batch"];
export const FORMS_PREVIEW_ROLES: readonly FormsPreviewRole[] = ["owner", "ta", "viewer"];

const studentStates: readonly StudentFormsPreviewState[] = ["clean", "dirty", "error", "duplicate", "sibling"];
const classStates: readonly ClassFormsPreviewState[] = ["clean", "error", "no-year"];
const batchStates: readonly BatchFormsPreviewState[] = ["default", "holidays", "capped", "empty"];

/** Allowed `state` values per view; the first is the fallback. */
export const FORMS_PREVIEW_STATES: Readonly<Record<FormsPreviewView, readonly FormsPreviewState[]>> = {
  batch: batchStates,
  class: classStates,
  "class-edit": classStates,
  student: studentStates,
  "student-edit": studentStates,
};

/** The real route each view previews (the shell's active nav item and breadcrumb). Never linked to. */
export const FORMS_PREVIEW_PATHNAMES: Readonly<Record<FormsPreviewView, string>> = {
  batch: "/sessions/batch",
  class: "/classes/new",
  "class-edit": "/classes/cls-preview/edit",
  student: "/students/new",
  "student-edit": "/students/hs-preview/edit",
};

/** Fixed clock of every /dev/forms fixture (Vietnam business date). */
export const FORMS_PREVIEW_TODAY = "2026-10-19";

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const first = Array.isArray(value) ? value[0] : value;
  return allowed.find((item) => item === first) ?? fallback;
}

/** Whitelists `view`, `role` and `state` (per view), each falling back to its first value. */
export function parseFormsPreviewParams(params: {
  role?: string | string[];
  state?: string | string[];
  view?: string | string[];
}): FormsPreviewParams {
  const role = pick(params.role, FORMS_PREVIEW_ROLES, "owner");
  const view = pick(params.view, FORMS_PREVIEW_VIEWS, "student");
  if (view === "batch") return { role, state: pick(params.state, batchStates, batchStates[0]), view };
  if (view === "class" || view === "class-edit") return { role, state: pick(params.state, classStates, classStates[0]), view };
  return { role, state: pick(params.state, studentStates, studentStates[0]), view };
}

/**
 * Permission codes per preview role, for the shell and for bodies that gate on
 * them. Owner: every code except student_care.view (the shell would mount the
 * care queue's refresh loop, as in /dev/lists). TA: app access and
 * sessions.manage only (no classes.view, students.create or classes.create),
 * so each route shows its own denial. Viewer: app access only.
 */
export function getFormsPreviewPermissions(role: FormsPreviewRole): PermissionCode[] {
  if (role === "ta") return ["app.access", "sessions.manage"];
  if (role === "viewer") return ["app.access"];
  return DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view");
}
