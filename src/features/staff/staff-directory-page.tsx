import Link from "next/link";
import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { StaffRoleManagement } from "@/features/staff/components/staff-role-management";
import type {
  StaffDirectoryMember,
  StaffEmploymentStatus,
  StaffRoleOption,
} from "@/features/staff/types";
import { cn } from "@/lib/utils";

interface StaffDirectoryPageProps {
  canManageRoles: boolean;
  canViewRoles: boolean;
  description?: string;
  eyebrow?: string;
  headingLevel?: 1 | 2;
  members: readonly StaffDirectoryMember[];
  roleOptions: readonly StaffRoleOption[];
  title?: string;
}

const statusLabels: Record<StaffEmploymentStatus, string> = {
  active: "Đang làm việc",
  inactive: "Đã nghỉ",
  suspended: "Tạm khóa",
  unknown: "Chưa xác định",
};

const statusClasses: Record<StaffEmploymentStatus, string> = {
  active: "border-success-border bg-success-bg text-success",
  inactive: "border-border-subtle bg-surface-raised text-text-muted",
  suspended: "border-warning-border bg-warning-bg text-warning",
  unknown: "border-border-subtle bg-surface-raised text-text-muted",
};

/** Presentation-only staff directory. Permission and role policy remain feature-owned. */
export function StaffDirectoryPage({
  canManageRoles,
  canViewRoles,
  description = "Hồ sơ nhân sự, tình trạng làm việc và vai trò hiệu lực theo phạm vi quyền hiện tại.",
  eyebrow,
  headingLevel = 1,
  members,
  roleOptions,
  title = "Nhân sự",
}: StaffDirectoryPageProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <div className="grid min-w-0 gap-5">
      {headingLevel === 1 ? (
        <PageHeader title={title}>
          {eyebrow ? <p className="text-label text-text-muted">{eyebrow}</p> : null}
          <p className="mt-1 max-w-3xl text-secondary text-text-muted">{description}</p>
        </PageHeader>
      ) : (
        <header>
          {eyebrow ? <p className="text-label text-text-muted">{eyebrow}</p> : null}
          <Heading className="mt-1 text-section-title text-text-strong">{title}</Heading>
          <p className="mt-1 max-w-3xl text-secondary text-text-muted">{description}</p>
        </header>
      )}

      <div className="staff-directory-work-area min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2" aria-live="polite">
          <p className="text-secondary text-text-muted">Hiển thị {members.length} hồ sơ nhân sự</p>
          {!canViewRoles ? <p className="text-secondary text-text-muted">Vai trò được ẩn theo quyền hiện tại</p> : null}
        </div>

        <DataTableFrame
          body={members.map((member) => (
            <StaffTableRow
              canManageRoles={canManageRoles}
              canViewRoles={canViewRoles}
              key={member.id}
              member={member}
              roleOptions={roleOptions}
            />
          ))}
          caption="Danh sách nhân sự"
          className="staff-directory-table"
          header={(
            <tr>
              <TableHeader>Nhân sự</TableHeader>
              <TableHeader>Liên hệ</TableHeader>
              <TableHeader>Trạng thái làm việc</TableHeader>
              <TableHeader>Vai trò hiệu lực</TableHeader>
              <TableHeader>Ngày vào làm</TableHeader>
              <TableHeader>Đăng nhập gần nhất</TableHeader>
            </tr>
          )}
          tableClassName="min-w-[1180px] table-fixed text-table-body text-text-default"
        />

        <ResponsiveRecordList
          className="staff-directory-record-list"
          label="Danh sách nhân sự"
        >
          {members.map((member) => (
            <StaffRecord
              canManageRoles={canManageRoles}
              canViewRoles={canViewRoles}
              key={member.id}
              member={member}
              roleOptions={roleOptions}
            />
          ))}
        </ResponsiveRecordList>
      </div>
    </div>
  );
}

