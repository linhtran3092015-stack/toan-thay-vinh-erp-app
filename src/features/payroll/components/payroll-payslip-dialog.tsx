/* Hallmark · genre: operational utility · macrostructure: Workbench payslip · design-system: DESIGN.md · designed-as-app
 * pre-emit critique: P5 H5 E4 S5 R5 V4 · contrast: pass (40–41) · slop: pass (42–49) · mobile: pass (34, 49–57)
 */
"use client";

import { ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PayrollCorrectionDialog } from "@/features/payroll/components/payroll-correction-dialog";
import { PayrollManualLineDialog } from "@/features/payroll/components/payroll-manual-line-dialog";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonth,
  formatWorkMinutes,
  getEvidenceDetails,
  getEvidenceUrl,
  getLineFormulaSummary,
  getLineInputSummary,
  getLineRateSummary,
  getLineTypeLabel,
  getSourceKindLabel,
} from "@/features/payroll/payroll-presentation";
import type { PayrollLineRead, PayrollStatementRead } from "@/features/payroll/read-models";

import { attendanceLineTypes, groupPayrollLines } from "@/features/payroll/payroll-line-groups";

type BadgeTone = "info" | "neutral" | "success" | "warning";
type LineGroupKey = "attendance" | "grading" | "earnings" | "deductions";

const groupMetadata: readonly {
  description: string;
  key: LineGroupKey;
  title: string;
}[] = [
  {
    description: "Công, giờ làm và mức lương cơ bản theo dữ liệu chấm công.",
    key: "attendance",
    title: "Công & giờ làm",
  },
  {
    description: "Số phiếu chấm và cách phân bổ quỹ hoặc đơn giá chấm bài.",
    key: "grading",
    title: "Chấm bài",
  },
  {
    description: "Phụ cấp, thưởng, hoa hồng và các khoản cộng khác.",
    key: "earnings",
    title: "Phụ cấp, thưởng & hoa hồng",
  },
  {
    description: "Tạm ứng, bù trừ và các khoản khấu trừ trong kỳ.",
    key: "deductions",
    title: "Tạm ứng & khấu trừ",
  },
];


function getLineGroup(line: PayrollLineRead): LineGroupKey {
  if (line.direction === "deduction") return "deductions";
  if (line.lineType === "grading_bonus") return "grading";
  if (attendanceLineTypes.has(line.lineType)) return "attendance";
  return "earnings";
}

