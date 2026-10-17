// Value: protects=the staff directory rules (design 16a): search over name, staff code, email and phone ignoring accents/case/đ, the role filter (only with staff.roles.view, options = loaded role options ∪ members' roles by code, sorted by name), status chips counted over search + role and hidden at zero unless active, input order kept, a vanished role falling back to "all", 20 rows per page and the header facts; fails_when=a filter re-sorts or drops rows, the role filter applies without roles view, chip counts include the status chip itself, a prototype-key role code breaks options, or paging stops clamping; why_new=step 14b moves filtering into a pure models file; seam=none; no_claim=the rendered markup (staff-presentation.test.tsx) or the loader's own ordering (data.ts)
import { describe, expect, it } from "vitest";

import {
  ALL_STAFF_OPTION,
  buildStaffRoleOptions,
  countActiveStaffFilters,
  countStaffStatuses,
  defaultStaffDirectoryFilters,
  filterStaffMembers,
  matchesStaffSearch,
  paginateStaffMembers,
  resolveStaffDirectoryFilters,
  STAFF_DIRECTORY_PAGE_SIZE,
  summarizeStaffDirectory,
  visibleStaffStatusChips,
  type StaffDirectoryFilters,
} from "@/features/staff/staff-directory-models";
import type { StaffDirectoryMember, StaffRoleOption, StaffRoleSummary } from "@/features/staff/types";

function role(code: string, name: string): StaffRoleSummary {
  return { assignedAt: "2025-08-01T00:00:00Z", assignmentId: `assignment-${code}`, code, id: `role-${code}`, name };
}

function member(id: string, overrides: Partial<StaffDirectoryMember> = {}): StaffDirectoryMember {
  return {
    avatarUrl: null,
    displayName: `Nhân sự ${id}`,
    email: `${id}@example.com`,
    employeeCode: `NS-${id}`,
    employmentStatus: "active",
    id,
    joinedAt: "2025-08-01",
    lastLoginAt: null,
    leftAt: null,
    phone: null,
    roles: [],
    ...overrides,
  };
}

const option = (code: string, name: string): StaffRoleOption => ({ code, description: null, id: `role-${code}`, isSystem: true, name });

const an = member("1", { displayName: "Nguyễn Minh An", phone: "0900 111 222", roles: [role("teaching_assistant", "Trợ giảng")] });
const dung = member("2", { displayName: "Đặng Văn Dũng", email: "dung.dang@example.com", employmentStatus: "suspended", roles: [role("accountant", "Kế toán")] });
const binh = member("3", { displayName: "Trần Bình", employeeCode: null, employmentStatus: "inactive", leftAt: "2026-09-30", roles: [] });
const chi = member("4", { displayName: "Lê Chi", employmentStatus: "unknown", roles: [role("teaching_assistant", "Trợ giảng"), role("collaborator", "Cộng tác viên")] });
// Input order is the loader's; it is deliberately not alphabetical here.
const members = [an, dung, binh, chi];

const filters = (overrides: Partial<StaffDirectoryFilters> = {}): StaffDirectoryFilters => ({
  ...defaultStaffDirectoryFilters,
  ...overrides,
});

describe("staff directory search", () => {
  it("matches name, staff code, email and phone, ignoring accents, case and đ", () => {
    expect(matchesStaffSearch(an, "nguyen minh")).toBe(true);
    expect(matchesStaffSearch(dung, "dang van dung")).toBe(true);
    expect(matchesStaffSearch(dung, "ĐẶNG")).toBe(true);
    expect(matchesStaffSearch(an, "ns-1")).toBe(true);
    expect(matchesStaffSearch(dung, "dung.dang@")).toBe(true);
    expect(matchesStaffSearch(an, "0900 111")).toBe(true);
    expect(matchesStaffSearch(an, "0900111222")).toBe(true);
    expect(matchesStaffSearch(an, "  ")).toBe(true);
    expect(matchesStaffSearch(binh, "ns-")).toBe(false);
    expect(matchesStaffSearch(an, "kế toán")).toBe(false);
  });
});

