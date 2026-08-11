import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { CreatePayrollDraftDialog } from "@/features/payroll/components/create-payroll-draft-dialog";
import { PayrollManualLineDialog } from "@/features/payroll/components/payroll-manual-line-dialog";
import { PayrollPeriodTransitionAction } from "@/features/payroll/components/payroll-period-transition-action";
import type {
  PayrollLineRead,
  PayrollPeriodRead,
  PayrollStatementRead,
} from "@/features/payroll/read-models";
import type { ReactNode } from "react";

interface PayrollPageProps {
  canApprove: boolean;
  canManage: boolean;
  canReconcile: boolean;
  periods: readonly PayrollPeriodRead[];
}

const periodStatusMetadata: Record<
  string,
  { label: string; tone: "info" | "neutral" | "success" | "warning" }
> = {
  approved: { label: "Đã duyệt & khóa", tone: "success" },
  draft: { label: "Nháp", tone: "info" },
  review: { label: "Chờ đối soát", tone: "warning" },
};

const lineTypeLabels: Record<string, string> = {
  advance_deduction: "Khấu trừ tạm ứng",
  commission: "Hoa hồng",
  grading_bonus: "Thưởng chấm bài",
  hourly_wage: "Lương theo giờ",
  kpi_bonus: "Thưởng KPI",
  manual_deduction: "Khấu trừ thủ công",
  manual_reward: "Thưởng thủ công",
  revenue_bonus: "Thưởng doanh thu",
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

function getPeriodStatus(status: string): {
  label: string;
  tone: "info" | "neutral" | "success" | "warning";
} {
  return periodStatusMetadata[status] ?? {
    label: `Trạng thái chưa hỗ trợ: ${status}`,
    tone: "neutral",
  };
}

function getLineTypeLabel(lineType: string): string {
  return lineTypeLabels[lineType] ?? `Loại khoản chưa hỗ trợ: ${lineType}`;
}

function getLineDirectionLabel(direction: string): string {
  if (direction === "earning") {
    return "Khoản cộng";
  }

  if (direction === "deduction") {
    return "Khoản trừ";
  }

  return `Chiều khoản chưa hỗ trợ: ${direction}`;
}

/** Payroll 1 presents the authoritative Payroll 0 period/detail snapshot. */
export function PayrollPage({
  canApprove,
  canManage,
  canReconcile,
  periods,
}: PayrollPageProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        actions={canManage ? <CreatePayrollDraftDialog /> : undefined}
        title="Bảng lương"
      >
        <p className="mt-1 max-w-3xl text-secondary text-text-muted">
          Kỳ lương, bảng lương nhân sự và các khoản đã được hệ thống ghi nhận.
        </p>
      </PageHeader>

      {periods.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-12 text-center">
          <h2 className="text-section-title text-text-strong">Chưa có bảng lương</h2>
          <p className="mx-auto mt-2 max-w-lg text-secondary leading-6 text-text-muted">
            Chưa có kỳ lương nào trong phạm vi dữ liệu của tài khoản hiện tại.
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
  period: PayrollPeriodRead;
}) {
  const status = getPeriodStatus(period.status);
  const canAddManualLine = canManage && period.status === "draft";

  return (
    <section
      aria-labelledby={`payroll-period-${period.id}`}
      className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base"
    >
      <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title text-text-strong" id={`payroll-period-${period.id}`}>
                {formatMonth(period.periodMonth)}
              </h2>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-1 text-secondary text-text-muted">
              Ngày trả lương: <span className="tabular-nums">{formatDate(period.payDate)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {period.status === "draft" && canReconcile ? (
              <PayrollPeriodTransitionAction
                payrollPeriodId={period.id}
                periodMonth={period.periodMonth}
                transition="review"
              />
            ) : null}
            {period.status === "review" && canApprove ? (
              <PayrollPeriodTransitionAction
                payrollPeriodId={period.id}
                periodMonth={period.periodMonth}
                transition="approve"
              />
            ) : null}
          </div>
        </div>
      </div>

      {period.statements.length === 0 ? (
        <div className="px-5 py-10 text-secondary text-text-muted">
          Chưa có bảng lương nhân sự trong kỳ này.
        </div>
      ) : (
        <PayrollStatements
          canAddManualLine={canAddManualLine}
          periodStatusLabel={status.label}
          statements={period.statements}
        />
      )}
    </section>
  );
}

function PayrollStatements({
  canAddManualLine,
  periodStatusLabel,
  statements,
}: {
  canAddManualLine: boolean;
  periodStatusLabel: string;
  statements: readonly PayrollStatementRead[];
}) {
  return (
    <div className="payroll-statement-work-area min-w-0">
      <DataTableFrame
        body={statements.map((statement) => (
          <PayrollStatementTableRow
            canAddManualLine={canAddManualLine}
            key={statement.id}
            statement={statement}
          />
        ))}
        caption="Danh sách bảng lương nhân sự"
        className="payroll-statement-table"
        header={
          <tr>
            <TableHeader>Nhân sự</TableHeader>
            <TableHeader className="text-right">Công</TableHeader>
            <TableHeader className="text-right">Giờ công</TableHeader>
            <TableHeader className="text-right">Khoản cộng</TableHeader>
            <TableHeader className="text-right">Khoản trừ</TableHeader>
            <TableHeader className="text-right">Tổng thanh toán</TableHeader>
            <TableHeader>Khoản chi tiết</TableHeader>
            {canAddManualLine ? <TableHeader>Thao tác</TableHeader> : null}
          </tr>
        }
        tableClassName="min-w-[980px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="payroll-statement-record-list p-4"
        label={`Danh sách bảng lương nhân sự · ${periodStatusLabel}`}
      >
        {statements.map((statement) => (
          <PayrollStatementRecord
            canAddManualLine={canAddManualLine}
            key={statement.id}
            statement={statement}
          />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function PayrollStatementTableRow({
  canAddManualLine,
  statement,
}: {
  canAddManualLine: boolean;
  statement: PayrollStatementRead;
}) {
  return (
    <tr className="align-top hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[180px]">
        <StaffIdentity statement={statement} />
      </TableCell>
      <TableCell className="w-[78px] text-right tabular-nums">
        {statement.workUnits} công
      </TableCell>
      <TableCell className="w-[92px] text-right tabular-nums">
        {statement.workHours} giờ
      </TableCell>
      <MoneyCell value={statement.totalEarningsVnd} />
      <MoneyCell value={statement.totalDeductionsVnd} />
      <MoneyCell emphasized value={statement.payableAmountVnd} />
      <TableCell className="w-[184px]">
        <PayrollLineDisclosure lines={statement.lines} />
      </TableCell>
      {canAddManualLine ? (
        <TableCell className="w-[154px]">
          <PayrollManualLineDialog
            payrollStatementId={statement.id}
            staffDisplayName={statement.staffDisplayName}
          />
        </TableCell>
      ) : null}
    </tr>
  );
}

function PayrollStatementRecord({
  canAddManualLine,
  statement,
}: {
  canAddManualLine: boolean;
  statement: PayrollStatementRead;
}) {
  return (
    <article
      className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-4">
        <StaffIdentity statement={statement} />
        <p className="shrink-0 text-right tabular-nums text-body font-semibold text-text-strong">
          {formatCurrency(statement.payableAmountVnd)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-secondary text-text-muted">
        <RecordAmount label="Khoản cộng" value={statement.totalEarningsVnd} />
        <RecordAmount label="Khoản trừ" value={statement.totalDeductionsVnd} />
        <RecordText label="Công" value={`${statement.workUnits} công`} />
        <RecordText label="Giờ công" value={`${statement.workHours} giờ`} />
      </dl>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <PayrollLineDisclosure lines={statement.lines} />
      </div>

      {canAddManualLine ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <PayrollManualLineDialog
            payrollStatementId={statement.id}
            staffDisplayName={statement.staffDisplayName}
          />
        </div>
      ) : null}
    </article>
  );
}

function StaffIdentity({ statement }: { statement: PayrollStatementRead }) {
  return (
    <div>
      <p className="font-semibold text-text-strong">{statement.staffDisplayName}</p>
      {statement.staffEmployeeCode ? (
        <p className="mt-0.5 font-mono text-caption font-semibold text-text-muted">
          {statement.staffEmployeeCode}
        </p>
      ) : null}
    </div>
  );
}

function PayrollLineDisclosure({ lines }: { lines: readonly PayrollLineRead[] }) {
  if (lines.length === 0) {
    return <p className="text-secondary text-text-muted">Chưa có khoản chi tiết.</p>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-control font-semibold text-action-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring">
        Xem {lines.length} khoản chi tiết
      </summary>
      <ul className="mt-3 grid gap-3 border-t border-border-subtle pt-3" aria-label="Khoản lương chi tiết">
        {lines.map((line) => <PayrollLineItem key={line.id} line={line} />)}
      </ul>
    </details>
  );
}

function PayrollLineItem({ line }: { line: PayrollLineRead }) {
  return (
    <li className="grid gap-1 text-secondary text-text-muted">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-text-default">{getLineTypeLabel(line.lineType)}</p>
        <p className="tabular-nums font-semibold text-text-strong">{formatCurrency(line.amountVnd)}</p>
      </div>
      <p>Chiều khoản: {getLineDirectionLabel(line.direction)}</p>
      {line.unitCount !== null ? <p>Số lượng: {line.unitCount}</p> : null}
      {line.unitRateVnd !== null ? <p>Đơn giá: {formatCurrency(line.unitRateVnd)}</p> : null}
      {line.note ? <p className="break-words">Ghi chú: {line.note}</p> : null}
    </li>
  );
}

function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className ?? ""}`}>{children}</th>;
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 ${className ?? ""}`}>{children}</td>;
}

function MoneyCell({ emphasized = false, value }: { emphasized?: boolean; value: number }) {
  return (
    <TableCell className={`w-[138px] text-right tabular-nums ${emphasized ? "font-semibold text-text-strong" : "text-text-default"}`}>
      {formatCurrency(value)}
    </TableCell>
  );
}

function RecordAmount({ label, value }: { label: string; value: number }) {
  return <RecordText label={label} value={formatCurrency(value)} />;
}

function RecordText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption font-semibold uppercase tracking-[0.04em]">{label}</dt>
      <dd className="mt-1 tabular-nums font-medium text-text-default">{value}</dd>
    </div>
  );
}
