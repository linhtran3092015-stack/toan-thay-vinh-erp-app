import { Badge } from "@/components/ui/badge";
import { CreatePayrollDraftDialog } from "@/features/payroll/components/create-payroll-draft-dialog";
import { PayrollManualLineDialog } from "@/features/payroll/components/payroll-manual-line-dialog";
import { PayrollPeriodTransitionAction } from "@/features/payroll/components/payroll-period-transition-action";
import type {
  PayrollDashboardEntry,
  PayrollPeriodStatus,
} from "@/features/payroll/read-models";

interface PayrollPageProps {
  canApprove: boolean;
  canManage: boolean;
  canReconcile: boolean;
  entries: readonly PayrollDashboardEntry[];
}

interface PayrollPeriodGroup {
  id: string;
  month: string;
  payDate: string;
  status: PayrollPeriodStatus;
  statements: readonly PayrollDashboardEntry[];
}

const periodStatusMetadata: Record<
  PayrollPeriodStatus,
  { label: string; tone: "info" | "success" | "warning" }
> = {
  approved: { label: "Đã duyệt & khóa", tone: "success" },
  draft: { label: "Nháp", tone: "info" },
  review: { label: "Chờ duyệt", tone: "warning" },
};

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function groupByPayrollPeriod(
  entries: readonly PayrollDashboardEntry[],
): readonly PayrollPeriodGroup[] {
  const periods = new Map<string, PayrollPeriodGroup>();

  for (const entry of entries) {
    const period = periods.get(entry.payrollPeriodId);
    if (period) {
      periods.set(entry.payrollPeriodId, {
        ...period,
        statements: [...period.statements, entry],
      });
      continue;
    }

    periods.set(entry.payrollPeriodId, {
      id: entry.payrollPeriodId,
      month: entry.periodMonth,
      payDate: entry.payDate,
      statements: [entry],
      status: entry.periodStatus,
    });
  }

  return [...periods.values()];
}

