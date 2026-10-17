"use client";

import type { StaffRoleActionOverrides } from "@/features/staff/components/staff-role-management";
import type { StaffRoleActionState } from "@/features/staff/role-action-types";
import { StaffDirectoryPage } from "@/features/staff/staff-directory-page";

import { previewStaffMembers, previewStaffMembersWithoutRoles, previewStaffRoleOptions } from "./staff-fixtures";

export type StaffPreviewRole = "owner" | "ta" | "accountant";
export type StaffPreviewState = "normal" | "capped" | "empty";

const STUB = "Bản xem trước không ghi dữ liệu.";
const stub = async (): Promise<StaffRoleActionState> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for the two role server actions (assign, revoke). The
 * preview runs on localhost where .env.local may point at production, so the
 * inline role forms must never reach `assign_user_role` / `revoke_user_role_assignment`.
 */
export const previewStaffRoleActions: Required<StaffRoleActionOverrides> = {
  assign: stub,
  revoke: stub,
};

/**
 * Body of /dev/lists?view=staff (the controller wraps it in AppShell): the real
 * StaffDirectoryPage over fixtures, with stubbed role actions.
 *
 * - owner: `staff.roles.view` + `staff.roles.manage`, so role badges, the
 *   "Vai trò" filter and the inline role management show; `settings.view`
 *   too, so the "Tài khoản và lời mời" header link shows.
 * - ta / accountant: `staff.view` is owner-only in production (no other role is
 *   granted it), so these roles would get the route's permission-denied state.
 *   The preview still renders the list as it looks without `staff.roles.view`
 *   (the loader then returns `roles: null` and no role options) and without
 *   `settings.view` (no accounts link) so that layout can be reviewed.
 * - capped: the staff loader has no row limit (every non-deleted profile), so
 *   there is no capped view; it renders the normal list.
 * - empty: no members, the page's in-frame empty state (the real route shows
 *   its own EmptyState before reaching the page).
 */
export function StaffPreviewBody({ role, state }: { role: StaffPreviewRole; state: StaffPreviewState }) {
  const canViewRoles = role === "owner";
  const members = state === "empty" ? [] : canViewRoles ? previewStaffMembers : previewStaffMembersWithoutRoles;

  return (
    <StaffDirectoryPage
      actions={previewStaffRoleActions}
      canManageRoles={canViewRoles}
      canOpenAccounts={role === "owner"}
      canViewRoles={canViewRoles}
      members={members}
      roleOptions={canViewRoles ? previewStaffRoleOptions : []}
    />
  );
}
