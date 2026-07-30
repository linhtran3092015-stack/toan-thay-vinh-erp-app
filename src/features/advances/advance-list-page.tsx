import { Badge } from "@/components/ui/badge";
import { RequestSalaryAdvanceDialog } from "@/features/advances/components/request-salary-advance-dialog";
import { SalaryAdvanceDecisionDialog } from "@/features/advances/components/salary-advance-decision-dialog";
import type {
  SalaryAdvanceDashboardEntry,
  SalaryAdvanceStatus,
} from "@/features/advances/read-models";

interface AdvanceListPageProps {
  canApprove: boolean;
  canRequest: boolean;
  canReview: boolean;
  entries: readonly SalaryAdvanceDashboardEntry[];
}

const statusMetadata: Record<
  SalaryAdvanceStatus,
  { label: string; tone: "danger" | "info" | "success" | "warning" }
> = {
  approved: { label: "Đã duyệt", tone: "success" },
  deducted: { label: "Đã khấu trừ", tone: "info" },
  rejected: { label: "Đã từ chối", tone: "danger" },
  requested: { label: "Chờ đối soát", tone: "warning" },
  review: { label: "Chờ duyệt", tone: "warning" },
};

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function AdvanceListPage({
  canApprove,
  canRequest,
  canReview,
  entries,
}: AdvanceListPageProps) {
  const pendingCount = entries.filter(
    (entry) => entry.status === "requested" || entry.status === "review",
  ).length;
  const approvedAmount = entries
    .filter((entry) => entry.status === "approved")
    .reduce((total, entry) => total + entry.amountVnd, 0);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Quản lý nhân sự
          </p>
          <h1 className="mt-1 text-page-title font-bold text-ink">Tạm ứng lương</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Khoản tạm ứng đã duyệt được khấu trừ một lần trong bảng lương của kỳ tháng đã chọn.
          </p>
        </div>
        {canRequest ? <RequestSalaryAdvanceDialog /> : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Tổng quan tạm ứng">
        <SummaryCard label="Yêu cầu đang hiển thị" value={entries.length} />
        <SummaryCard label="Chờ xử lý" value={pendingCount} />
        <SummaryCard label="Chờ khấu trừ" value={formatCurrency(approvedAmount)} />
      </section>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
          <h2 className="text-section font-semibold text-ink">Chưa có yêu cầu tạm ứng</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
            Các yêu cầu của bạn sẽ xuất hiện tại đây sau khi gửi. Người được phân quyền đối soát và duyệt sẽ xem toàn bộ yêu cầu.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
          <div className="border-b border-hairline px-5 py-4">
            <h2 className="text-section font-semibold text-ink">Danh sách yêu cầu</h2>
            <p className="mt-1 text-sm text-ink-muted">Hiển thị {entries.length} yêu cầu tạm ứng</p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nhân sự</th>
                  <th className="px-5 py-3 font-semibold">Số tiền</th>
                  <th className="px-5 py-3 font-semibold">Kỳ khấu trừ</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold">Yêu cầu</th>
                  <th className="px-5 py-3 font-semibold">Theo dõi</th>
                  {(canReview || canApprove) ? <th className="px-5 py-3 font-semibold">Thao tác</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((entry) => (
                  <AdvanceTableRow
                    canApprove={canApprove}
                    canReview={canReview}
                    entry={entry}
                    key={entry.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {entries.map((entry) => (
              <AdvanceMobileCard
                canApprove={canApprove}
                canReview={canReview}
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

function AdvanceTableRow({
  canApprove,
  canReview,
  entry,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
}) {
  const status = statusMetadata[entry.status];

  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{entry.staffDisplayName}</p>
        {entry.staffEmployeeCode ? (
          <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
            {entry.staffEmployeeCode}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4 font-medium text-ink">{formatCurrency(entry.amountVnd)}</td>
      <td className="px-5 py-4 text-ink-muted">{formatMonth(entry.deductionPeriodMonth)}</td>
      <td className="px-5 py-4"><Badge tone={status.tone}>{status.label}</Badge></td>
      <td className="px-5 py-4">
        <p className="max-w-64 text-ink">{entry.requestNote}</p>
        <p className="mt-1 text-xs text-ink-muted">{formatDateTime(entry.requestedAt)}</p>
      </td>
      <td className="px-5 py-4 text-sm text-ink-muted"><AdvanceLifecycle entry={entry} /></td>
      {(canReview || canApprove) ? (
        <td className="px-5 py-4"><AdvanceAction canApprove={canApprove} canReview={canReview} entry={entry} /></td>
      ) : null}
    </tr>
  );
}

function AdvanceMobileCard({
  canApprove,
  canReview,
  entry,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
}) {
  const status = statusMetadata[entry.status];

  return (
    <article className="rounded-lg border border-hairline bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{entry.staffDisplayName}</h3>
          <p className="mt-1 text-sm text-ink-muted">{formatCurrency(entry.amountVnd)}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <MobileField label="Kỳ khấu trừ" value={formatMonth(entry.deductionPeriodMonth)} />
        <MobileField label="Lý do" value={entry.requestNote} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Theo dõi</dt>
          <dd className="mt-1 text-ink-muted"><AdvanceLifecycle entry={entry} /></dd>
        </div>
      </dl>

      {canReview || canApprove ? (
        <div className="mt-4 border-t border-hairline pt-4">
          <AdvanceAction
            canApprove={canApprove}
            canReview={canReview}
            entry={entry}
            isMobile
          />
        </div>
      ) : null}
    </article>
  );
}

function AdvanceAction({
  canApprove,
  canReview,
  entry,
  isMobile = false,
}: {
  canApprove: boolean;
  canReview: boolean;
  entry: SalaryAdvanceDashboardEntry;
  isMobile?: boolean;
}) {
  const triggerClassName = isMobile ? "min-h-11" : undefined;

  if (entry.status === "requested" && canReview) {
    return (
      <SalaryAdvanceDecisionDialog
        advance={entry}
        stage="review"
        triggerClassName={triggerClassName}
      />
    );
  }

  if (entry.status === "review" && canApprove) {
    return (
      <SalaryAdvanceDecisionDialog
        advance={entry}
        stage="approve"
        triggerClassName={triggerClassName}
      />
    );
  }

  return <span className="text-sm text-ink-subtle">Không có thao tác</span>;
}

function AdvanceLifecycle({ entry }: { entry: SalaryAdvanceDashboardEntry }) {
  if (entry.status === "review") {
    return <p>Đã đối soát {formatDateTime(entry.reviewedAt)}.</p>;
  }

  if (entry.status === "approved") {
    return <p>Đã duyệt {formatDateTime(entry.approvedAt)}.</p>;
  }

  if (entry.status === "deducted") {
    return <p>Đã khấu trừ {formatDateTime(entry.deductedAt)}.</p>;
  }

  if (entry.status === "rejected") {
    return <p>{entry.rejectionReason || "Yêu cầu đã bị từ chối."}</p>;
  }

  return <p>Chờ kế toán hoặc owner đối soát.</p>;
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