export function PayrollPage({
  canApprove,
  canManage,
  canReconcile,
  entries,
}: PayrollPageProps) {
  const periods = groupByPayrollPeriod(entries);
  const payableTotal = entries.reduce(
    (total, entry) => total + entry.payableAmountVnd,
    0,
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-5 shadow-card md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Quản lý nhân sự
          </p>
          <h1 className="mt-1 text-page-title font-bold text-ink">Bảng lương</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            Kỳ lương theo tháng dương lịch, thanh toán vào ngày 28 của tháng sau. Mỗi công được quy đổi cố định 9 giờ.
          </p>
        </div>
        {canManage ? <CreatePayrollDraftDialog /> : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Tổng quan bảng lương">
        <SummaryCard label="Kỳ lương" value={periods.length} />
        <SummaryCard label="Bảng lương nhân sự" value={entries.length} />
        <SummaryCard label="Tổng thanh toán đang hiển thị" value={formatCurrency(payableTotal)} />
      </section>

      {periods.length === 0 ? (
        <section className="rounded-lg border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
          <h2 className="text-section font-semibold text-ink">Chưa có bảng lương</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
            Bảng lương sẽ xuất hiện sau khi lập cho một tháng đã kết thúc và có lượt chấm công hoàn tất với đơn giá giờ hiệu lực.
          </p>
        </section>
      ) : (
        periods.map((period) => (
          <PayrollPeriodSection
            canApprove={canApprove}
            canManage={canManage}
            canReconcile={canReconcile}
            key={period.id}
            period={period}
          />
        ))
      )}
    </div>
  );
}

function PayrollPeriodSection({
  canApprove,
  canManage,
  canReconcile,
  period,
}: {
  canApprove: boolean;
  canManage: boolean;
  canReconcile: boolean;
  period: PayrollPeriodGroup;
}) {
  const status = periodStatusMetadata[period.status];
  const canAddManualLine = canManage && period.status === "draft";
  const totalPayable = period.statements.reduce(
    (total, statement) => total + statement.payableAmountVnd,
    0,
  );

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
      <div className="flex flex-col gap-4 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-section font-semibold text-ink">
              {formatMonth(period.month)}
            </h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Ngày trả lương: {formatDate(period.payDate)} · {period.statements.length} nhân sự · Tổng thanh toán {formatCurrency(totalPayable)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {period.status === "draft" && canReconcile ? (
            <PayrollPeriodTransitionAction
              payrollPeriodId={period.id}
              transition="review"
            />
          ) : null}
          {period.status === "review" && canApprove ? (
            <PayrollPeriodTransitionAction
              payrollPeriodId={period.id}
              transition="approve"
            />
          ) : null}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Nhân sự</th>
              <th className="px-5 py-3 font-semibold">Công</th>
              <th className="px-5 py-3 font-semibold">Giờ công</th>
              <th className="px-5 py-3 font-semibold">Khoản cộng</th>
              <th className="px-5 py-3 font-semibold">Khoản trừ</th>
              <th className="px-5 py-3 font-semibold">Tổng thanh toán</th>
              {canAddManualLine ? <th className="px-5 py-3 font-semibold">Thao tác</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {period.statements.map((statement) => (
              <PayrollStatementRow
                canAddManualLine={canAddManualLine}
                key={statement.payrollStatementId}
                statement={statement}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {period.statements.map((statement) => (
          <PayrollStatementCard
            canAddManualLine={canAddManualLine}
            key={statement.payrollStatementId}
            statement={statement}
          />
        ))}
      </div>
    </section>
  );
}

function PayrollStatementRow({
  canAddManualLine,
  statement,
}: {
  canAddManualLine: boolean;
  statement: PayrollDashboardEntry;
}) {
  return (
    <tr className="align-top hover:bg-canvas/70">
      <td className="px-5 py-4">
        <p className="font-medium text-ink">{statement.staffDisplayName}</p>
        {statement.staffEmployeeCode ? (
          <p className="mt-1 font-mono text-xs font-semibold text-ink-subtle">
            {statement.staffEmployeeCode}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4 font-medium text-ink">{statement.workUnits}</td>
      <td className="px-5 py-4 text-ink-muted">{statement.workHours} giờ</td>
      <td className="px-5 py-4 font-medium text-success">{formatCurrency(statement.totalEarningsVnd)}</td>
      <td className="px-5 py-4 font-medium text-danger">{formatCurrency(statement.totalDeductionsVnd)}</td>
      <td className="px-5 py-4 font-semibold text-ink">{formatCurrency(statement.payableAmountVnd)}</td>
      {canAddManualLine ? (
        <td className="px-5 py-4">
          <PayrollManualLineDialog
            payrollStatementId={statement.payrollStatementId}
            staffDisplayName={statement.staffDisplayName}
          />
        </td>
      ) : null}
    </tr>
  );
}

function PayrollStatementCard({
  canAddManualLine,
  statement,
}: {
  canAddManualLine: boolean;
  statement: PayrollDashboardEntry;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{statement.staffDisplayName}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {statement.workUnits} công · {statement.workHours} giờ
          </p>
        </div>
        <p className="text-right text-sm font-semibold text-ink">
          {formatCurrency(statement.payableAmountVnd)}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <PayrollAmount label="Khoản cộng" tone="success" value={formatCurrency(statement.totalEarningsVnd)} />
        <PayrollAmount label="Khoản trừ" tone="danger" value={formatCurrency(statement.totalDeductionsVnd)} />
      </dl>
      {canAddManualLine ? (
        <div className="mt-4 border-t border-hairline pt-4">
          <PayrollManualLineDialog
            payrollStatementId={statement.payrollStatementId}
            staffDisplayName={statement.staffDisplayName}
          />
        </div>
      ) : null}
    </article>
  );
}

function PayrollAmount({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "success";
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </dt>
      <dd className={`mt-1 font-medium ${tone === "success" ? "text-success" : "text-danger"}`}>
        {value}
      </dd>
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
