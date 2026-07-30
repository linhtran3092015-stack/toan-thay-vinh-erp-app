import { Badge } from "@/components/ui/badge";
import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";

interface CommissionListPageProps {
  canManage: boolean;
  entries: readonly SalesCommissionAccrualDashboardEntry[];
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function CommissionListPage({
  canManage,
  entries,
}: CommissionListPageProps) {
  const eligibleRevenue = entries.reduce(
    (total, entry) => total + entry.recognizedRevenueVnd,
    0,
  );
  const mmaCount = entries.filter(
    (entry) => entry.leadSourceGroup === "mma",
  ).length;
  const sandboxCount = entries.length - mmaCount;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Quản lý nhân sự
          </p>
          <h1 className="mt-1 text-page-title font-bold text-ink">Hoa hồng Sale</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Hệ thống ghi nhận tự động doanh thu học phí thực nhận của các case nguồn MMA và Sandbox. Đây là dữ liệu đối soát, chưa phải khoản lương hoặc số tiền hoa hồng.
          </p>
        </div>
        <Badge tone={canManage ? "info" : "neutral"}>
          {canManage ? "Phạm vi: toàn bộ" : "Phạm vi: của tôi"}
        </Badge>
      </header>

      <section
        aria-label="Tổng quan hoa hồng Sale"
        className="grid gap-3 sm:grid-cols-3"
      >
        <SummaryCard label="Khoản thu đủ điều kiện" value={entries.length} />
        <SummaryCard
          label="Doanh thu đủ điều kiện"
          value={formatCurrency(eligibleRevenue)}
        />
        <SummaryCard label="Quy đổi hoa hồng" value="Chưa thiết lập" />
      </section>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
          <h2 className="text-section font-semibold text-ink">
            Chưa có doanh thu hoa hồng
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-muted">
            Một bản ghi sẽ được tạo khi học phí được ghi nhận và học viên thuộc CRM case đã chuyển đổi, có Sale phụ trách, với nguồn MMA hoặc Sandbox.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
          <div className="flex flex-col gap-1 border-b border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-section font-semibold text-ink">
                Lịch sử doanh thu đủ điều kiện
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Hiển thị tối đa 200 khoản thu mới nhất trong phạm vi tài khoản.
              </p>
            </div>
            <p className="text-sm text-ink-muted">
              MMA: {mmaCount} · Sandbox: {sandboxCount}
            </p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1060px] border-collapse text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  {canManage ? (
                    <th className="px-5 py-3 font-semibold">Sale phụ trách</th>
                  ) : null}
                  <th className="px-5 py-3 font-semibold">Nguồn</th>
                  <th className="px-5 py-3 font-semibold">Doanh thu thực nhận</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold">Ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((entry) => (
                  <CommissionTableRow
                    canManage={canManage}
                    entry={entry}
                    key={entry.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {entries.map((entry) => (
              <CommissionMobileCard
                canManage={canManage}
                entry={entry}
                key={entry.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CommissionTableRow({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{entry.studentFullName}</p>
        <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
          {entry.studentPublicCode}
        </p>
      </td>
      {canManage ? (
        <td className="px-5 py-4">
          <p className="text-ink">{entry.saleOwnerDisplayName}</p>
          {entry.saleOwnerEmployeeCode ? (
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {entry.saleOwnerEmployeeCode}
            </p>
          ) : null}
        </td>
      ) : null}
      <td className="px-5 py-4">
        <Badge tone={entry.leadSourceGroup === "mma" ? "info" : "purple"}>
          {entry.leadSourceGroup.toUpperCase()}
        </Badge>
        <p className="mt-2 text-xs text-ink-muted">{entry.leadSourceName}</p>
      </td>
      <td className="px-5 py-4 font-medium text-ink">
        {formatCurrency(entry.recognizedRevenueVnd)}
      </td>
      <td className="px-5 py-4">
        <Badge tone="warning">Chờ chính sách</Badge>
      </td>
      <td className="px-5 py-4 text-ink-muted">
        {formatDateTime(entry.recognizedAt)}
      </td>
    </tr>
  );
}

function CommissionMobileCard({
  canManage,
  entry,
}: {
  canManage: boolean;
  entry: SalesCommissionAccrualDashboardEntry;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{entry.studentFullName}</h3>
          <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
            {entry.studentPublicCode}
          </p>
        </div>
        <Badge tone="warning">Chờ chính sách</Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <MobileField
          label="Doanh thu thực nhận"
          value={formatCurrency(entry.recognizedRevenueVnd)}
        />
        <MobileField
          label="Nguồn"
          value={`${entry.leadSourceGroup.toUpperCase()} - ${entry.leadSourceName}`}
        />
        {canManage ? (
          <MobileField label="Sale phụ trách" value={entry.saleOwnerDisplayName} />
        ) : null}
        <MobileField label="Ghi nhận" value={formatDateTime(entry.recognizedAt)} />
      </dl>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 truncate text-lg font-bold text-ink">{value}</p>
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

function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} VND`;
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