function StaffTableRow({
  canManageRoles,
  canViewRoles,
  member,
  roleOptions,
}: {
  canManageRoles: boolean;
  canViewRoles: boolean;
  member: StaffDirectoryMember;
  roleOptions: readonly StaffRoleOption[];
}) {
  return (
    <tr className="align-top transition-colors hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[220px]"><StaffProfileLink member={member} /></TableCell>
      <TableCell className="w-[220px]">
        <p className="break-all font-medium text-text-default">{member.email}</p>
        <p className="mt-0.5 tabular-nums text-caption text-text-muted">{member.phone || "Chưa có số điện thoại"}</p>
      </TableCell>
      <TableCell className="w-[150px]"><EmploymentStatusBadge status={member.employmentStatus} /></TableCell>
      <TableCell className="w-[300px]">
        <StaffRoles canViewRoles={canViewRoles} member={member} />
        {canManageRoles ? <StaffRoleManagement member={member} roleOptions={roleOptions} /> : null}
      </TableCell>
      <TableCell className="w-[135px] tabular-nums text-secondary text-text-muted">{formatDate(member.joinedAt)}</TableCell>
      <TableCell className="w-[155px] tabular-nums text-secondary text-text-muted">{formatDateTime(member.lastLoginAt)}</TableCell>
    </tr>
  );
}

function StaffRecord({
  canManageRoles,
  canViewRoles,
  member,
  roleOptions,
}: {
  canManageRoles: boolean;
  canViewRoles: boolean;
  member: StaffDirectoryMember;
  roleOptions: readonly StaffRoleOption[];
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <StaffProfileLink member={member} />
        <EmploymentStatusBadge status={member.employmentStatus} />
      </div>
      <dl className="mt-3 grid gap-2.5 text-secondary">
        <RecordField label="Liên hệ" value={`${member.email}${member.phone ? ` · ${member.phone}` : ""}`} />
        <div>
          <dt className="text-label text-text-muted">Vai trò hiệu lực</dt>
          <dd className="mt-1"><StaffRoles canViewRoles={canViewRoles} member={member} /></dd>
        </div>
        <RecordField label="Ngày vào làm" value={formatDate(member.joinedAt)} />
        <RecordField label="Đăng nhập gần nhất" value={formatDateTime(member.lastLoginAt)} />
      </dl>
      {canManageRoles ? <div className="mt-3 border-t border-border-subtle pt-3"><StaffRoleManagement member={member} roleOptions={roleOptions} /></div> : null}
      <Link
        aria-label={`Mở hồ sơ nhân sự ${member.displayName}`}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
        href={`/staff/${member.id}`}
      >
        Mở hồ sơ nhân sự
      </Link>
    </article>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="h-10 border-b border-border-subtle px-3 text-left font-semibold" scope="col">{children}</th>;
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("min-h-14 px-3 py-3 align-top text-table-body", className)}>{children}</td>;
}

function RecordField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-label text-text-muted">{label}</dt><dd className="mt-0.5 break-words text-text-default">{value}</dd></div>;
}

function StaffIdentity({ member }: { member: StaffDirectoryMember }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-caption font-bold text-text-muted">{getInitials(member.displayName)}</span>
      <div className="min-w-0"><p className="truncate font-semibold text-text-strong">{member.displayName}</p><p className="mt-0.5 truncate font-mono text-caption text-text-muted">{member.employeeCode || "Chưa có mã nhân sự"}</p></div>
    </div>
  );
}

function StaffProfileLink({ member }: { member: StaffDirectoryMember }) {
  return <Link className="block rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={`/staff/${member.id}`}><StaffIdentity member={member} /></Link>;
}

export function EmploymentStatusBadge({ status }: { status: StaffEmploymentStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-caption font-semibold", statusClasses[status])}>{statusLabels[status]}</span>;
}

function StaffRoles({ canViewRoles, member }: { canViewRoles: boolean; member: StaffDirectoryMember }) {
  if (!canViewRoles || member.roles === null) return <span className="text-secondary text-text-muted">Ẩn theo phân quyền</span>;
  if (member.roles.length === 0) return <span className="text-secondary text-warning">Chưa được cấp vai trò</span>;
  return <div className="flex flex-wrap gap-1.5">{member.roles.map((role) => <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-caption font-semibold text-text-default" key={role.id} title={`Mã vai trò: ${role.code}`}>{role.name}</span>)}</div>;
}

function getInitials(displayName: string): string {
  const initials = displayName.trim().split(/\s+/).filter(Boolean).slice(-2).map((word) => Array.from(word)[0]).join("").toUpperCase();
  return initials || "TV";
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
