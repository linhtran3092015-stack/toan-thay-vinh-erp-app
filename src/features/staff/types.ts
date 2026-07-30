export type StaffEmploymentStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "unknown";

export interface StaffRoleSummary {
  assignedAt: string;
  assignmentId: string;
  code: string;
  id: string;
  name: string;
}

export interface StaffRoleOption {
  code: string;
  description: string | null;
  id: string;
  isSystem: boolean;
  name: string;
}

export interface StaffDirectoryMember {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  employeeCode: string | null;
  employmentStatus: StaffEmploymentStatus;
  id: string;
  joinedAt: string | null;
  lastLoginAt: string | null;
  leftAt: string | null;
  phone: string | null;
  roles: readonly StaffRoleSummary[] | null;
}

export interface StaffRateVersion {
  createdAt: string;
  effectiveFrom: string;
  id: string;
  note: string | null;
  offlineHourlyRateVnd: number;
  onlineHourlyRateVnd: number;
}

export interface StaffDetailReadModel extends StaffDirectoryMember {
  profileDisplayName: string | null;
  rateVersions: readonly StaffRateVersion[] | null;
}

export type StaffDirectoryErrorCode =
  | "profiles_query_failed"
  | "assignments_query_failed"
  | "roles_query_failed";

export type StaffDetailErrorCode =
  | StaffDirectoryErrorCode
  | "profile_not_found"
  | "rate_versions_query_failed";

export interface StaffDirectoryError {
  code: StaffDirectoryErrorCode;
  message: string;
}

export interface StaffDetailError {
  code: StaffDetailErrorCode;
  message: string;
}

export type StaffDirectoryResult =
  | {
      ok: true;
      members: readonly StaffDirectoryMember[];
      roleOptions: readonly StaffRoleOption[] | null;
    }
  | {
      ok: false;
      error: StaffDirectoryError;
    };

export type StaffDetailResult =
  | {
      ok: true;
      detail: StaffDetailReadModel;
    }
  | {
      ok: false;
      error: StaffDetailError;
    };
