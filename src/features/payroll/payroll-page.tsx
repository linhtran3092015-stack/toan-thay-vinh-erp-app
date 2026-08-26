import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { CreatePayrollDraftDialog } from "@/features/payroll/components/create-payroll-draft-dialog";
import { PayrollCorrectionDialog } from "@/features/payroll/components/payroll-correction-dialog";
import { PayrollCorrectionResolutionDialog } from "@/features/payroll/components/payroll-correction-resolution-dialog";
import { PayrollImportDecisionDialog } from "@/features/payroll/components/payroll-import-decision-dialog";
import { PayrollImportDialog } from "@/features/payroll/components/payroll-import-dialog";
import {
  ClosePayrollFeedbackAction,
  RecalculatePayrollDialog,
} from "@/features/payroll/components/payroll-feedback-actions";
import { PayrollManualLineDialog } from "@/features/payroll/components/payroll-manual-line-dialog";
import { PayrollPeriodTransitionAction } from "@/features/payroll/components/payroll-period-transition-action";
import type {
  PayrollLineRead,
  PayrollCalculationIssueRead,
  PayrollCorrectionRequestRead,
  PayrollImportBatchRead,
  PayrollPeriodRead,
  PayrollStatementRead,
} from "@/features/payroll/read-models";
import type { ReactNode } from "react";

interface PayrollPageProps {
  canApprove: boolean;
  canImport?: boolean;
  canManage: boolean;
  canReconcile: boolean;
  canResolveFeedback?: boolean;
  currentStaffId?: string;
  correctionRequests?: readonly PayrollCorrectionRequestRead[];
  importBatches?: readonly PayrollImportBatchRead[];
  issues?: readonly PayrollCalculationIssueRead[];
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
  admissions_revenue_tier_bonus: "Hoa hồng theo mức doanh thu",
  addon_product_sales_bonus: "Thưởng bán sản phẩm phụ",
  base_offline: "Lương công offline",
  base_online: "Lương công online (50%)",
  center_renewal_duty_bonus: "Thưởng quản lý và trực tin nhắn",
  commission: "Hoa hồng",
  daily_admin_reporting_bonus: "Thưởng nhập dòng tiền và báo cáo",
  grading_bonus: "Thưởng chấm bài",
  hourly_wage: "Lương theo giờ",
  kpi_bonus: "Thưởng KPI",
  manual_deduction: "Khấu trừ thủ công",
  manual_reward: "Thưởng thủ công",
  new_student_fixed_bonus: "Thưởng tuyển sinh theo nguồn",
  new_student_revenue_bonus: "Thưởng doanh thu tuyển mới",
  operations_grade_renewal_bonus: "Thưởng tái phí khối phụ trách",
  payroll_processing_bonus: "Thưởng tính lương nhân sự",
  piecework_offset: "Phần lương khoán chưa vượt cứng",
  record_excess_bonus: "Thưởng doanh thu vượt kỷ lục",
  revenue_bonus: "Thưởng doanh thu",
  staff_recruitment_care_bonus: "Thưởng tuyển dụng và chăm sóc nhân sự",
  student_coaching_bonus: "Thưởng coaching học sinh",
  teaching_allowance: "Phụ cấp trợ giảng",
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

function issueLabel(code: string): string {
  const labels: Record<string, string> = {
    missing_advance_statement: "Tạm ứng chưa có bảng lương để khấu trừ",
    missing_daily_rate: "Thiếu mức lương ngày",
    missing_grade: "Thiếu khối lớp",
    missing_grade_assignment: "Khối chưa có trợ lý vận hành phụ trách",
    missing_payroll_position: "Thiếu vị trí tính lương",
    missing_recruiter: "Đơn tuyển sinh chưa có người phụ trách",
    missing_source_mapping: "Nguồn tuyển sinh chưa được ánh xạ",
    unsupported_source: "Nguồn dữ liệu chưa được hỗ trợ",
  };
  return labels[code] ?? code;
}

function getPeriodStatus(status: string): {
  label: string;
  tone: "info" | "neutral" | "success" | "warning";
} {
  if (Object.hasOwn(periodStatusMetadata, status)) {
    return periodStatusMetadata[status];
  }

  return {
    label: `Trạng thái chưa hỗ trợ: ${status}`,
    tone: "neutral",
  };
}

function getLineTypeLabel(lineType: string): string {
  return Object.hasOwn(lineTypeLabels, lineType)
    ? lineTypeLabels[lineType]
    : `Loại khoản chưa hỗ trợ: ${lineType}`;
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
  canImport = false,
  canManage,
  canReconcile,
  canResolveFeedback = false,
  currentStaffId = "",
  correctionRequests = [],
  importBatches = [],
  issues = [],
  periods,
}: PayrollPageProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        actions={canManage || canImport ? <div className="flex flex-wrap gap-2">{canImport ? <PayrollImportDialog /> : null}{canManage ? <CreatePayrollDraftDialog /> : null}</div> : undefined}
        title="Bảng lương"
      >
        <p className="mt-1 max-w-3xl text-secondary text-text-muted">
          Kỳ lương, bảng lương nhân sự và các khoản đã được hệ thống ghi nhận.
        </p>
      </PageHeader>

