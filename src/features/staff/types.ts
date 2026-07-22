export type StaffEmploymentStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "unknown";

export interface StaffRoleSummary {
  assignedAt: string;
  code: string;
  id: string;
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

export type StaffDirectoryErrorCode =
  | "profiles_query_failed"
  | "assignments_query_failed"
  | "roles_query_failed";

export interface StaffDirectoryError {
  code: StaffDirectoryErrorCode;
  message: string;
}

export type StaffDirectoryResult =
  | {
      ok: true;
      members: readonly StaffDirectoryMember[];
    }
  | {
      ok: false;
      error: StaffDirectoryError;
    };
