import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaffProfileEditDialog } from "@/features/staff/components/staff-profile-edit-dialog";
import { StaffRateVersionDialog } from "@/features/staff/components/staff-rate-version-dialog";
import type {
  StaffDetailReadModel,
  StaffEmploymentStatus,
} from "@/features/staff/types";

interface StaffDetailPageProps {
  canManageProfile: boolean;
  canManageRateVersions: boolean;
  canViewRateVersions: boolean;
  canViewRoles: boolean;
  detail: StaffDetailReadModel;
}

const statusMeta: Record<
  StaffEmploymentStatus,
  { label: string; tone: "danger" | "neutral" | "success" | "warning" }
> = {
  active: { label: "Đang làm việc", tone: "success" },
  inactive: { label: "Đã nghỉ", tone: "neutral" },
  suspended: { label: "Tạm khóa", tone: "warning" },
  unknown: { label: "Chưa xác định", tone: "danger" },
};

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function StaffDetailPage({
  canManageProfile,
  canManageRateVersions,
  canViewRateVersions,
  canViewRoles,
  detail,
}: StaffDetailPageProps) {
  const status = statusMeta[detail.employmentStatus];

  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Link
            className="font-semibold text-primary hover:underline"
            href="/staff"
          >
            Nhân sự
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">{detail.displayName}</span>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-pill bg-primary-soft text-base font-bold text-primary">
              {getInitials(detail.displayName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-ink md:text-3xl">
                  {detail.displayName}
                </h1>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-ink-muted">
                {detail.employeeCode ?? "Chưa có mã nhân sự"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageProfile ? (
              <StaffProfileEditDialog detail={detail} />
            ) : null}
            {!canManageProfile && !canManageRateVersions ? (
              <p className="text-sm text-ink-muted">Hồ sơ chỉ đọc</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Trạng thái" value={status.label} />
        <SummaryCard
          label="Vai trò hiệu lực"
          value={
            canViewRoles
              ? String(detail.roles?.length ?? 0)
              : "Không có quyền"
          }
        />
        <SummaryCard
          label="Ngày vào làm"
          value={formatDate(detail.joinedAt)}
        />
        <SummaryCard
          label="Đơn giá mới nhất"
          value={
            canViewRateVersions
              ? formatCurrentRate(detail)
              : "Không có quyền"
          }
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Email" value={detail.email} />
            <InfoTile
              label="Điện thoại"
              value={detail.phone ?? "Chưa cập nhật"}
            />
            <InfoTile
              label="Mã nhân sự"
              value={detail.employeeCode ?? "Chưa cập nhật"}
            />
            <InfoTile label="Trạng thái" value={status.label} />
            <InfoTile
              label="Ngày vào làm"
              value={formatDate(detail.joinedAt)}
            />
            <InfoTile
              label="Ngày nghỉ"
              value={formatDate(detail.leftAt)}
            />
            <InfoTile
              label="Đăng nhập gần nhất"
              value={formatDateTime(detail.lastLoginAt)}
              wide
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vai trò hiệu lực</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {canViewRoles ? (
              detail.roles?.length ? (
                detail.roles.map((role) => (
                  <div
                    className="rounded-md border border-hairline bg-canvas px-3 py-2.5"
                    key={role.assignmentId}
                  >
                    <p className="font-semibold text-ink">{role.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {role.code} · Cấp ngày {formatDateTime(role.assignedAt)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyPanel text="Chưa được cấp vai trò hiệu lực." />
              )
            ) : (
              <EmptyPanel text="Tài khoản hiện tại không có quyền staff.roles.view." />
            )}
          </CardContent>
        </Card>
      </div>

      {canViewRateVersions ? (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử đơn giá theo phiên bản</CardTitle>
            {canManageRateVersions ? (
              <StaffRateVersionDialog staffId={detail.id} />
            ) : null}
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-6 text-ink-muted">
              Đơn giá online luôn bằng 50% đơn giá offline trong cùng phiên bản.
            </p>
            {detail.rateVersions?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-y border-hairline bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Hiệu lực từ</th>
                      <th className="px-3 py-3 font-semibold">Offline / giờ</th>
                      <th className="px-3 py-3 font-semibold">Online / giờ</th>
                      <th className="px-3 py-3 font-semibold">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {detail.rateVersions.map((rateVersion) => (
                      <tr key={rateVersion.id}>
                        <td className="px-3 py-3 font-medium text-ink">
                          {formatDate(rateVersion.effectiveFrom)}
                        </td>
                        <td className="px-3 py-3 text-ink">
                          {moneyFormatter.format(rateVersion.offlineHourlyRateVnd)}
                        </td>
                        <td className="px-3 py-3 text-ink">
                          {moneyFormatter.format(rateVersion.onlineHourlyRateVnd)}
                        </td>
                        <td className="px-3 py-3 text-ink-muted">
                          {rateVersion.note ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel text="Chưa thiết lập phiên bản đơn giá cho nhân sự này." />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 truncate text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function InfoTile({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-hairline bg-canvas px-3 py-4 text-sm text-ink-muted">
      {text}
    </p>
  );
}

function formatCurrentRate(detail: StaffDetailReadModel): string {
  const currentRate = detail.rateVersions?.[0];

  return currentRate
    ? `${moneyFormatter.format(currentRate.offlineHourlyRateVnd)}/giờ`
    : "Chưa thiết lập";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : dateFormatter.format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : dateTimeFormatter.format(date);
}

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();

  return initials || "TV";
}