      {canResolveFeedback && correctionRequests.some((request) => request.status === "pending") ? (
        <section aria-labelledby="payroll-correction-queue" className="rounded-lg border border-warning-border bg-warning-bg p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id="payroll-correction-queue">Yêu cầu điều chỉnh đang chờ</h2>
          <ul className="mt-3 grid gap-3">
            {correctionRequests.filter((request) => request.status === "pending").map((request) => (
              <li className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base p-3 sm:flex-row sm:items-start sm:justify-between" key={request.id}>
                <div><p className="font-semibold text-text-strong">{request.staffDisplayName}</p><p className="mt-1 text-secondary text-text-default">{request.requestMessage}</p><p className="mt-1 text-caption text-text-muted">{request.items.map((item) => item.itemLabel).join(" · ")}</p></div>
                <PayrollCorrectionResolutionDialog request={request} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(canManage || canReconcile || canApprove || canResolveFeedback || canImport) && issues.length > 0 ? (
        <section className="rounded-lg border border-warning-border bg-warning-bg p-4" aria-labelledby="payroll-data-issues">
          <h2 className="text-section-title text-text-strong" id="payroll-data-issues">Dữ liệu cần xử lý trước khi đối soát</h2>
          <ul className="mt-3 grid gap-2">
            {issues.map((issue) => (
              <li className="rounded-md border border-warning-border bg-surface-base px-3 py-2.5" key={issue.id}>
                <p className="font-semibold text-text-strong">{issueLabel(issue.issueCode)} · {formatMonth(issue.periodMonth)}</p>
                <p className="mt-1 text-caption text-text-muted">Phiên bản {issue.revision}{issue.staffId ? ` · Nhân sự ${issue.staffId}` : ""}{issue.sourceFactId ? ` · Dữ liệu ${issue.sourceFactId}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canImport && importBatches.some((batch) => batch.status === "pending_review") ? (
        <section aria-labelledby="payroll-import-queue" className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id="payroll-import-queue">Tệp Excel đang chờ duyệt</h2>
          <ul className="mt-3 grid gap-3">{importBatches.filter((batch) => batch.status === "pending_review").map((batch) => <li className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between" key={batch.id}><div><p className="font-semibold text-text-strong">{batch.fileName}</p><p className="mt-1 text-secondary text-text-muted">{batch.totalRows} dòng · {batch.validRows} hợp lệ · {batch.errorRows} lỗi · {batch.conflictRows} xung đột</p></div><PayrollImportDecisionDialog batch={batch} /></li>)}</ul>
        </section>
      ) : null}

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
            canResolveFeedback={canResolveFeedback}
            currentStaffId={currentStaffId}
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
  canResolveFeedback,
  currentStaffId,
  period,
}: {
  canApprove: boolean;
  canManage: boolean;
  canReconcile: boolean;
  canResolveFeedback: boolean;
  currentStaffId: string;
  period: PayrollPeriodRead;
}) {
  const status = getPeriodStatus(period.status);
  const canAddManualLine = canManage && period.status === "draft" && !period.feedbackClosedAt;

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
            <p className="mt-1 text-caption text-text-muted">
              Phiên bản tính #{period.currentRevision} · {period.feedbackClosedAt ? "Đã đóng phản hồi" : "Đang nhận phản hồi"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {period.status === "draft" && canManage ? <RecalculatePayrollDialog payrollPeriodId={period.id} /> : null}
            {period.status === "draft" && canResolveFeedback && !period.feedbackClosedAt ? <ClosePayrollFeedbackAction payrollPeriodId={period.id} /> : null}
            {period.status === "draft" && canReconcile && period.feedbackClosedAt ? (
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

      {period.blockingIssueCount > 0 || period.pendingCorrectionCount > 0 ? (
        <div className="border-b border-warning-border bg-warning-bg px-4 py-3 text-secondary text-text-default sm:px-5">
          {period.blockingIssueCount > 0 ? <span>{period.blockingIssueCount} lỗi dữ liệu đang chặn đối soát.</span> : null}
          {period.blockingIssueCount > 0 && period.pendingCorrectionCount > 0 ? " " : null}
          {period.pendingCorrectionCount > 0 ? <span>{period.pendingCorrectionCount} yêu cầu điều chỉnh đang chờ xử lý.</span> : null}
        </div>
      ) : null}

      {period.statements.length === 0 ? (
        <div className="px-5 py-10 text-secondary text-text-muted">
          Chưa có bảng lương nhân sự trong kỳ này.
        </div>
      ) : (
        <PayrollStatements
          canAddManualLine={canAddManualLine}
          currentStaffId={currentStaffId}
          feedbackOpen={period.status === "draft" && !period.feedbackClosedAt}
          periodStatusLabel={status.label}
          statements={period.statements}
        />
      )}
    </section>
  );
}

function PayrollStatements({
  canAddManualLine,
  currentStaffId,
  feedbackOpen,
  periodStatusLabel,
  statements,
}: {
  canAddManualLine: boolean;
  currentStaffId: string;
  feedbackOpen: boolean;
  periodStatusLabel: string;
  statements: readonly PayrollStatementRead[];
}) {
  return (
    <div className="payroll-statement-work-area min-w-0">
      <DataTableFrame
        body={statements.map((statement) => (
          <PayrollStatementTableRow
            canAddManualLine={canAddManualLine}
            canRequestCorrection={feedbackOpen && statement.staffId === currentStaffId}
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
            canRequestCorrection={feedbackOpen && statement.staffId === currentStaffId}
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
  canRequestCorrection,
  statement,
}: {
  canAddManualLine: boolean;
  canRequestCorrection: boolean;
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
        {formatWorkMinutes(statement.workMinutes)}
      </TableCell>
      <MoneyCell value={statement.totalEarningsVnd} />
      <MoneyCell value={statement.totalDeductionsVnd} />
      <MoneyCell emphasized value={statement.payableAmountVnd} />
      <TableCell className="w-[184px]">
        <PayrollLineDisclosure canRequestCorrection={canRequestCorrection} lines={statement.lines} payrollStatementId={statement.id} />
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
  canRequestCorrection,
  statement,
}: {
  canAddManualLine: boolean;
  canRequestCorrection: boolean;
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
        <RecordText label="Thời gian công" value={formatWorkMinutes(statement.workMinutes)} />
      </dl>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <PayrollLineDisclosure canRequestCorrection={canRequestCorrection} lines={statement.lines} payrollStatementId={statement.id} />
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

function PayrollLineDisclosure({
  canRequestCorrection,
  lines,
  payrollStatementId,
}: {
  canRequestCorrection: boolean;
  lines: readonly PayrollLineRead[];
  payrollStatementId: string;
}) {
  if (lines.length === 0) {
    return <p className="text-secondary text-text-muted">Chưa có khoản chi tiết.</p>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-control font-semibold text-action-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring">
        Xem {lines.length} khoản chi tiết
      </summary>
      <ul className="mt-3 grid gap-3 border-t border-border-subtle pt-3" aria-label="Khoản lương chi tiết">
        {lines.map((line) => <PayrollLineItem canRequestCorrection={canRequestCorrection} key={line.id} line={line} payrollStatementId={payrollStatementId} />)}
      </ul>
    </details>
  );
}

function PayrollLineItem({
  canRequestCorrection,
  line,
  payrollStatementId,
}: {
  canRequestCorrection: boolean;
  line: PayrollLineRead;
  payrollStatementId: string;
}) {
  const label = getLineTypeLabel(line.lineType);
  return (
    <li className="grid gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 text-secondary text-text-muted">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-text-default">{label}</p>
        <p className="tabular-nums font-semibold text-text-strong">{formatCurrency(line.amountVnd)}</p>
      </div>
      <p>Chiều khoản: {getLineDirectionLabel(line.direction)}</p>
      {line.workMinutes !== null ? <p>Thời gian: {formatWorkMinutes(line.workMinutes)}</p> : null}
      {line.quantity !== null ? <p>Số lượng: {new Intl.NumberFormat("vi-VN").format(line.quantity)}{line.unitLabel ? ` ${line.unitLabel}` : ""}</p> : null}
      {line.unitRateVnd !== null ? <p>Đơn giá: {formatCurrency(line.unitRateVnd)}</p> : null}
      {line.policyCode ? <p>Chính sách: <span className="font-mono text-caption">{line.policyCode}</span></p> : null}
      {line.note ? <p className="break-words">Ghi chú: {line.note}</p> : null}
      {Object.keys(line.formulaSnapshot).length > 0 ? <FormulaSummary formula={line.formulaSnapshot} /> : null}
      {canRequestCorrection ? <div><PayrollCorrectionDialog itemLabel={label} payrollLineItemId={line.id} payrollStatementId={payrollStatementId} /></div> : null}
    </li>
  );
}

function FormulaSummary({ formula }: { formula: Record<string, unknown> }) {
  const entries = Object.entries(formula).filter(([, value]) => typeof value === "number" || typeof value === "string");
  if (!entries.length) return null;
  return <details><summary className="cursor-pointer font-medium text-action-link">Xem dữ liệu công thức</summary><dl className="mt-2 grid gap-1">{entries.map(([key, value]) => <div className="flex justify-between gap-3" key={key}><dt className="break-all font-mono text-caption">{key}</dt><dd className="tabular-nums text-right text-text-default">{typeof value === "number" ? new Intl.NumberFormat("vi-VN").format(value) : String(value)}</dd></div>)}</dl></details>;
}

function formatWorkMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
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
