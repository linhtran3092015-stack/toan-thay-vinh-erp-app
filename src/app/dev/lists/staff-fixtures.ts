import type { StaffDirectoryMember, StaffEmploymentStatus, StaffRoleOption, StaffRoleSummary } from "@/features/staff/types";

/**
 * /dev/lists?view=staff fixtures: 25 members (two pages at 20/page), every
 * employment status including the loader's `unknown` fallback, a `leftAt` on
 * the one inactive member (the database allows it only when inactive), null
 * staff code / phone / joined date, members without roles and with several.
 * Role codes and names are the seeded ones (identity_rbac_foundation).
 */

const roleCatalog = [
  ["owner", "Chủ trung tâm", "Toàn quyền vận hành trung tâm"],
  ["operations_manager", "Quản lý vận hành", "Điều phối lớp, lịch và nhân sự"],
  ["assistant_manager", "Quản lý trợ lý", "Quản lý đội trợ giảng"],
  ["accountant", "Kế toán", "Học phí, đối soát và bảng lương"],
  ["teaching_assistant", "Trợ giảng", "Điểm danh, chấm bài và chăm sóc học sinh"],
  ["admissions_specialist", "Chuyên viên tuyển sinh", "Tư vấn và theo dõi Lead"],
  ["admissions_leader", "Trưởng nhóm tuyển sinh", "Phân công Lead trong nhóm"],
  ["admissions_manager", "Quản lý tuyển sinh", "Quản lý toàn bộ tuyển sinh"],
  ["collaborator", "Cộng tác viên", "Giới thiệu học sinh"],
] as const;

type RoleCode = (typeof roleCatalog)[number][0];

const roleIds = new Map<RoleCode, string>(
  roleCatalog.map(([code], index) => [code, `d3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`]),
);

