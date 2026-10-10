import { Badge } from "@/components/ui/badge";
import type { GradingCreditDashboardEntry } from "@/features/grading-credits/read-models";

interface GradingCreditListPageProps {
  canViewAll: boolean;
  entries: readonly GradingCreditDashboardEntry[];
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

export function GradingCreditListPage({
  canViewAll,
  entries,
}: GradingCreditListPageProps) {
  const creditsThisMonth = entries.filter((entry) => {
    const creditDate = new Date(entry.creditedAt);
    const now = new Date();

    return (
      creditDate.getFullYear() === now.getFullYear() &&
      creditDate.getMonth() === now.getMonth()
    );
  }).length;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Quản lý nhân sự
          </p>
          <h1 className="mt-1 text-page-title font-bold text-ink">
            Tín chỉ chấm bài
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Mỗi kết quả có điểm được khóa tạo một tín chỉ cho người chấm. Tín chỉ là dữ liệu nghiệp vụ, chưa được quy đổi thành tiền lương.
          </p>
        </div>
        <Badge tone={canViewAll ? "info" : "neutral"}>
          {canViewAll ? "Phạm vi: toàn bộ" : "Phạm vi: của tôi"}
        </Badge>
      </header>

      <section
        aria-label="Tổng quan tín chỉ chấm bài"
        className="grid gap-3 sm:grid-cols-3"
      >
        <SummaryCard label="Tín chỉ đang hiển thị" value={entries.length} />
        <SummaryCard label="Tín chỉ tháng này" value={creditsThisMonth} />
        <SummaryCard label="Quy đổi lương" value="Chưa thiết lập" />
      </section>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
          <h2 className="text-section-title font-semibold text-ink">
            Chưa có tín chỉ chấm bài
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
            Tín chỉ sẽ được ghi nhận tự động ngay khi một buổi học hoàn thành được khóa và có kết quả đã chấm.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
          <div className="border-b border-hairline px-5 py-4">
            <h2 className="text-section-title font-semibold text-ink">
              Lịch sử ghi nhận
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Hiển thị tối đa 200 tín chỉ mới nhất trong phạm vi tài khoản.
            </p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Buổi học</th>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  {canViewAll ? (
                    <th className="px-5 py-3 font-semibold">Người chấm</th>
                  ) : null}
                  <th className="px-5 py-3 font-semibold">Tín chỉ</th>
                  <th className="px-5 py-3 font-semibold">Ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((entry) => (
                  <GradingCreditTableRow
                    canViewAll={canViewAll}
                    entry={entry}
                    key={entry.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {entries.map((entry) => (
              <GradingCreditMobileCard
                canViewAll={canViewAll}
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

function GradingCreditTableRow({
  canViewAll,
  entry,
}: {
  canViewAll: boolean;
  entry: GradingCreditDashboardEntry;
}) {
  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{entry.className}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {entry.classCode} - {formatDate(entry.sessionDate)}
        </p>
      </td>
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{entry.studentFullName}</p>
        <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
          {entry.studentPublicCode}
        </p>
      </td>
      {canViewAll ? (
        <td className="px-5 py-4 text-ink">{entry.graderDisplayName}</td>
      ) : null}
      <td className="px-5 py-4">
        <Badge tone="success">{formatCredit(entry.creditUnits)}</Badge>
      </td>
      <td className="px-5 py-4 text-ink-muted">
        {formatDateTime(entry.creditedAt)}
      </td>
    </tr>
  );
}

function GradingCreditMobileCard({
  canViewAll,
  entry,
}: {
  canViewAll: boolean;
  entry: GradingCreditDashboardEntry;
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
        <Badge tone="success">{formatCredit(entry.creditUnits)}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <MobileField
          label="Buổi học"
          value={`${entry.classCode} - ${entry.className}`}
        />
        <MobileField label="Ngày học" value={formatDate(entry.sessionDate)} />
        {canViewAll ? (
          <MobileField label="Người chấm" value={entry.graderDisplayName} />
        ) : null}
        <MobileField label="Ghi nhận" value={formatDateTime(entry.creditedAt)} />
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

function formatCredit(value: number): string {
  return `${value} tín chỉ`;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