describe("staff directory filtering", () => {
  it("keeps every member in input order by default", () => {
    expect(filterStaffMembers(members, filters(), { canViewRoles: true })).toEqual(members);
  });

  it("filters by status, role and search together without re-sorting", () => {
    expect(filterStaffMembers(members, filters({ status: "suspended" }), { canViewRoles: true })).toEqual([dung]);
    expect(filterStaffMembers(members, filters({ role: "teaching_assistant" }), { canViewRoles: true })).toEqual([an, chi]);
    expect(filterStaffMembers(members, filters({ role: "teaching_assistant", search: "lê chi" }), { canViewRoles: true })).toEqual([chi]);
    expect(filterStaffMembers(members, filters({ status: "unknown" }), { canViewRoles: true })).toEqual([chi]);
  });

  it("ignores the role filter without staff.roles.view (members carry no roles then)", () => {
    const hidden = members.map((entry) => ({ ...entry, roles: null }));
    expect(filterStaffMembers(hidden, filters({ role: "accountant" }), { canViewRoles: false })).toEqual(hidden);
    expect(filterStaffMembers(hidden, filters({ role: "accountant" }), { canViewRoles: true })).toEqual([]);
  });

  it("counts active filters, the role only with roles view", () => {
    expect(countActiveStaffFilters(filters(), { canViewRoles: true })).toBe(0);
    expect(countActiveStaffFilters(filters({ search: "  " }), { canViewRoles: true })).toBe(0);
    expect(countActiveStaffFilters(filters({ role: "accountant", search: "an", status: "active" }), { canViewRoles: true })).toBe(3);
    expect(countActiveStaffFilters(filters({ role: "accountant", search: "an", status: "active" }), { canViewRoles: false })).toBe(2);
  });
});

describe("staff directory role options", () => {
  it("unions loaded role options with members' roles by code and sorts by name", () => {
    const options = buildStaffRoleOptions(members, [option("accountant", "Kế toán"), option("owner", "Chủ trung tâm")]);
    expect(options).toEqual([
      { label: "Chủ trung tâm", value: "owner" },
      { label: "Cộng tác viên", value: "collaborator" },
      { label: "Kế toán", value: "accountant" },
      { label: "Trợ giảng", value: "teaching_assistant" },
    ]);
  });

  it("keeps a prototype-key role code as an ordinary option", () => {
    const odd = member("9", { roles: [role("constructor", "Vai trò lạ")] });
    expect(buildStaffRoleOptions([odd], [])).toEqual([{ label: "Vai trò lạ", value: "constructor" }]);
    expect(filterStaffMembers([an, odd], filters({ role: "constructor" }), { canViewRoles: true })).toEqual([odd]);
  });

  it("drops a selected role that no option offers anymore", () => {
    const options = buildStaffRoleOptions(members, []);
    expect(resolveStaffDirectoryFilters(filters({ role: "owner", search: "an" }), options)).toEqual(filters({ search: "an" }));
    const kept = filters({ role: "accountant" });
    expect(resolveStaffDirectoryFilters(kept, options)).toBe(kept);
  });
});

describe("staff directory status chips", () => {
  it("counts statuses over search + role, ignoring the status chip itself", () => {
    expect(countStaffStatuses(members, filters({ status: "inactive" }), { canViewRoles: true })).toEqual({
      active: 1,
      all: 4,
      inactive: 1,
      suspended: 1,
      unknown: 1,
    });
    expect(countStaffStatuses(members, filters({ role: "teaching_assistant" }), { canViewRoles: true })).toEqual({
      active: 1,
      all: 2,
      inactive: 0,
      suspended: 0,
      unknown: 1,
    });
  });

  it("always shows Tất cả and hides a zero status unless it is the active one", () => {
    const counts = countStaffStatuses([an, binh], filters(), { canViewRoles: true });
    expect(visibleStaffStatusChips(counts, ALL_STAFF_OPTION)).toEqual(["all", "active", "inactive"]);
    expect(visibleStaffStatusChips(counts, "suspended")).toEqual(["all", "active", "suspended", "inactive"]);
    expect(visibleStaffStatusChips(countStaffStatuses([], filters(), { canViewRoles: true }), ALL_STAFF_OPTION)).toEqual(["all"]);
  });
});

describe("staff directory paging and header facts", () => {
  it("pages 20 rows at a time and clamps the requested page", () => {
    const many = Array.from({ length: 25 }, (_, index) => member(String(index + 1)));
    expect(STAFF_DIRECTORY_PAGE_SIZE).toBe(20);

    const first = paginateStaffMembers(many, 1);
    expect(first).toMatchObject({ end: 20, page: 1, pageCount: 2, start: 1 });
    expect(first.rows.map((entry) => entry.id)).toEqual(many.slice(0, 20).map((entry) => entry.id));

    const last = paginateStaffMembers(many, 9);
    expect(last).toMatchObject({ end: 25, page: 2, pageCount: 2, start: 21 });
    expect(last.rows).toHaveLength(5);

    expect(paginateStaffMembers([], 3)).toMatchObject({ end: 0, page: 1, pageCount: 1, rows: [], start: 0 });
  });

  it("summarises every loaded member, not the filtered view", () => {
    expect(summarizeStaffDirectory(members)).toEqual({ active: 1, total: 4 });
    expect(summarizeStaffDirectory([])).toEqual({ active: 0, total: 0 });
  });
});
