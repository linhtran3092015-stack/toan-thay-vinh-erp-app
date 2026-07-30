import { StaffRoleManagement } from "@/features/staff/components/staff-role-management";
import Link from "next/link";
import type {
  StaffDirectoryMember,
  StaffEmploymentStatus,
  StaffRoleOption,
} from "@/features/staff/types";
import { cn } from "@/lib/utils";

interface StaffDirectoryPageProps {
  canManageRoles: boolean;
  canViewRoles: boolean;
  members: readonly StaffDirectoryMember[];
  roleOptions: readonly StaffRoleOption[];
}

const statusLabels: Record<StaffEmploymentStatus, string> = {
  active: "Đang làm việc",
  inactive: "Đã nghỉ",
  suspended: "Tạm khóa",
  unknown: "Chưa xác định",
};

const statusClasses: Record<StaffEmploymentStatus, string> = {
  active: "border-success-border bg-success-bg text-success",
  inactive: "border-hairline bg-neutral-bg text-ink-muted",
  suspended: "border-warning-border bg-warning-bg text-warning",
  unknown: "border-hairline bg-neutral-bg text-ink-muted",
};

export function StaffDirectoryPage({
  canManageRoles,
  canViewRoles,
  members,
  roleOptions,
}: StaffDirectoryPageProps) {
  const activeCount = members.filter(
    (member) => member.employmentStatus === "active",
  ).length;

  const suspendedCount = members.filter(
    (member) => member.employmentStatus === "suspended",
  ).length;

  const inactiveCount = members.filter(
    (member) => member.employmentStatus === "inactive",
  ).length;

  return (
    <div className="grid gap-4">
      <header className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Quản trị nhân sự
          </p>
          <h1 className="mt-1 text-page-title font-bold text-ink">
            Danh sách nhân sự
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Dữ liệu được đọc trực tiếp từ hồ sơ đăng nhập và phân quyền trên
            Supabase. Mọi thay đổi vai trò đều yêu cầu lý do và được ghi audit.
          </p>
        </div>

        <span className="w-fit rounded-pill border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
          {canManageRoles ? "Có thể quản lý vai trò" : "Chỉ đọc"}
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Tổng nhân sự" value={members.length} />
        <SummaryCard label="Đang làm việc" value={activeCount} />
        <SummaryCard label="Tạm khóa" value={suspendedCount} />
        <SummaryCard label="Đã nghỉ" value={inactiveCount} />
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="text-section font-semibold text-ink">
            Hồ sơ nhân sự
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Hiển thị {members.length} hồ sơ
            {!canViewRoles
              ? " · Vai trò được ẩn do tài khoản thiếu staff.roles.view"
              : ""}
          </p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nhân sự</th>
                <th className="px-5 py-3 font-semibold">Liên hệ</th>
                <th className="px-5 py-3 font-semibold">Trạng thái</th>
                <th className="min-w-[300px] px-5 py-3 font-semibold">
                  Vai trò
                </th>
                <th className="px-5 py-3 font-semibold">Ngày vào</th>
                <th className="px-5 py-3 font-semibold">
                  Đăng nhập gần nhất
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline">
              {members.map((member) => (
                <tr className="align-top hover:bg-canvas/70" key={member.id}>
                  <td className="px-5 py-4">
                    <StaffProfileLink member={member} />
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium text-ink">{member.email}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {member.phone || "Chưa có số điện thoại"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <EmploymentStatusBadge
                      status={member.employmentStatus}
                    />
                  </td>

                  <td className="px-5 py-4">
                    <StaffRoles
                      canViewRoles={canViewRoles}
                      member={member}
                    />

                    {canManageRoles ? (
                      <StaffRoleManagement
                        member={member}
                        roleOptions={roleOptions}
                      />
                    ) : null}
                  </td>

                  <td className="px-5 py-4 text-ink-muted">
                    {formatDate(member.joinedAt)}
                  </td>

                  <td className="px-5 py-4 text-ink-muted">
                    {formatDateTime(member.lastLoginAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {members.map((member) => (
            <article
              className="rounded-lg border border-hairline bg-white p-4"
              key={member.id}
            >
              <div className="flex items-start justify-between gap-3">
                <StaffProfileLink member={member} />
                <EmploymentStatusBadge status={member.employmentStatus} />
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <MobileField label="Email" value={member.email} />
                <MobileField
                  label="Điện thoại"
                  value={member.phone || "Chưa cập nhật"}
                />

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Vai trò
                  </dt>
                  <dd className="mt-1">
                    <StaffRoles
                      canViewRoles={canViewRoles}
                      member={member}
                    />

                    {canManageRoles ? (
                      <StaffRoleManagement
                        member={member}
                        roleOptions={roleOptions}
                      />
                    ) : null}
                  </dd>
                </div>

                <MobileField
                  label="Ngày vào"
                  value={formatDate(member.joinedAt)}
                />
                <MobileField
                  label="Đăng nhập gần nhất"
                  value={formatDateTime(member.lastLoginAt)}
                />
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function StaffIdentity({
  member,
}: {
  member: StaffDirectoryMember;
}) {
  return (
    <div className="flex min-w-[210px] items-center gap-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-primary-soft text-xs font-bold text-primary">
        {getInitials(member.displayName)}
      </span>

      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">
          {member.displayName}
        </p>
        <p className="mt-1 truncate text-xs text-ink-muted">
          {member.employeeCode || "Chưa có mã nhân sự"}
        </p>
      </div>
    </div>
  );
}

function StaffProfileLink({
  member,
}: {
  member: StaffDirectoryMember;
}) {
  return (
    <Link
      className="block rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25"
      href={`/staff/${member.id}`}
    >
      <StaffIdentity member={member} />
    </Link>
  );
}

function EmploymentStatusBadge({
  status,
}: {
  status: StaffEmploymentStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-pill border px-2.5 py-1 text-xs font-semibold",
        statusClasses[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function StaffRoles({
  canViewRoles,
  member,
}: {
  canViewRoles: boolean;
  member: StaffDirectoryMember;
}) {
  if (!canViewRoles || member.roles === null) {
    return <span className="text-sm text-ink-muted">Ẩn theo phân quyền</span>;
  }

  if (member.roles.length === 0) {
    return <span className="text-sm text-warning">Chưa được cấp vai trò</span>;
  }

  return (
    <div className="flex max-w-[320px] flex-wrap gap-1.5">
      {member.roles.map((role) => (
        <span
          className="rounded-pill border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
          key={role.id}
          title={`Mã vai trò: ${role.code}`}
        >
          {role.name}
        </span>
      ))}
    </div>
  );
}

function MobileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  const initials = words
    .slice(-2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();

  return initials || "TV";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Chưa ghi nhận";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
