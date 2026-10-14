"use client";

import { AppShell } from "@/components/layout/app-shell";
import { SettingsHub } from "@/features/settings/components/settings-hub";
import { PermissionMatrixPage } from "@/features/settings/permission-matrix-page";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import type { SystemSettingKey, SystemSettings } from "@/features/settings/system-settings";
import { SystemSettingsForm, SystemSettingsReadOnly, type SystemSettingsFields } from "@/features/settings/system-settings-form";
import type { SettingsPermission, SettingsPermissionMatrix, SettingsRole } from "@/features/settings/types";
import { WebsiteEditor } from "@/features/website/editor";
import { createDefaultWebsite, type Website } from "@/features/website/schema";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type SettingsPreviewView = "general" | "branding" | "website" | "permissions";
export type SettingsPreviewRole = "owner" | "manager" | "viewer";
export type SettingsPreviewState = "normal" | "dirty" | "error";

const STUB = "Bản xem trước không ghi dữ liệu.";

const ROLE_IDS = {
  accountant: "e1000000-0000-4000-8000-000000000002",
  admissions_leader: "e1000000-0000-4000-8000-000000000007",
  admissions_manager: "e1000000-0000-4000-8000-000000000008",
  admissions_specialist: "e1000000-0000-4000-8000-000000000006",
  assistant_manager: "e1000000-0000-4000-8000-000000000004",
  collaborator: "e1000000-0000-4000-8000-000000000009",
  operations_manager: "e1000000-0000-4000-8000-000000000003",
  owner: "e1000000-0000-4000-8000-000000000001",
  teaching_assistant: "e1000000-0000-4000-8000-000000000005",
} as const;

const zaloAccounts = [
  { displayName: "Toán Thầy Vinh", id: "zalo-account-1", phone: "0912 345 678", status: "connected", zaloUid: null },
  { displayName: "Trợ giảng Lan", id: "zalo-account-2", phone: null, status: "disconnected", zaloUid: null },
];

/**
 * Inert stand-ins for every write the settings hub can reach (system
 * settings, website/branding save and publish, role permissions, the personal
 * palette in localStorage) plus the ZaloCRM nick list (an external call). The
 * preview runs on localhost where .env.local may point at production, so no
 * control may reach a server action. Writes answer with the stub message.
 */
export const previewSettingsActions: Required<SettingsActionOverrides> = {
  applyPersonalAppearance: () => "Bản xem trước không lưu lựa chọn trên trình duyệt.",
  listZaloAccounts: async () => ({ accounts: zaloAccounts, ok: true }),
  saveWebsite: async () => ({ message: STUB, ok: false }),
  setRolePermissions: async () => ({ message: STUB, status: "error" }),
  updateSystemSettings: async () => ({ message: STUB, status: "error" }),
};

/** `state=error`: realistic failures so the danger banner above the save bar can be reviewed. */
export const previewSettingsErrorActions: Required<SettingsActionOverrides> = {
  ...previewSettingsActions,
  saveWebsite: async () => ({ message: "Nội dung đã được thay đổi ở nơi khác. Tải lại trang trước khi lưu tiếp.", ok: false }),
  // Partial failure: the accountant role fails, the others answer success
  // (nothing is written either way) so the banner names only the failed role.
  setRolePermissions: async ({ roleId }) => roleId === ROLE_IDS.accountant
    ? { message: "Danh sách quyền có mục không hợp lệ hoặc đã ngừng hoạt động.", status: "error" }
    : { message: "Đã cập nhật quyền của vai trò.", status: "success" },
  updateSystemSettings: async () => ({ message: "Không thể kết nối hệ thống cài đặt.", status: "error" }),
};

const managerPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "settings.view",
  "settings.manage",
  "staff.view",
  "staff.roles.view",
  "audit.view",
  "notifications.view",
];

const viewerPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "settings.view",
  "staff.roles.view",
];

const settingsFixture = {
  "center.address": "12 Nguyễn Trãi, Thanh Xuân, Hà Nội",
  "center.contact_email": "lienhe@toanthayvinh.vn",
  "center.contact_phone": "0912 345 678",
  "center.display_name": "Trung tâm Toán Thầy Vinh",
  "coaching.default_public_link_expiry_days": 7,
  "sessions.auto_lock_after_days": 3,
  "teacher.display_name": "Toán Thầy Vinh",
  "zalo.absence_message_enabled": "on",
  "zalo.absence_template": "{center} thông báo: {student} vắng buổi học {class} ngày {date} ({time}) không phép. Phụ huynh vui lòng phản hồi để trung tâm sắp xếp học bù.",
  "zalo.center_account_id": "zalo-account-1",
  "zalo.center_account_name": "Toán Thầy Vinh (0912 345 678)",
  "zalo.comment_message_enabled": "on",
  "zalo.comment_template": "{center} - nhận xét buổi {date} lớp {class} của {student}: {comment}{scores}",
} satisfies Record<SystemSettingKey, string | number>;

