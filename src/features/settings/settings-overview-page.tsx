import Link from "next/link";

import type { SettingsPermissionMatrix } from "@/features/settings/types";
import type { StaffDirectoryMember } from "@/features/staff/types";

interface SettingsOverviewPageProps {
  canManageRoles: boolean;
  canViewAudit: boolean;
  canViewUsers: boolean;
  matrix: SettingsPermissionMatrix;
  members: readonly StaffDirectoryMember[] | null;
}

export function SettingsOverviewPage({
  canManageRoles,
  canViewAudit,
  canViewUsers,
  matrix,
  members,
}: SettingsOverviewPageProps) {
  const activeRoles = matrix.roles.filter((role) => role.isActive);
  const activePermissions = matrix.permissions.filter(
    (permission) => permission.isActive,
  );
  const unassignedUsers =
    members?.filter((member) => member.roles?.length === 0).length ?? null;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2" aria-label="Thương hiệu và website">
        <Link href="/settings/branding" className="brand-panel"><h2>Thương hiệu &amp; Giao diện</h2><p className="mt-2 text-sm text-text-muted">Logo, favicon, màu thương hiệu và giao diện ERP.</p></Link>
        <Link href="/settings/website" className="brand-panel"><h2>Trang web công khai</h2><p className="mt-2 text-sm text-text-muted">Soạn trang giới thiệu, xếp khối nội dung, xem trước và quản lý bản đăng.</p></Link>
      </section>
      <section
        aria-label="Tổng quan cấu hình truy cập"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <SummaryItem label="Người dùng" value={formatCount(members?.length)} />
        <SummaryItem label="Vai trò hoạt động" value={String(activeRoles.length)} />
        <SummaryItem
          label="Quyền hoạt động"
          value={String(activePermissions.length)}
        />
        <SummaryItem
          attention={unassignedUsers !== null && unassignedUsers > 0}
          label="Chưa có vai trò"
          value={formatCount(unassignedUsers)}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="text-section-title font-semibold text-ink">
            Quản trị truy cập
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Quyền hiệu lực được hợp từ các vai trò đang hoạt động của từng tài khoản.
          </p>
        </div>

        <div className="divide-y divide-hairline">
          {canViewUsers ? (
            <SettingsLinkRow
              description={
                canManageRoles
                  ? "Thêm tài khoản, cấp vai trò ban đầu và cập nhật vai trò có ghi nhật ký."
                  : "Xem tài khoản và vai trò hiện tại ở chế độ chỉ đọc."
              }
              href="/settings/users"
              status={canManageRoles ? "Có thể quản lý" : "Chỉ đọc"}
              title="Người dùng và vai trò"
            />
          ) : null}

          <SettingsLinkRow
            description={
              canManageRoles
                ? "Thiết lập bộ quyền theo từng vai trò và lưu thay đổi theo lô."
                : "Đối chiếu quyền đang được cấp cho từng vai trò trong hệ thống."
            }
            href="/settings/permissions"
            status={canManageRoles ? "Có thể quản lý" : "Chỉ đọc"}
            title="Ma trận phân quyền"
          />

          {canViewAudit ? (
            <SettingsLinkRow
              description="Tra cứu lịch sử cấp, thu hồi vai trò và các thay đổi được audit."
              href="/settings/audit-logs"
              status="Có nhật ký"
              title="Nhật ký thay đổi"
            />
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="text-section-title font-semibold text-ink">
            Cấu hình nền tảng
          </h2>
        </div>
        <dl className="divide-y divide-hairline">
          <ReadOnlySetting label="Tên hệ thống" value="TOÁN THẦY VINH" />
          <ReadOnlySetting label="Múi giờ" value="Asia/Ho_Chi_Minh" />
          <ReadOnlySetting
            label="Mô hình truy cập"
            value="Supabase Auth + database RBAC"
          />
        </dl>
      </section>
    </div>
  );
}

function SummaryItem({
  attention = false,
  label,
  value,
}: {
  attention?: boolean;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p
        className={`mt-2 text-xl font-bold ${attention ? "text-warning" : "text-ink"}`}
      >
        {value}
      </p>
    </article>
  );
}

function SettingsLinkRow({
  description,
  href,
  status,
  title,
}: {
  description: string;
  href: string;
  status: string;
  title: string;
}) {
  return (
    <Link
      className="flex min-h-16 flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
      href={href}
    >
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-ink-muted">
          {description}
        </span>
      </span>
      <span className="w-fit flex-none rounded-pill border border-hairline bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-ink-muted">
        {status}
      </span>
    </Link>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[220px_1fr] sm:items-center">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "Không có quyền xem" : String(value);
}