export const previewStaffRoleOptions: StaffRoleOption[] = roleCatalog
  .map(([code, name, description]) => ({ code, description, id: roleIds.get(code) ?? code, isSystem: true, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "vi"));

interface MemberRow {
  code: string | null;
  email: string;
  joinedAt: string | null;
  leftAt?: string;
  name: string;
  phone: string | null;
  roles: RoleCode[];
  status: StaffEmploymentStatus;
}

const rows: MemberRow[] = [
  { code: "NS-001", email: "vinh@example.com", joinedAt: "2020-06-01", name: "Nguyễn Văn Vinh", phone: "0912345001", roles: ["owner"], status: "active" },
  { code: "NS-002", email: "hanh.pham@example.com", joinedAt: "2022-03-14", name: "Phạm Thu Hạnh", phone: "0912345002", roles: ["operations_manager"], status: "active" },
  { code: "NS-003", email: "hang.le@example.com", joinedAt: "2023-01-09", name: "Lê Thị Hằng", phone: "0912345003", roles: ["accountant"], status: "active" },
  { code: "NS-004", email: "ha.tran@example.com", joinedAt: "2024-08-19", name: "Trần Thu Hà", phone: "0903 112 233", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-005", email: "phuc.nguyen@example.com", joinedAt: "2024-09-02", name: "Nguyễn Hoàng Phúc", phone: "0978445566", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-006", email: "thao.dang@example.com", joinedAt: "2023-06-12", name: "Đặng Phương Thảo", phone: "0966778899", roles: ["admissions_leader"], status: "active" },
  { code: "NS-007", email: "khoi.hoang@example.com", joinedAt: "2025-02-17", name: "Hoàng Minh Khôi", phone: "0932556677", roles: ["admissions_specialist"], status: "active" },
  { code: "NS-008", email: "duc.vu@example.com", joinedAt: "2024-05-06", name: "Vũ Minh Đức", phone: "0918223344", roles: ["teaching_assistant", "collaborator"], status: "active" },
  { code: "NS-009", email: "tung.tran@example.com", joinedAt: "2025-07-01", name: "Trần Thanh Tùng", phone: "0975334455", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-010", email: "ngoc.le@example.com", joinedAt: "2025-08-11", name: "Lê Bích Ngọc", phone: "0908667788", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-011", email: "huy.bui@example.com", joinedAt: "2022-10-03", name: "Bùi Quang Huy", phone: "0944889900", roles: ["assistant_manager", "teaching_assistant"], status: "active" },
  { code: "NS-012", email: "vy.do@example.com", joinedAt: "2023-11-20", name: "Đỗ Khánh Vy", phone: "0989001122", roles: ["admissions_manager", "admissions_specialist"], status: "active" },
  { code: null, email: "lan.ngo@example.com", joinedAt: null, name: "Ngô Thị Lan", phone: null, roles: ["collaborator"], status: "active" },
  { code: "NS-014", email: "bao.phan@example.com", joinedAt: "2025-01-13", name: "Phan Gia Bảo", phone: "0911222333", roles: ["teaching_assistant"], status: "suspended" },
  { code: "NS-015", email: "trang.ly@example.com", joinedAt: "2025-09-01", leftAt: "2026-09-30", name: "Lý Thu Trang", phone: "0922333444", roles: ["teaching_assistant"], status: "inactive" },
  { code: "NS-016", email: "nam.trinh@example.com", joinedAt: null, name: "Trịnh Hoài Nam", phone: "0933444555", roles: [], status: "active" },
  { code: "NS-017", email: "tuan.mai@example.com", joinedAt: "2026-02-23", name: "Mai Anh Tuấn", phone: "0944555666", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-018", email: "duyen.cao@example.com", joinedAt: "2025-12-01", name: "Cao Thị Mỹ Duyên", phone: "0955666777", roles: ["collaborator"], status: "active" },
  { code: "NS-019", email: "anh.ho@example.com", joinedAt: "2026-03-16", name: "Hồ Đức Anh", phone: "0966777888", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-020", email: "han.duong@example.com", joinedAt: "2026-04-06", name: "Dương Ngọc Hân", phone: "0977888999", roles: ["admissions_specialist"], status: "active" },
  { code: "NS-021", email: "minh.ta@example.com", joinedAt: "2026-05-11", name: "Tạ Quang Minh", phone: "0988999000", roles: ["teaching_assistant"], status: "active" },
  { code: null, email: "son.vo@example.com", joinedAt: null, name: "Võ Thanh Sơn", phone: null, roles: [], status: "unknown" },
  { code: "NS-023", email: "linh.kieu@example.com", joinedAt: "2026-06-01", name: "Kiều Phương Linh", phone: "0901234567", roles: ["teaching_assistant"], status: "active" },
  { code: "NS-024", email: "hung.la@example.com", joinedAt: "2024-11-04", name: "La Văn Hùng", phone: "0907654321", roles: ["collaborator"], status: "suspended" },
  { code: "NS-025", email: "khanhlinh.ton@example.com", joinedAt: "2026-08-03", name: "Tôn Nữ Hoàng Bảo Ngọc Khánh Linh", phone: "0909111222", roles: ["teaching_assistant"], status: "active" },
];

const roleNames = new Map<RoleCode, string>(roleCatalog.map(([code, name]) => [code, name]));

function memberId(index: number): string {
  return `d1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function assignedRoles(row: MemberRow, index: number): StaffRoleSummary[] {
  return row.roles
    .map((code, roleIndex) => ({
      assignedAt: `${row.joinedAt ?? "2026-01-05"}T02:00:00Z`,
      assignmentId: `d2000000-0000-4000-8000-${String(index * 10 + roleIndex + 1).padStart(12, "0")}`,
      code,
      id: roleIds.get(code) ?? code,
      name: roleNames.get(code) ?? code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** With roles, as `getStaffDirectory({ includeRoles: true })` returns them: sorted by display name. */
export const previewStaffMembers: StaffDirectoryMember[] = rows
  .map((row, index) => ({
    avatarUrl: null,
    displayName: row.name,
    email: row.email,
    employeeCode: row.code,
    employmentStatus: row.status,
    id: memberId(index),
    joinedAt: row.joinedAt,
    // Never written by the app (design 16a's "Đăng nhập gần nhất" is omitted); kept for the type.
    lastLoginAt: null,
    leftAt: row.leftAt ?? null,
    phone: row.phone,
    roles: assignedRoles(row, index),
  }))
  .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));

/** Without `staff.roles.view` the loader returns `roles: null` for everyone. */
export const previewStaffMembersWithoutRoles: StaffDirectoryMember[] = previewStaffMembers.map((member) => ({
  ...member,
  roles: null,
}));