// SystemSettings carries the defaults' literal types; the fixture is a valid value set.
const systemSettings = settingsFixture as unknown as SystemSettings;

const settingsDraft: Partial<SystemSettingsFields> = {
  displayName: "Trung tâm Toán Thầy Vinh · Cơ sở Thanh Xuân",
  sessionAutoLockAfterDays: "5",
};

function websiteFixture(): Website {
  const site = createDefaultWebsite("Trung tâm Toán Thầy Vinh");
  return {
    ...site,
    address: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    branding: { ...site.branding, description: "Học Toán vững vàng từ lớp 6 đến lớp 12." },
    contactPhone: "0912 345 678",
  };
}

const roles: SettingsRole[] = [
  ["owner", "Chủ trung tâm", "Quyền quản trị cao nhất của trung tâm."],
  ["accountant", "Kế toán", "Phụ trách nghiệp vụ kế toán được cấp riêng."],
  ["operations_manager", "Quản lý vận hành", "Điều phối hoạt động vận hành trung tâm."],
  ["assistant_manager", "Quản lý trợ lý", "Quản lý nhóm trợ lý của trung tâm."],
  ["teaching_assistant", "Trợ giảng", "Hỗ trợ hoạt động giảng dạy."],
  ["admissions_specialist", "Chuyên viên tuyển sinh", "Thực hiện công việc tuyển sinh."],
  ["admissions_leader", "Trưởng nhóm tuyển sinh", "Điều phối nhóm tuyển sinh."],
  ["admissions_manager", "Quản lý tuyển sinh", "Quản lý hoạt động tuyển sinh."],
  ["collaborator", "Cộng tác viên", "Vai trò cộng tác theo phạm vi được cấp."],
].map(([code, name, description]) => ({
  code,
  description,
  id: ROLE_IDS[code as keyof typeof ROLE_IDS],
  isActive: true,
  isSystem: true,
  name,
}));

type RoleCode = keyof typeof ROLE_IDS;

/** [module, code, name, roles granted besides owner] */
const permissionRows: [string, string, string, RoleCode[]][] = [
  ["attendance", "attendance.mark", "Điểm danh", ["operations_manager", "assistant_manager", "teaching_assistant"]],
  ["results", "results.manage", "Nhập / sửa kết quả", ["operations_manager", "assistant_manager", "teaching_assistant"]],
  ["sessions", "sessions.manage", "Bắt đầu / hoàn thành buổi", ["operations_manager", "assistant_manager", "teaching_assistant"]],
  ["sessions", "sessions.lock", "Khóa buổi học", ["operations_manager"]],
  ["session_ledger", "session_ledger.reverse", "Hoàn buổi (sổ buổi)", ["operations_manager", "accountant"]],
  ["students", "students.view", "Xem học sinh", ["accountant", "operations_manager", "assistant_manager", "teaching_assistant", "admissions_specialist", "admissions_leader", "admissions_manager"]],
  ["guardians", "guardians.view", "Xem phụ huynh", ["accountant", "operations_manager", "assistant_manager", "admissions_manager"]],
  ["students", "students.reserve", "Bảo lưu / quay lại", ["operations_manager"]],
  ["students", "students.manage_tuition_rates", "Đơn giá học phí", ["accountant"]],
  ["finance", "tuition_periods.lock", "Khóa kỳ thu", ["accountant"]],
  ["finance", "tuition_periods.export", "In phiếu học phí", ["accountant", "operations_manager"]],
  ["sepay", "sepay.allocate", "Phân bổ SePay thủ công", ["accountant"]],
  ["timekeeping", "timekeeping.check", "Chấm công (của mình)", ["accountant", "operations_manager", "assistant_manager", "teaching_assistant", "admissions_specialist", "admissions_leader", "admissions_manager", "collaborator"]],
  ["timekeeping", "timekeeping.manage_verification", "Duyệt ngoại lệ chấm công", ["operations_manager"]],
  ["payroll", "payroll.owner_approve", "Duyệt bảng lương", []],
  ["payroll", "payroll.accountant_reconcile", "Đối soát lương", ["accountant"]],
  ["crm", "crm.update", "Cập nhật lead", ["admissions_specialist", "admissions_leader", "admissions_manager", "collaborator"]],
  ["crm", "crm.transfer", "Chuyển lead", ["admissions_leader", "admissions_manager"]],
  ["staff", "staff.roles.manage", "Quản lý vai trò", []],
];

