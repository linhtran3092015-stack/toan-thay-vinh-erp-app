export interface SettingsRole {
  code: string;
  description: string | null;
  id: string;
  isActive: boolean;
  isSystem: boolean;
  name: string;
}

export interface SettingsPermission {
  code: string;
  description: string | null;
  id: string;
  isActive: boolean;
  module: string;
  name: string;
}

export interface SettingsRolePermissionGrant {
  permissionId: string;
  roleId: string;
}

export interface SettingsPermissionMatrix {
  grants: readonly SettingsRolePermissionGrant[];
  permissions: readonly SettingsPermission[];
  roles: readonly SettingsRole[];
}

export type SettingsInvitationStatus = "accepted" | "pending" | "revoked";

export interface SettingsAccountInvitation {
  acceptedAt: string | null;
  email: string;
  id: string;
  invitedAt: string;
  invitationReason: string;
  revokedAt: string | null;
  roleIds: readonly string[];
  status: SettingsInvitationStatus;
}

export type SettingsOwnerStatusResult =
  | { isOwner: boolean; ok: true }
  | { error: string; ok: false };

export type SettingsInvitationDataResult =
  | { invitations: readonly SettingsAccountInvitation[]; ok: true }
  | { error: { code: string; message: string }; ok: false };

export type SettingsDataResult =
  | {
      data: SettingsPermissionMatrix;
      ok: true;
    }
  | {
      error: {
        code:
          | "permissions_query_failed"
          | "role_permissions_query_failed"
          | "roles_query_failed";
        message: string;
      };
      ok: false;
    };
