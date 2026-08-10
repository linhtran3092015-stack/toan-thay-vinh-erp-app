import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { StaffProfileEditDialog } from "@/features/staff/components/staff-profile-edit-dialog";
import { StaffRateVersionDialog } from "@/features/staff/components/staff-rate-version-dialog";
import { EmploymentStatusBadge } from "@/features/staff/staff-directory-page";
import type { StaffDetailReadModel, StaffRateVersion } from "@/features/staff/types";

interface StaffDetailPageProps {
  canManageProfile: boolean;
  canManageRateVersions: boolean;
  canViewRateVersions: boolean;
  canViewRoles: boolean;
  detail: StaffDetailReadModel;
}

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

/** Presentation-only profile hierarchy. Role and rate mutation components stay feature-owned. */
export function StaffDetailPage({
  canManageProfile,
  canManageRateVersions,
  canViewRateVersions,
  canViewRoles,
  detail,
}: StaffDetailPageProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={canManageProfile ? <StaffProfileEditDialog detail={detail} /> : undefined}
        context={<EmploymentStatusBadge status={detail.employmentStatus} />}
        title={detail.displayName}
      >
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href="/staff">
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />Quay lại nhân sự
        </Link>
        <p className="mt-1 font-mono text-caption text-text-muted">{detail.employeeCode ?? "Chưa có mã nhân sự"}</p>
      </PageHeader>

      {!canManageProfile && !canManageRateVersions ? <p className="text-secondary text-text-muted">Hồ sơ chỉ đọc theo quyền hiện tại.</p> : null}

      <section aria-labelledby="staff-profile-information" className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5">
        <h2 className="text-section-title text-text-strong" id="staff-profile-information">Thông tin nhân sự</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <InfoField label="Email" value={detail.email} />
          <InfoField label="Điện thoại" value={detail.phone ?? "Chưa cập nhật"} />
          <InfoField label="Mã nhân sự" value={detail.employeeCode ?? "Chưa cập nhật"} />
          <InfoField label="Trạng thái làm việc" value={<EmploymentStatusBadge status={detail.employmentStatus} />} />
          <InfoField label="Ngày vào làm" value={formatDate(detail.joinedAt)} />
          <InfoField label="Ngày nghỉ" value={formatDate(detail.leftAt)} />
          <InfoField label="Đăng nhập gần nhất" value={formatDateTime(detail.lastLoginAt)} wide />
        </dl>
      </section>

      <section aria-labelledby="staff-active-roles" className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5">
        <h2 className="text-section-title text-text-strong" id="staff-active-roles">Vai trò hiệu lực</h2>
        {!canViewRoles ? (
          <p className="mt-3 text-secondary text-text-muted">Tài khoản hiện tại không có quyền staff.roles.view.</p>
        ) : detail.roles?.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Vai trò hiệu lực">
            {detail.roles.map((role) => (
              <li className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5" key={role.assignmentId}>
                <p className="font-semibold text-text-strong">{role.name}</p>
                <p className="mt-1 text-caption text-text-muted">{role.code} · Cấp ngày {formatDateTime(role.assignedAt)}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyPanel text="Chưa được cấp vai trò hiệu lực." />}
      </section>

      {canViewRateVersions ? (
        <section aria-labelledby="staff-rate-history" className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-section-title text-text-strong" id="staff-rate-history">Lịch sử đơn giá theo phiên bản</h2>
              <p className="mt-1 text-secondary text-text-muted">Đơn giá online luôn bằng 50% đơn giá offline trong cùng phiên bản.</p>
            </div>
            {canManageRateVersions ? <StaffRateVersionDialog staffId={detail.id} /> : null}
          </div>
          {detail.rateVersions?.length ? <RateHistory rateVersions={detail.rateVersions} /> : <EmptyPanel text="Chưa thiết lập phiên bản đơn giá cho nhân sự này." />}
        </section>
      ) : null}
    </div>
  );
}

function RateHistory({ rateVersions }: { rateVersions: readonly StaffRateVersion[] }) {
  return (
    <div className="staff-rate-history-work-area mt-4 min-w-0">
      <DataTableFrame
        body={rateVersions.map((rateVersion) => (
          <tr className="transition-colors hover:bg-[var(--table-row-hover)]" key={rateVersion.id}>
            <RateCell className="w-[150px] tabular-nums font-medium">{formatDate(rateVersion.effectiveFrom)}</RateCell>
            <RateCell className="w-[190px] text-right tabular-nums font-semibold">{moneyFormatter.format(rateVersion.offlineHourlyRateVnd)}</RateCell>
            <RateCell className="w-[190px] text-right tabular-nums font-semibold">{moneyFormatter.format(rateVersion.onlineHourlyRateVnd)}</RateCell>
            <RateCell className="min-w-[210px] whitespace-normal text-text-muted">{rateVersion.note ?? "—"}</RateCell>
          </tr>
        ))}
        caption="Lịch sử đơn giá theo phiên bản"
        className="staff-rate-history-table"
        header={<tr><RateHeader>Hiệu lực từ</RateHeader><RateHeader className="text-right">Offline / giờ</RateHeader><RateHeader className="text-right">Online / giờ</RateHeader><RateHeader>Ghi chú</RateHeader></tr>}
        tableClassName="min-w-[760px] table-fixed text-table-body text-text-default"
      />
      <ResponsiveRecordList className="staff-rate-history-record-list" label="Lịch sử đơn giá theo phiên bản">
        {rateVersions.map((rateVersion) => (
          <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" key={rateVersion.id} role="listitem">
            <p className="tabular-nums text-caption font-semibold text-text-muted">Hiệu lực từ {formatDate(rateVersion.effectiveFrom)}</p>
            <dl className="mt-3 grid gap-2 text-secondary"><RateRecordField label="Offline / giờ" value={moneyFormatter.format(rateVersion.offlineHourlyRateVnd)} /><RateRecordField label="Online / giờ" value={moneyFormatter.format(rateVersion.onlineHourlyRateVnd)} /><RateRecordField label="Ghi chú" value={rateVersion.note ?? "—"} /></dl>
          </article>
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function InfoField({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2 xl:col-span-3" : undefined}><dt className="text-label text-text-muted">{label}</dt><dd className="mt-1 break-words text-secondary font-medium text-text-default">{value}</dd></div>;
}

function RateHeader({ children, className }: { children: React.ReactNode; className?: string }) { return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">{children}</th>; }
function RateCell({ children, className }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 align-top ${className ?? ""}`}>{children}</td>; }
function RateRecordField({ label, value }: { label: string; value: string }) { return <div><dt className="text-label text-text-muted">{label}</dt><dd className="mt-0.5 break-words tabular-nums font-medium text-text-default">{value}</dd></div>; }
function EmptyPanel({ text }: { text: string }) { return <p className="mt-4 rounded-md border border-dashed border-border-subtle bg-surface-raised px-3 py-4 text-secondary text-text-muted">{text}</p>; }

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : dateFormatter.format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : dateTimeFormatter.format(date);
}