const permissions: SettingsPermission[] = permissionRows.map(([module, code, name], index) => ({
  code,
  description: null,
  id: `f1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  isActive: true,
  module,
  name,
}));

const matrix: SettingsPermissionMatrix = {
  grants: permissionRows.flatMap(([, , , grantedRoles], index) =>
    (["owner", ...grantedRoles] as RoleCode[]).map((role) => ({ permissionId: permissions[index].id, roleId: ROLE_IDS[role] })),
  ),
  permissions,
  roles,
};

function permissionId(code: string): string {
  return permissions.find((permission) => permission.code === code)?.id ?? "";
}

function savedGrants(role: RoleCode): string[] {
  return matrix.grants.filter((grant) => grant.roleId === ROLE_IDS[role]).map((grant) => grant.permissionId);
}

/** Kế toán +2 −1, Trợ giảng +1. */
const permissionsDraft: Record<string, string[]> = {
  [ROLE_IDS.accountant]: [
    ...savedGrants("accountant").filter((id) => id !== permissionId("session_ledger.reverse")),
    permissionId("payroll.owner_approve"),
    permissionId("timekeeping.manage_verification"),
  ],
  [ROLE_IDS.teaching_assistant]: [...savedGrants("teaching_assistant"), permissionId("sessions.lock")],
};

export function SettingsPreview({
  role,
  state,
  view,
}: {
  role: SettingsPreviewRole;
  state: SettingsPreviewState;
  view: SettingsPreviewView;
}) {
  const permissionsForRole = role === "owner"
    ? DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")
    : role === "manager" ? managerPermissions : viewerPermissions;
  const canManageSettings = permissionsForRole.includes("settings.manage");
  const isOwner = role === "owner";
  const actions = state === "error" ? previewSettingsErrorActions : previewSettingsActions;
  const seeded = state !== "normal";
  const pathname = `/settings/${view}`;
  const displayName = role === "owner" ? "Nguyễn Văn Vinh" : role === "manager" ? "Phạm Thu Hạnh" : "Lê Minh Châu";
  const site = websiteFixture();
  const draftSite: Website = view === "branding"
    ? { ...site, branding: { ...site.branding, appPalette: "terracotta", description: "Học Toán vững vàng, tự tin thi chuyển cấp." } }
    : { ...site, title: "Toán Thầy Vinh · Thanh Xuân" };

  return (
    <AppShell
      authUser={{ displayName, email: "preview@example.com", id: "dev-user", initials: displayName.split(" ").map((part) => part[0]).slice(-2).join("") }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissionsForRole}
      previewPathname={pathname}
      unreadNotificationCount={3}
    >
      <SettingsHub
        canViewAudit={permissionsForRole.includes("audit.view")}
        canViewUsers={permissionsForRole.includes("staff.view")}
        centerName="Trung tâm Toán Thầy Vinh"
        previewPathname={pathname}
      >
        {view === "general" ? (
          canManageSettings ? (
            <SystemSettingsForm
              actions={actions}
              initialDraft={seeded ? settingsDraft : undefined}
              initialValues={systemSettings}
            />
          ) : (
            <SystemSettingsReadOnly settings={systemSettings} />
          )
        ) : null}
        {view === "branding" || view === "website" ? (
          <WebsiteEditor
            actions={actions}
            canManage={canManageSettings}
            centerName={view === "branding" ? "Trung tâm Toán Thầy Vinh" : undefined}
            initialDraft={seeded && canManageSettings ? draftSite : undefined}
            initialSite={site}
            initialVersion={4}
            initiallyPublished={view === "website"}
            key={view}
            mode={view}
          />
        ) : null}
        {view === "permissions" ? (
          <PermissionMatrixPage
            actions={actions}
            canManage={isOwner}
            initialDraft={seeded ? permissionsDraft : undefined}
            matrix={matrix}
          />
        ) : null}
      </SettingsHub>
    </AppShell>
  );
}
