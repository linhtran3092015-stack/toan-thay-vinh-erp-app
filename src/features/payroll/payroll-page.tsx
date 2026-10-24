import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { CreatePayrollDraftDialog } from "@/features/payroll/components/create-payroll-draft-dialog";
import { PayrollCorrectionResolutionDialog } from "@/features/payroll/components/payroll-correction-resolution-dialog";
import { PayrollImportDecisionDialog } from "@/features/payroll/components/payroll-import-decision-dialog";
import { PayrollImportDialog } from "@/features/payroll/components/payroll-import-dialog";
import {
  ClosePayrollFeedbackAction,
  RecalculatePayrollDialog,
  ResetPayrollDraftDialog,
} from "@/features/payroll/components/payroll-feedback-actions";
import { PayrollPayslipDialog } from "@/features/payroll/components/payroll-payslip-dialog";
import { PayrollPeriodTransitionAction } from "@/features/payroll/components/payroll-period-transition-action";
import { MarkPayrollPaidDialog } from "@/features/payroll/components/mark-payroll-paid-dialog";
import { ReopenPayrollPeriodAction } from "@/features/payroll/components/reopen-payroll-period-action";
import { ReopenPayrollToDraftAction } from "@/features/payroll/components/reopen-payroll-to-draft-action";


import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonth,
  formatWorkMinutes,
} from "@/features/payroll/payroll-presentation";
import { getPayslipDisplayTotals } from "@/features/payroll/payslip-sections";
import type {
  PayrollCalculationIssueRead,
  PayrollCorrectionRequestRead,
  PayrollImportBatchRead,
  PayrollPeriodRead,
  PayrollStatementRead,
} from "@/features/payroll/read-models";
import { Receipt } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { StaffPayrollEstimate } from "@/features/payroll/estimate/types";
import { StaffLiveEstimateCard } from "@/features/payroll/estimate/components/staff-live-estimate-card";

