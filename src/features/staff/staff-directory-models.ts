import { normalizeSearchText } from "@/lib/search";

import type { StaffDirectoryMember, StaffEmploymentStatus, StaffRoleOption } from "./types";

/**
 * Pure helpers for the staff directory (design 16a): filter state, role
 * options, status chip counts, filtering and paging over the loaded members.
 * No server-only or browser imports so the client page and tests share them.
 * Every helper keeps the loader's order (display name); nothing re-sorts rows.
 */

export const STAFF_DIRECTORY_PAGE_SIZE = 20;
export const ALL_STAFF_OPTION = "all";

export type StaffStatusFilter = typeof ALL_STAFF_OPTION | StaffEmploymentStatus;

export interface StaffDirectoryFilters {
  /** Role code, or `all`. Ignored without `staff.roles.view` (members carry no roles then). */
  role: string;
  search: string;
  /** Driven by the quick chips. */
  status: StaffStatusFilter;
}

export const defaultStaffDirectoryFilters: StaffDirectoryFilters = {
  role: ALL_STAFF_OPTION,
  search: "",
  status: ALL_STAFF_OPTION,
};

export interface StaffDirectoryOption {
  label: string;
  value: string;
}

/** Chip order: everyone, then working, locked, left, and the loader's fallback last. */
export const staffStatusChipValues: readonly StaffStatusFilter[] = [
  ALL_STAFF_OPTION,
  "active",
  "suspended",
  "inactive",
  "unknown",
];

export type StaffStatusCounts = Record<StaffStatusFilter, number>;

/**
 * "Vai trò" options: the active roles the loader returned plus any role a
 * member holds (by code, first name wins), sorted by name. A `Map` keeps a
 * code such as "constructor" from colliding with object prototype keys.
 */
export function buildStaffRoleOptions(
  members: readonly StaffDirectoryMember[],
  roleOptions: readonly StaffRoleOption[],
): StaffDirectoryOption[] {
  const roles = new Map<string, string>();

  for (const option of roleOptions) {
    if (!roles.has(option.code)) roles.set(option.code, option.name);
  }

  for (const member of members) {
    for (const role of member.roles ?? []) {
      if (!roles.has(role.code)) roles.set(role.code, role.name);
    }
  }

  return [...roles]
    .map(([value, label]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi") || a.value.localeCompare(b.value));
}

/**
 * A selected role that no option offers anymore (the list refreshed after a
 * revocation) falls back to "all" instead of a blank select hiding every row.
 */
export function resolveStaffDirectoryFilters(
  filters: StaffDirectoryFilters,
  roleOptions: readonly StaffDirectoryOption[],
): StaffDirectoryFilters {
  if (filters.role === ALL_STAFF_OPTION) return filters;
  return roleOptions.some((option) => option.value === filters.role)
    ? filters
    : { ...filters, role: ALL_STAFF_OPTION };
}

export function countActiveStaffFilters(
  filters: StaffDirectoryFilters,
  { canViewRoles }: { canViewRoles: boolean },
): number {
  let count = 0;
  if (normalizeSearchText(filters.search)) count += 1;
  if (canViewRoles && filters.role !== ALL_STAFF_OPTION) count += 1;
  if (filters.status !== ALL_STAFF_OPTION) count += 1;
  return count;
}

/** Name, staff code, email and phone (also digits only), accent- and case-insensitive. */
export function matchesStaffSearch(member: StaffDirectoryMember, search: string): boolean {
  const query = normalizeSearchText(search);
  if (!query) return true;

  const phone = member.phone ?? "";
  const haystack = normalizeSearchText(
    [member.displayName, member.employeeCode ?? "", member.email, phone, phone.replace(/\D/g, "")].join(" "),
  );

  return haystack.includes(query);
}

function matchesRole(member: StaffDirectoryMember, role: string): boolean {
  return member.roles?.some((assigned) => assigned.code === role) ?? false;
}

function knownStatus(status: StaffEmploymentStatus): StaffEmploymentStatus {
  return status === "active" || status === "inactive" || status === "suspended" ? status : "unknown";
}

function matchesSearchAndRole(
  member: StaffDirectoryMember,
  filters: StaffDirectoryFilters,
  canViewRoles: boolean,
): boolean {
  if (!matchesStaffSearch(member, filters.search)) return false;
  if (canViewRoles && filters.role !== ALL_STAFF_OPTION && !matchesRole(member, filters.role)) return false;
  return true;
}

/** Members matching every filter, in input order. */
export function filterStaffMembers(
  members: readonly StaffDirectoryMember[],
  filters: StaffDirectoryFilters,
  { canViewRoles }: { canViewRoles: boolean },
): StaffDirectoryMember[] {
  return members.filter(
    (member) =>
      matchesSearchAndRole(member, filters, canViewRoles) &&
      (filters.status === ALL_STAFF_OPTION || knownStatus(member.employmentStatus) === filters.status),
  );
}

/** Chip counts over the members matching search + role (the status chip itself is ignored). */
export function countStaffStatuses(
  members: readonly StaffDirectoryMember[],
  filters: StaffDirectoryFilters,
  { canViewRoles }: { canViewRoles: boolean },
): StaffStatusCounts {
  const counts: StaffStatusCounts = { active: 0, all: 0, inactive: 0, suspended: 0, unknown: 0 };

  for (const member of members) {
    if (!matchesSearchAndRole(member, filters, canViewRoles)) continue;
    counts.all += 1;
    counts[knownStatus(member.employmentStatus)] += 1;
  }

  return counts;
}

/**
 * The chips a viewer sees: "Tất cả" always, a status only while it has rows
 * (or is the active filter, so it can be seen and switched off).
 */
export function visibleStaffStatusChips(
  counts: StaffStatusCounts,
  active: StaffStatusFilter,
): StaffStatusFilter[] {
  return staffStatusChipValues.filter(
    (value) => value === ALL_STAFF_OPTION || value === active || counts[value] > 0,
  );
}

/** Header line facts over every loaded member (not the filtered view). */
export function summarizeStaffDirectory(members: readonly StaffDirectoryMember[]): {
  active: number;
  total: number;
} {
  let active = 0;
  for (const member of members) {
    if (member.employmentStatus === "active") active += 1;
  }
  return { active, total: members.length };
}

export function paginateStaffMembers<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = STAFF_DIRECTORY_PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, rows.length);

  return {
    end,
    page,
    pageCount,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    start,
  };
}
