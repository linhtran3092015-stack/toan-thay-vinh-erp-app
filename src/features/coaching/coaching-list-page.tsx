import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CreateCoachingDialog } from "@/features/coaching/components/create-coaching-dialog";
import type {
  CoachingManagementOptions,
  CoachingPriority,
  CoachingRecordDashboardEntry,
} from "@/features/coaching/read-models";

interface CoachingListPageProps {
  canManage: boolean;
  entries: readonly CoachingRecordDashboardEntry[];
  managementOptions: CoachingManagementOptions | null;
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const priorityMetadata: Record<
  CoachingPriority,
  { label: string; tone: "danger" | "info" | "warning" }
> = {
  high: { label: "Ưu tiên cao", tone: "danger" },
  low: { label: "Ưu tiên thấp", tone: "info" },
  medium: { label: "Ưu tiên trung bình", tone: "warning" },
};

const statusMetadata: Record<
  "closed" | "in_progress" | "open",
  { label: string; tone: "info" | "neutral" | "success" | "warning" }
> = {
  closed: { label: "Đã đóng", tone: "success" },
  in_progress: { label: "Đang xử lý", tone: "warning" },
  open: { label: "Mở", tone: "info" },
};

export function CoachingListPage({
  canManage,
  entries,
  managementOptions,
}: CoachingListPageProps) {
  const activeCount = entries.filter(
    (entry) =>
      entry.currentStatus === "open" ||
      entry.currentStatus === "in_progress",
  ).length;
  const overdueCount = entries.filter(
    (entry) =>
      (entry.currentStatus === "open" ||
        entry.currentStatus === "in_progress") &&
      entry.reviewAt !== null &&
      new Date(`${entry.reviewAt}T23:59:59`) < new Date(),
  ).length;

  return (
    <div className="grid gap-5">
      <header className="rounded-lg border border-hairline bg-surface-1 p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Quản lý học tập
            </p>
            <h1 className="mt-1 text-page-title font-bold text-ink">Coaching</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
              Mỗi đợt theo dõi là một phiếu độc lập. Lịch sử được lưu theo
              sự kiện, không ghi đè lên thông tin đã ghi nhận.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-md border border-hairline px-4 text-sm font-semibold text-ink hover:bg-surface-2" href="/coaching/forms">Phiếu / Biểu mẫu</Link>
            {canManage && managementOptions ? (
              <CreateCoachingDialog
                assignees={managementOptions.assignees}
                students={managementOptions.students}
              />
            ) : null}
          </div>
        </div>
      </header>

      <section aria-label="Tổng quan coaching" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Phiếu đang hiển thị" value={entries.length} />
        <SummaryCard label="Đang cần theo dõi" value={activeCount} />
        <SummaryCard label="Quá ngày xem lại" value={overdueCount} />
      </section>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
          <h2 className="text-section-title font-semibold text-ink">Chưa có phiếu coaching</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-muted">
            {canManage
              ? "Tạo phiếu đầu tiên để bắt đầu theo dõi một đợt Coaching của học viên."
              : "Chưa có đợt Coaching nào được ghi nhận trong hệ thống."}
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
          <div className="border-b border-hairline px-5 py-4">
            <h2 className="text-section-title font-semibold text-ink">Danh sách phiếu</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Hiển thị tối đa 200 phiếu mới nhất.
            </p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  <th className="px-5 py-3 font-semibold">Đợt coaching</th>
                  <th className="px-5 py-3 font-semibold">Ưu tiên</th>
                  <th className="px-5 py-3 font-semibold">Người phụ trách</th>
                  <th className="px-5 py-3 font-semibold">Xem lại</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold">Mở phiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((entry) => (
                  <CoachingTableRow entry={entry} key={entry.id} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {entries.map((entry) => (
              <CoachingMobileCard entry={entry} key={entry.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function CoachingStatusBadge({ status }: { status: string }) {
  if (!Object.hasOwn(statusMetadata, status)) {
    return <Badge tone="neutral">Trạng thái chưa hỗ trợ: {status}</Badge>;
  }

  const metadata = statusMetadata[status as keyof typeof statusMetadata];
  return <Badge tone={metadata.tone}>{metadata.label}</Badge>;
}

export function CoachingPriorityBadge({ priority }: { priority: CoachingPriority }) {
  const metadata = priorityMetadata[priority];
  return <Badge tone={metadata.tone}>{metadata.label}</Badge>;
}

function CoachingTableRow({ entry }: { entry: CoachingRecordDashboardEntry }) {
  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{entry.studentFullName}</p>
        <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
          {entry.studentPublicCode}
        </p>
      </td>
      <td className="px-5 py-4">
        <Link
          className="font-medium text-primary hover:underline"
          href={`/coaching/${entry.id}`}
        >
          {entry.campaignName}
        </Link>
        <p className="mt-1 line-clamp-2 max-w-sm text-xs leading-5 text-ink-muted">
          {entry.reason}
        </p>
      </td>
      <td className="px-5 py-4">
        <CoachingPriorityBadge priority={entry.priority} />
      </td>
      <td className="px-5 py-4 text-ink">{entry.assistantOwnerDisplayName}</td>
      <td className="px-5 py-4 text-ink-muted">{formatDate(entry.reviewAt)}</td>
      <td className="px-5 py-4">
        <CoachingStatusBadge status={entry.currentStatus} />
      </td>
      <td className="px-5 py-4 text-ink-muted">{formatDateTime(entry.openedAt)}</td>
    </tr>
  );
}

function CoachingMobileCard({ entry }: { entry: CoachingRecordDashboardEntry }) {
  return (
    <Link
      className="rounded-lg border border-hairline bg-white p-4 transition hover:border-border-focus focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/25"
      href={`/coaching/${entry.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{entry.studentFullName}</h3>
          <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
            {entry.studentPublicCode}
          </p>
        </div>
        <CoachingStatusBadge status={entry.currentStatus} />
      </div>
      <p className="mt-4 font-medium text-primary">{entry.campaignName}</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <MobileField label="Ưu tiên" value={priorityMetadata[entry.priority].label} />
        <MobileField label="Người phụ trách" value={entry.assistantOwnerDisplayName} />
        <MobileField label="Ngày xem lại" value={formatDate(entry.reviewAt)} />
      </dl>
    </Link>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-ink">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : "Chưa đặt lịch";
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