interface PayrollPageProps {
  canApprove: boolean;
  canImport?: boolean;
  canManage: boolean;
  canReconcile: boolean;
  canResolveFeedback?: boolean;
  currentMonth?: string;
  currentStaffId?: string;
  correctionRequests?: readonly PayrollCorrectionRequestRead[];
  importBatches?: readonly PayrollImportBatchRead[];
  initialEstimate?: StaffPayrollEstimate | null;
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

function formatIssueContext(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;
  const parts: string[] = [];
  if (typeof details.grade === "number") {
    parts.push(`Khối ${details.grade}`);
  }
  if (typeof details.event_date === "string") {
    parts.push(`Ngày ${details.event_date}`);
  }
  if (typeof details.source_code === "string") {
    parts.push(`Nguồn: ${details.source_code}`);
  }
  if (typeof details.amount_vnd === "number") {
    parts.push(formatCurrency(details.amount_vnd));
  }
  if (typeof details.source_key === "string") {
    parts.push(`Mã đơn: ${details.source_key}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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

/** Payroll 1 presents the authoritative Payroll 0 period/detail snapshot. */
export function PayrollPage({
  canApprove,
  canImport = false,
  canManage,
  canReconcile,
  canResolveFeedback = false,
  currentMonth,
  currentStaffId = "",
  correctionRequests = [],
  importBatches = [],
  initialEstimate,
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-section-title text-text-strong" id="payroll-data-issues">Dữ liệu cần xử lý trước khi đối soát</h2>
            <p className="text-caption text-text-muted">
              Sau khi cập nhật cấu hình hoặc xử lý dữ liệu, bấm <strong>Tính lại</strong> tại kỳ lương để làm mới danh sách lỗi.
            </p>
          </div>
          <ul className="mt-3 grid gap-2">
            {issues.map((issue) => {
              const contextStr = formatIssueContext(issue.details as Record<string, unknown> | undefined);
              const staffLabel = issue.staffDisplayName || (issue.staffEmployeeCode ? `Mã NV: ${issue.staffEmployeeCode}` : (issue.staffId ? `Nhân sự ${issue.staffId}` : null));
              return (
                <li className="flex flex-col gap-2 rounded-md border border-warning-border bg-surface-base px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" key={issue.id}>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-strong">{issueLabel(issue.issueCode)} · {formatMonth(issue.periodMonth)}</p>
                    {contextStr ? <p className="mt-0.5 text-secondary text-text-default">{contextStr}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
                      <span>Phiên bản {issue.revision}</span>
                      {staffLabel ? (
                        <>
                          <span>·</span>
                          {issue.staffId ? (
                            <Link
                              className="font-medium text-action-link hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                              href={`/staff/${issue.staffId}`}
                            >
                              {issue.staffDisplayName ? `${issue.staffDisplayName}${issue.staffEmployeeCode ? ` (${issue.staffEmployeeCode})` : ""}` : staffLabel}
                            </Link>
                          ) : (
                            <span>{staffLabel}</span>
                          )}
                        </>
                      ) : null}
                      {issue.sourceFactId ? <span>· Dữ liệu {issue.sourceFactId}</span> : null}
                    </div>
                  </div>
                  {issue.staffId ? (
                    <Link
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-2.5 py-1 text-caption font-semibold text-text-strong hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
                      href={`/staff/${issue.staffId}`}
                    >
                      Mở hồ sơ nhân sự
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canImport && importBatches.some((batch) => batch.status === "pending_review") ? (
        <section aria-labelledby="payroll-import-queue" className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
          <h2 className="text-section-title text-text-strong" id="payroll-import-queue">Tệp Excel đang chờ duyệt</h2>
          <ul className="mt-3 grid gap-3">{importBatches.filter((batch) => batch.status === "pending_review").map((batch) => <li className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between" key={batch.id}><div><p className="font-semibold text-text-strong">{batch.fileName}</p><p className="mt-1 text-secondary text-text-muted">{batch.totalRows} dòng · {batch.validRows} hợp lệ · {batch.errorRows} lỗi · {batch.conflictRows} xung đột</p></div><PayrollImportDecisionDialog batch={batch} /></li>)}</ul>
        </section>
      ) : null}

      {/* Thẻ lương tạm tính tháng hiện tại */}
      <StaffLiveEstimateCard
        initialEstimate={initialEstimate}
        month={currentMonth ?? "2026-09-01"}
      />

      <div className="mt-2 border-t border-border-subtle pt-6">
        <h2 className="mb-4 text-section-title font-bold text-text-strong">
          Lịch sử bảng lương
        </h2>

        {periods.length === 0 ? (
          <section className="rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-10 text-center">
            <h3 className="text-secondary font-semibold text-text-strong">Chưa có bảng lương lịch sử</h3>
            <p className="mx-auto mt-2 max-w-lg text-secondary leading-6 text-text-muted">
              Chưa có kỳ lương chính thức nào được chốt trong phạm vi dữ liệu của tài khoản hiện tại.
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
  const isPaid = Boolean(period.paidAt);
  const status = isPaid ? { label: "Đã trả lương", tone: "success" as const } : getPeriodStatus(period.status);
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
              {isPaid && period.paidOn ? (
                <> · Đã trả ngày <span className="tabular-nums">{formatDate(period.paidOn)}</span>{period.paymentReference ? ` · Tham chiếu ${period.paymentReference}` : ""}</>
              ) : null}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              Phiên bản tính #{period.currentRevision} · Tính lại gần nhất {period.lastCalculatedAt ? formatDateTime(period.lastCalculatedAt) : "chưa có thời điểm ghi nhận"} · {period.feedbackClosedAt ? "Đã đóng phản hồi" : "Đang nhận phản hồi"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {period.status === "draft" && canManage ? <RecalculatePayrollDialog payrollPeriodId={period.id} /> : null}
            {period.status === "draft" && canManage ? (
              <ResetPayrollDraftDialog
                currentRevision={period.currentRevision}
                payrollPeriodId={period.id}
                periodMonth={period.periodMonth}
              />
            ) : null}
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
            {period.status === "review" && canReconcile ? (
              <ReopenPayrollToDraftAction
                payrollPeriodId={period.id}
                periodMonth={period.periodMonth}
              />
            ) : null}
            {period.status === "approved" && !isPaid && (canApprove || canReconcile) ? (
              <MarkPayrollPaidDialog payrollPeriodId={period.id} periodMonth={period.periodMonth} />
            ) : null}
            {period.status === "approved" && !isPaid && canApprove ? (
              <ReopenPayrollPeriodAction
                payrollPeriodId={period.id}
                periodMonth={period.periodMonth}
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
          period={period}
          periodStatusTone={status.tone}
        />
      )}
    </section>
  );
}

function PayrollStatements({
  canAddManualLine,
  currentStaffId,
  feedbackOpen,
  period,
  periodStatusTone,
}: {
  canAddManualLine: boolean;
  currentStaffId: string;
  feedbackOpen: boolean;
  period: PayrollPeriodRead;
  periodStatusTone: "info" | "neutral" | "success" | "warning";
}) {
  const periodStatusLabel = getPeriodStatus(period.status).label;
  const statements = period.statements;
  return (
    <div className="payroll-statement-work-area min-w-0">
      <DataTableFrame
        body={statements.map((statement) => (
          <PayrollStatementTableRow
            canAddManualLine={canAddManualLine}
            canRequestCorrection={feedbackOpen && statement.staffId === currentStaffId}
            key={statement.id}
            period={period}
            periodStatusLabel={periodStatusLabel}
            periodStatusTone={periodStatusTone}
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
            <TableHeader className="text-right">Thu nhập</TableHeader>
            <TableHeader className="text-right">Khấu trừ</TableHeader>
            <TableHeader className="text-right">Thực nhận</TableHeader>
            <TableHeader className="w-[280px]">Thao tác</TableHeader>
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
            period={period}
            periodStatusLabel={periodStatusLabel}
            periodStatusTone={periodStatusTone}
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
  period,
  periodStatusLabel,
  periodStatusTone,
  statement,
}: {
  canAddManualLine: boolean;
  canRequestCorrection: boolean;
  period: PayrollPeriodRead;
  periodStatusLabel: string;
  periodStatusTone: "info" | "neutral" | "success" | "warning";
  statement: PayrollStatementRead;
}) {
  const totals = getPayslipDisplayTotals(statement);
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
      <MoneyCell value={totals.incomeVnd} />
      <MoneyCell value={totals.deductionsVnd} />
      <MoneyCell emphasized value={statement.payableAmountVnd} />
      <TableCell className="w-[280px]">
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border-subtle bg-surface-base px-2.5 py-1.5 text-xs font-semibold text-text-strong shadow-xs hover:bg-surface-raised active:bg-interactive-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            href={`/payroll/${period.id}/statements/${statement.id}/payslip`}
          >
            <Receipt aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>Phiếu lương</span>
          </Link>
          <PayrollPayslipDialog
            canAddManualLine={canAddManualLine}
            canRequestCorrection={canRequestCorrection}
            currentRevision={period.currentRevision}
            lastCalculatedAt={period.lastCalculatedAt}
            payDate={period.payDate}
            periodMonth={period.periodMonth}
            periodStatusLabel={periodStatusLabel}
            periodStatusTone={periodStatusTone}
            statement={statement}
          />
        </div>
      </TableCell>
    </tr>
  );
}

function PayrollStatementRecord({
  canAddManualLine,
  canRequestCorrection,
  period,
  periodStatusLabel,
  periodStatusTone,
  statement,
}: {
  canAddManualLine: boolean;
  canRequestCorrection: boolean;
  period: PayrollPeriodRead;
  periodStatusLabel: string;
  periodStatusTone: "info" | "neutral" | "success" | "warning";
  statement: PayrollStatementRead;
}) {
  const totals = getPayslipDisplayTotals(statement);
  return (
    <article
      className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-4">
        <StaffIdentity statement={statement} />
        <div className="shrink-0 text-right">
          <p className="text-caption font-semibold text-text-muted">Thực nhận</p>
          <p className="mt-0.5 tabular-nums text-body font-semibold text-success">{formatCurrency(statement.payableAmountVnd)}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-secondary text-text-muted">
        <RecordAmount label="Thu nhập" value={totals.incomeVnd} />
        <RecordAmount label="Khấu trừ" value={totals.deductionsVnd} />
        <RecordText label="Công" value={`${statement.workUnits} công`} />
        <RecordText label="Thời gian công" value={formatWorkMinutes(statement.workMinutes)} />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
        <Link
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border-subtle bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-strong shadow-xs hover:bg-surface-raised active:bg-interactive-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          href={`/payroll/${period.id}/statements/${statement.id}/payslip`}
        >
          <Receipt aria-hidden="true" size={14} strokeWidth={1.8} />
          <span>Phiếu lương</span>
        </Link>
        <PayrollPayslipDialog
          canAddManualLine={canAddManualLine}
          canRequestCorrection={canRequestCorrection}
          currentRevision={period.currentRevision}
          lastCalculatedAt={period.lastCalculatedAt}
          payDate={period.payDate}
          periodMonth={period.periodMonth}
          periodStatusLabel={periodStatusLabel}
          periodStatusTone={periodStatusTone}
          statement={statement}
        />
      </div>
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
