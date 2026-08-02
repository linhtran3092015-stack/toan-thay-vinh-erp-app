"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { InviteAccountDialog } from "@/features/settings/components/invite-account-dialog";
import { ManageAccountRolesDialog } from "@/features/settings/components/manage-account-roles-dialog";
import { PendingInvitationCard } from "@/features/settings/components/pending-invitation-card";
import type {
  SettingsAccountInvitation,
  SettingsRole,
} from "@/features/settings/types";
import type {
  StaffDirectoryMember,
  StaffRoleOption,
} from "@/features/staff/types";
import { cn } from "@/lib/utils";

interface AccountManagementPageProps {
  canManage: boolean;
  invitations: readonly SettingsAccountInvitation[];
  members: readonly StaffDirectoryMember[];
  roles: readonly SettingsRole[];
  roleOptions: readonly StaffRoleOption[];
}

export function AccountManagementPage({
  canManage,
  invitations,
  members,
  roles,
  roleOptions,
}: AccountManagementPageProps) {
  const [search, setSearch] = useState("");
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending",
  );
  const rolesById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );
  const filteredMembers = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return members;

    return members.filter((member) =>
      normalizeSearch(
        `${member.displayName} ${member.email} ${member.employeeCode ?? ""} ${member.roles?.map((role) => role.name).join(" ") ?? ""}`,
      ).includes(query),
    );
  }, [members, search]);

  const unassignedCount = members.filter(
    (member) => member.roles?.length === 0,
  ).length;

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-page-title font-bold text-ink">Tài khoản và vai trò</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Owner thêm email được phép đăng nhập, chọn vai trò ban đầu và cập nhật vai trò hiệu lực của từng tài khoản.
          </p>
        </div>
        {canManage ? <InviteAccountDialog roles={roleOptions} /> : null}
      </header>

      <section aria-label="Tổng quan tài khoản" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryItem label="Tài khoản" value={members.length} />
        <SummaryItem label="Đang hoạt động" value={members.filter((member) => member.employmentStatus === "active").length} />
        <SummaryItem attention={pendingInvitations.length > 0} label="Chờ đăng nhập" value={pendingInvitations.length} />
        <SummaryItem attention={unassignedCount > 0} label="Chưa có vai trò" value={unassignedCount} />
      </section>

      {canManage && pendingInvitations.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="pending-invitations-heading">
          <div>
            <h3 className="text-section font-semibold text-ink" id="pending-invitations-heading">
              Tài khoản chờ đăng nhập
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              Vai trò sẽ có hiệu lực sau lần đăng nhập Google đầu tiên.
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {pendingInvitations.map((invitation) => (
              <PendingInvitationCard
                invitation={invitation}
                key={invitation.id}
                rolesById={rolesById}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="accounts-heading" className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-section font-semibold text-ink" id="accounts-heading">
              Tài khoản đã đăng nhập
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              Hiển thị {filteredMembers.length}/{members.length} tài khoản
            </p>
          </div>
          <label className="grid w-full gap-1.5 text-xs font-semibold text-ink-muted sm:max-w-sm">
            <span>Tìm tài khoản</span>
            <input
              className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-ink outline-none focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên, email, mã nhân sự hoặc vai trò..."
              type="search"
              value={search}
            />
          </label>
        </div>

        {filteredMembers.length === 0 ? (
          <EmptyState
            actionLabel="Xóa tìm kiếm"
            description="Không có tài khoản phù hợp với từ khóa."
            onAction={() => setSearch("")}
            title="Không tìm thấy tài khoản"
          />
        ) : (
          <>
            <AccountDesktopTable
              canManage={canManage}
              members={filteredMembers}
              roleOptions={roleOptions}
            />
            <AccountMobileList
              canManage={canManage}
              members={filteredMembers}
              roleOptions={roleOptions}
            />
          </>
        )}
      </section>
    </div>
  );
}

function AccountDesktopTable({
  canManage,
  members,
  roleOptions,
}: {
  canManage: boolean;
  members: readonly StaffDirectoryMember[];
  roleOptions: readonly StaffRoleOption[];
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-surface-2 text-xs font-semibold text-ink-muted">
          <tr>
            <th className="px-4 py-3">Tài khoản</th>
            <th className="px-4 py-3">Mã nhân sự</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="min-w-[280px] px-4 py-3">Vai trò hiệu lực</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {members.map((member) => (
            <tr className="align-top hover:bg-surface-2/50" key={member.id}>
              <td className="px-4 py-4">
                <p className="font-semibold text-ink">{member.displayName}</p>
                <p className="mt-1 break-all text-xs text-ink-muted">{member.email}</p>
              </td>
              <td className="px-4 py-4 text-ink-muted">{member.employeeCode ?? "Chưa có"}</td>
              <td className="px-4 py-4"><AccountStatusBadge status={member.employmentStatus} /></td>
              <td className="px-4 py-4"><RoleBadges member={member} /></td>
              <td className="px-4 py-4 text-right">
                {canManage && member.employmentStatus === "active" ? (
                  <ManageAccountRolesDialog member={member} roles={roleOptions} />
                ) : (
                  <span className="text-xs text-ink-subtle">Chỉ đọc</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountMobileList({
  canManage,
  members,
  roleOptions,
}: {
  canManage: boolean;
  members: readonly StaffDirectoryMember[];
  roleOptions: readonly StaffRoleOption[];
}) {
  return (
    <div className="grid gap-3 lg:hidden">
      {members.map((member) => (
        <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card" key={member.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{member.displayName}</p>
              <p className="mt-1 break-all text-xs text-ink-muted">{member.email}</p>
            </div>
            <AccountStatusBadge status={member.employmentStatus} />
          </div>
          <div className="mt-3"><RoleBadges member={member} /></div>
          {canManage && member.employmentStatus === "active" ? (
            <div className="mt-4 border-t border-hairline pt-3 [&>button]:min-h-11 [&>button]:w-full">
              <ManageAccountRolesDialog member={member} roles={roleOptions} />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function RoleBadges({ member }: { member: StaffDirectoryMember }) {
  if (!member.roles?.length) {
    return <span className="text-xs font-semibold text-warning">Chưa có vai trò</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {member.roles.map((role) => (
        <span className="rounded-pill border border-hairline bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-ink-muted" key={role.assignmentId}>
          {role.name}
        </span>
      ))}
    </div>
  );
}

function AccountStatusBadge({ status }: { status: StaffDirectoryMember["employmentStatus"] }) {
  const labels = {
    active: "Đang hoạt động",
    inactive: "Đã ngừng",
    suspended: "Tạm khóa",
    unknown: "Chưa xác định",
  } as const;

  return (
    <span className={cn(
      "inline-flex rounded-pill border px-2.5 py-1 text-xs font-semibold",
      status === "active" && "border-success-border bg-success-bg text-success",
      status === "suspended" && "border-warning-border bg-warning-bg text-warning",
      (status === "inactive" || status === "unknown") && "border-hairline bg-neutral-bg text-ink-muted",
    )}>
      {labels[status]}
    </span>
  );
}

function SummaryItem({ attention = false, label, value }: { attention?: boolean; label: string; value: number }) {
  return (
    <div className="border-b border-hairline py-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-bold", attention ? "text-warning" : "text-ink")}>{value}</p>
    </div>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}