export function PayrollPayslipDialog({
  canAddManualLine,
  canRequestCorrection,
  currentRevision,
  lastCalculatedAt,
  payDate,
  periodMonth,
  periodStatusLabel,
  periodStatusTone,
  statement,
}: {
  canAddManualLine: boolean;
  canRequestCorrection: boolean;
  currentRevision: number;
  lastCalculatedAt: string | null;
  payDate: string;
  periodMonth: string;
  periodStatusLabel: string;
  periodStatusTone: BadgeTone;
  statement: PayrollStatementRead;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button className="whitespace-nowrap active:bg-interactive-pressed" onClick={() => setIsOpen(true)} ref={triggerRef} size="sm" type="button" variant="outline">
        <FileText aria-hidden="true" size={16} strokeWidth={1.8} />
        Xem chi tiết
      </Button>

      <Dialog
        ariaDescribedBy={descriptionId}
        ariaLabelledBy={titleId}
        className="h-[96vh] max-w-[1400px] sm:h-auto"
        initialFocusRef={closeRef}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        returnFocusRef={triggerRef}
      >
        <div className="border-b border-border-subtle bg-surface-base px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-section-title text-text-strong" id={titleId}>
                  Phiếu lương · {statement.staffDisplayName}
                </h2>
                <Badge tone={periodStatusTone}>{periodStatusLabel}</Badge>
              </div>
              <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
                {formatMonth(periodMonth)} · Ngày trả lương {formatDate(payDate)}
                {statement.staffEmployeeCode ? ` · ${statement.staffEmployeeCode}` : ""}
              </p>
            </div>
            <Button aria-label="Đóng phiếu lương" className="shrink-0 px-2 active:bg-interactive-pressed" onClick={() => setIsOpen(false)} ref={closeRef} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" size={20} strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5">
          <section aria-label="Thông tin phiên tính" className="grid gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4 sm:grid-cols-2 lg:grid-cols-4">
            <PayslipFact label="Kỳ lương" value={formatMonth(periodMonth)} />
            <PayslipFact label="Ngày trả lương" value={formatDate(payDate)} />
            <PayslipFact label="Phiên bản tính" value={`#${currentRevision}`} />
            <PayslipFact label="Tính lại gần nhất" value={lastCalculatedAt ? formatDateTime(lastCalculatedAt) : "Chưa có thời điểm ghi nhận"} />
          </section>

          <section aria-label="Tóm tắt thu nhập" className="grid overflow-hidden rounded-lg border border-border-subtle bg-surface-base sm:grid-cols-3">
            <SummaryAmount label="Tổng thu nhập" value={statement.totalEarningsVnd} />
            <SummaryAmount deduction label="Bù trừ & khấu trừ" value={statement.totalDeductionsVnd} />
            <SummaryAmount emphasized label="Thực nhận" value={statement.payableAmountVnd} />
          </section>

          <div className="grid gap-5">
            {groupMetadata.map((group) => {
              const lines = statement.lines.filter((line) => getLineGroup(line) === group.key);
              return (
                <PayslipGroup
                  canRequestCorrection={canRequestCorrection}
                  description={group.key === "attendance" ? `${formatWorkMinutes(statement.workMinutes)} trong kỳ · Mở từng khoản để xem công theo ngày.` : group.description}
                  key={group.key}
                  lines={lines}
                  payrollStatementId={statement.id}
                  title={group.title}
                />
              );
            })}
          </div>

          <section aria-labelledby={`${titleId}-summary`} className="overflow-hidden rounded-lg border border-border-strong bg-surface-base">
            <div className="border-b border-border-subtle bg-surface-sunken px-4 py-3">
              <h3 className="font-semibold text-text-strong" id={`${titleId}-summary`}>Tổng kết</h3>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-label font-semibold text-text-default">Cách tính tổng thực nhận</p>
                <p className="mt-1 text-secondary text-text-muted">Tổng thu nhập − Bù trừ & khấu trừ = Thực nhận</p>
                <p className="mt-2 tabular-nums text-body font-semibold text-text-strong">
                  {formatCurrency(statement.totalEarningsVnd)} − {formatCurrency(statement.totalDeductionsVnd)} = {formatCurrency(statement.payableAmountVnd)}
                </p>
                <p className="mt-2 text-caption text-text-muted">
                  Tổng thời gian ghi nhận: {formatWorkMinutes(statement.workMinutes)} · {statement.workUnits} công
                </p>
              </div>
              <div className="border-t border-border-subtle pt-4 text-left lg:min-w-[260px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
                <p className="text-label font-semibold text-text-muted">Tổng thực nhận</p>
                <p className="mt-1 tabular-nums text-numeric font-bold text-success">{formatCurrency(statement.payableAmountVnd)}</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end"><a className="inline-flex items-center gap-2 rounded-lg bg-action-primary px-4 py-2 text-sm font-semibold text-white hover:bg-action-primary-hover" href={`/payroll/${statement.payrollPeriodId}/statements/${statement.id}/payslip`}><ExternalLink size={16} aria-hidden="true" />Mở phiếu lương</a></div>

          {canAddManualLine || canRequestCorrection ? (
            <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
              {canRequestCorrection ? (
                <PayrollCorrectionDialog
                  itemLabel="Toàn bộ bảng lương"
                  payrollLineItemId={null}
                  payrollStatementId={statement.id}
                  triggerLabel="Yêu cầu điều chỉnh"
                />
              ) : null}
              {canAddManualLine ? (
                <PayrollManualLineDialog payrollStatementId={statement.id} staffDisplayName={statement.staffDisplayName} />
              ) : null}
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

function PayslipGroup({
  canRequestCorrection,
  description,
  lines,
  payrollStatementId,
  title,
}: {
  canRequestCorrection: boolean;
  description: string;
  lines: readonly PayrollLineRead[];
  payrollStatementId: string;
  title: string;
}) {
  const groups = groupPayrollLines(lines);
  const total = lines.reduce((sum, line) => sum + line.amountVnd, 0);
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle bg-surface-raised px-4 py-4">
        <div><h3 className="font-semibold text-text-strong">{title}</h3><p className="mt-1 text-caption text-text-muted">{description}</p></div>
        <span aria-label={`Tổng ${title}`} className="shrink-0 text-base font-bold tabular-nums text-text-strong sm:text-lg">{formatCurrency(total)}</span>
      </div>
      {groups.length === 0 ? <p className="px-4 py-4 text-secondary text-text-muted">Không phát sinh hạng mục trong nhóm này.</p> : groups.map((group) => (
        <details key={group.key} className="group/line border-b border-border-subtle last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-strong">{getLineTypeLabel(group.lineType)}</p>
              <p className="mt-1 text-caption text-text-muted">{attendanceLineTypes.has(group.lineType)
                ? `${formatWorkMinutes(group.lines.reduce((sum, line) => sum + (line.workMinutes ?? 0), 0))} trong kỳ · ${group.lines.length} phát sinh`
                : `${group.lines.length} phát sinh · Xem căn cứ tính`}</p>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums ${group.direction === "deduction" ? "text-danger" : "text-text-strong"}`}>{group.direction === "deduction" ? "−" : ""}{formatCurrency(group.amountVnd)}</span>
            <ChevronRight aria-hidden="true" className="shrink-0 text-text-muted transition-transform group-open/line:rotate-90" size={18} />
          </summary>
          <ul aria-label={`Chi tiết ${getLineTypeLabel(group.lineType)}`} className="border-t border-border-subtle bg-surface-raised">
            {group.lines.map((line) => <PayslipLine key={line.id} line={line} canRequestCorrection={canRequestCorrection} payrollStatementId={payrollStatementId} />)}
          </ul>
        </details>
      ))}
      {lines.some((line) => line.lineType === "piecework_offset") ? <p className="border-t border-border-subtle px-4 py-3 text-caption text-text-muted">Bù trừ lương khoán theo chính sách của kỳ. Khoản thưởng chỉ làm tăng thực nhận khi vượt ngưỡng bù trừ.</p> : null}
    </section>
  );
}

function PayslipLine({
  canRequestCorrection,
  line,
  payrollStatementId,
}: {
  canRequestCorrection: boolean;
  line: PayrollLineRead;
  payrollStatementId: string;
}) {
  const evidenceDetails = getEvidenceDetails(line);
  const evidenceUrl = getEvidenceUrl(line);
  const label = getLineTypeLabel(line.lineType);

  return (
    <li className="grid gap-3 border-b border-border-subtle px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(160px,1.1fr)_minmax(150px,1fr)_minmax(240px,1.7fr)_minmax(120px,.8fr)_minmax(128px,.8fr)_minmax(170px,1fr)]">
      <LineCell label="Hạng mục">
        <p className="font-semibold text-text-strong">{label}</p>
        {line.note ? <p className="mt-1 text-caption text-text-muted">{line.note}</p> : null}
        
      </LineCell>
      <LineCell label="Dữ liệu đầu vào">
        <p className="tabular-nums text-text-default">{getLineInputSummary(line)}</p>
      </LineCell>
      <LineCell label="Công thức tính">
        <p className="tabular-nums font-medium text-text-default">{getLineFormulaSummary(line)}</p>
      </LineCell>
      <LineCell label="Đơn giá / tỷ lệ">
        <p className="tabular-nums text-text-default">{getLineRateSummary(line)}</p>
      </LineCell>
      <LineCell className="lg:text-right" label="Thành tiền">
        <p className={`tabular-nums font-semibold ${line.direction === "deduction" ? "text-danger" : "text-text-strong"}`}>
          {line.direction === "deduction" ? "−" : "+"}{formatCurrency(line.amountVnd)}
        </p>
      </LineCell>
      <LineCell label="Nguồn & trạng thái">
        <Badge tone="success">Đã ghi nhận</Badge>
        <p className="mt-2 text-caption text-text-muted">{getSourceKindLabel(line.sourceKind)}</p>
        {evidenceDetails.length > 0 ? (
          <dl className="mt-2 grid gap-1 text-caption text-text-muted">
            {evidenceDetails.map((detail) => (
              <div key={detail.label}>
                <dt className="inline font-medium text-text-default">{detail.label}: </dt>
                <dd className="inline break-words tabular-nums">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {evidenceUrl ? (
          <a className="mt-2 inline-flex items-center gap-1 whitespace-nowrap text-caption font-semibold text-action-link hover:underline active:text-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={evidenceUrl} rel="noreferrer" target="_blank">
            Mở bằng chứng <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        ) : null}
        {canRequestCorrection ? (
          <div className="mt-2">
            <PayrollCorrectionDialog itemLabel={label} payrollLineItemId={line.id} payrollStatementId={payrollStatementId} />
          </div>
        ) : null}
      </LineCell>
    </li>
  );
}

function LineCell({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-caption font-semibold text-text-muted lg:hidden">{label}</p>
      {children}
    </div>
  );
}

function PayslipFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption font-semibold text-text-muted">{label}</p>
      <p className="mt-1 tabular-nums text-body font-semibold text-text-strong">{value}</p>
    </div>
  );
}

function SummaryAmount({ deduction = false, emphasized = false, label, value }: { deduction?: boolean; emphasized?: boolean; label: string; value: number }) {
  return (
    <div className={`border-b border-border-subtle p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${emphasized ? "bg-success-bg" : ""}`}>
      <p className={`text-label font-semibold ${emphasized ? "text-success" : "text-text-muted"}`}>{label}</p>
      <p className={`mt-1 tabular-nums text-section-title font-bold ${deduction ? "text-danger" : emphasized ? "text-success" : "text-text-strong"}`}>
        {deduction && value > 0 ? "−" : ""}{formatCurrency(value)}
      </p>
    </div>
  );
}
