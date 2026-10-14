import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Circle, ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { CrmCaseNotesPanel } from "@/features/crm/components/crm-case-notes-panel";
import { CrmCaseStatusDialog } from "@/features/crm/components/crm-case-status-dialog";
import { CrmConversionChecklistDialog } from "@/features/crm/components/crm-conversion-checklist-dialog";
import { CrmLeadTransferDialog } from "@/features/crm/components/crm-lead-transfer-dialog";
import { CrmLifecycleRail } from "@/features/crm/components/crm-lifecycle-rail";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import { CrmTrialBookingDialog } from "@/features/crm/components/crm-trial-booking-dialog";
import { CrmTrialResultDialog } from "@/features/crm/components/crm-trial-result-dialog";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import {
  CRM_HIDDEN_PREVIOUS_SALE_OWNER_NAME,
  CRM_UNASSIGNED_SALE_LABEL,
  deriveCrmLifecycle,
  formatAssignmentMethod,
  formatCrmDate,
  formatCrmMode,
  getCrmDetailActions,
  getCrmTrialStatusMeta,
  summarizeCrmChecklist,
  type CrmChecklistSummary,
} from "@/features/crm/crm-presentation";
import type {
  CrmAssignmentHistoryReadModel,
  CrmCaseDetailReadModel,
  CrmTrialBookingReadModel,
  SaleOwnerOption,
} from "@/features/crm/read-models";
import { getInitials } from "@/features/students/detail/helpers";
import { formatWeekdayDate } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

export interface CrmDetailViewProps {
  /** Inert stubs in the /dev/crm preview; the real page passes nothing. */
  actions?: CrmActionOverrides;
  activeClasses: { code: string; id: string; name: string }[];
  canConfirmOfficial: boolean;
  canTransfer: boolean;
  canUpdate: boolean;
  detail: CrmCaseDetailReadModel;
  directoryHref: string;
  hasAccountantPermission: boolean;
  saleOwners: SaleOwnerOption[];
  todayIso: string;
}

/**
 * Lead detail (design 12b) from loader data: header with one primary chosen by
 * state, the read-only enrollment checklist, trials and notes on the left,
 * lifecycle, expected enrollment and assignment history on the right. Every
 * action keeps its existing dialog, permission and status gate.
 */
export function CrmDetailView({
  actions,
  activeClasses,
  canConfirmOfficial,
  canTransfer,
  canUpdate,
  detail,
  directoryHref,
  hasAccountantPermission,
  saleOwners,
  todayIso,
}: CrmDetailViewProps) {
  const available = getCrmDetailActions({
    canConfirmOfficial,
    canTransfer,
    canUpdate,
    dropReason: detail.dropReason,
    droppedAt: detail.droppedAt,
    hasAccountantPermission,
    status: detail.status,
  });
  const checklist = summarizeCrmChecklist(detail.checklist, { hasAccountantPermission });
  const lifecycle = deriveCrmLifecycle(detail);
  const metaParts = [
    detail.publicCode,
    `sinh ${detail.birthYear}`,
    `Khối ${detail.expectedGrade} dự kiến`,
    detail.expectedLevel,
    detail.expectedMode ? formatCrmMode(detail.expectedMode) : null,
    `Nguồn ${detail.leadSourceName}`,
    `Sale ${detail.saleOwnerId ? detail.saleOwnerName : CRM_UNASSIGNED_SALE_LABEL}`,
    `${detail.guardianRelationship} ${detail.guardianFullName}`.trim(),
    detail.guardianPhone,
    detail.provinceCity,
  ].filter((part): part is string => Boolean(part));
  const checklistCompletedAt = detail.checklist?.completedAt ?? null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <header className="grid gap-4">
        <nav aria-label="Điều hướng hồ sơ lead" className="text-secondary">
          <Link
            className="inline-flex items-center gap-1 font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={directoryHref}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            Lead tuyển sinh
          </Link>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-action-primary-soft text-[16px] font-bold text-action-primary"
            >
              {getInitials(detail.fullName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5" data-testid="crm-detail-title">
                <h1 className="text-page-title font-semibold tracking-[-0.01em] text-text-strong">{detail.fullName}</h1>
                <CrmStatusBadge status={detail.status} />
              </div>
              <p className="mt-1 text-secondary tabular-nums text-text-muted">{metaParts.join(" · ")}</p>
              {detail.nickname ? <p className="mt-0.5 text-secondary text-text-muted">Tên thường gọi: {detail.nickname}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-2 md:justify-end">
            {available.transfer ? (
              <CrmLeadTransferDialog
                action={actions?.transferLead}
                crmCaseId={detail.id}
                currentSaleOwnerId={detail.saleOwnerId}
                saleOwners={saleOwners}
              />
            ) : null}
            {detail.studentId ? (
              <Link className={getButtonClassName({ variant: "secondary" })} href={`/students/${detail.studentId}`}>
                {detail.status === "converted" ? "Xem hồ sơ học viên" : "Hồ sơ tạm & phiếu thu"}
                <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
              </Link>
            ) : null}
            {available.convert ? (
              <CrmConversionChecklistDialog
                action={actions?.convertStudent}
                checklist={detail.checklist}
                classes={activeClasses}
                crmCaseId={detail.id}
                hasAccountantPermission={hasAccountantPermission}
                triggerVariant={available.primary === "convert" ? "primary" : "secondary"}
              />
            ) : null}
            {available.advance ? (
              <CrmCaseStatusDialog
                action={actions?.changeCaseStatus}
                crmCaseId={detail.id}
                targetStatus="pending_enrollment_confirmation"
                triggerSize="md"
                triggerVariant={available.primary === "advance" ? "primary" : "secondary"}
              />
            ) : null}
          </div>
        </div>

        {available.primary === "convert" ? (
          <Notice tone="info">
            {`${checklist.total} mục checklist được xác nhận cùng lúc trong hộp thoại “Xác nhận chuyển đổi”. `}
            Xác nhận chuyển đổi tạo hồ sơ học sinh chính thức và chuyển lead sang “Đã nhập học”.
          </Notice>
        ) : null}
        {available.conversionReason ? <Notice tone="muted">{available.conversionReason}</Notice> : null}
        {detail.status === "pending_enrollment_confirmation" && detail.studentId ? (
          <p className="text-secondary text-text-muted">
            Hồ sơ học sinh tạm đã tạo: kế toán có thể lập phiếu thu tuyển mới từ trang Phiếu thu; tiền về sẽ tự khớp theo mã chuyển khoản.
          </p>
        ) : null}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <div className="grid min-w-0 content-start gap-5">
          <ChecklistPanel summary={checklist} completedAt={checklistCompletedAt} completedByName={detail.checklist?.completedByName ?? null} />
          <Panel
            action={available.bookTrial ? <CrmTrialBookingDialog action={actions?.bookTrial} crmCaseId={detail.id} /> : null}
            title="Học thử"
          >
            {detail.trialBookings.length === 0 ? (
              <p className="px-4 py-3 text-body text-text-muted">Chưa có lịch học thử nào được đặt.</p>
            ) : (
              <ul className="divide-y divide-border-row">
                {detail.trialBookings.map((booking) => (
                  <TrialBookingRow
                    action={actions?.recordTrialResult}
                    booking={booking}
                    canRecordResult={available.recordTrialResult && booking.status === "scheduled"}
                    crmCaseId={detail.id}
                    key={booking.id}
                  />
                ))}
              </ul>
            )}
          </Panel>
          <CrmCaseNotesPanel actions={actions} canUpdate={available.editNotes} crmCaseId={detail.id} notes={detail.caseNotes} todayIso={todayIso} />
        </div>

        <aside aria-label="Tóm tắt lead" className="grid min-w-0 content-start gap-5">
          <Panel title="Vòng đời">
            <div className="px-4 py-2">
              <CrmLifecycleRail steps={lifecycle} />
            </div>
            {available.drop || available.reopen ? (
              <div className="flex flex-wrap gap-2 px-4 pb-3 pt-1">
                {available.drop ? (
                  <CrmCaseStatusDialog
                    action={actions?.changeCaseStatus}
                    crmCaseId={detail.id}
                    targetStatus="dropped"
                    triggerLabel="Đánh dấu Đã dừng…"
                    triggerVariant="danger-outline"
                  />
                ) : null}
                {available.reopen ? (
                  <CrmCaseStatusDialog
                    action={actions?.changeCaseStatus}
                    crmCaseId={detail.id}
                    targetStatus="interested"
                    triggerVariant="secondary"
                  />
                ) : null}
              </div>
            ) : null}
          </Panel>

          <ExpectedEnrollmentPanel detail={detail} />

          <Panel title="Lịch sử phân công">
            {detail.assignmentHistory.length === 0 ? (
              <p className="px-4 py-3 text-secondary text-text-muted">Chưa có lịch sử phân công.</p>
            ) : (
              <ul className="divide-y divide-border-row">
                {detail.assignmentHistory.map((entry) => <AssignmentRow entry={entry} key={entry.id} />)}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ action, children, title }: { action?: ReactNode; children: ReactNode; title: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border-row px-4 py-2.5">
        <h2 className="text-body font-semibold text-text-strong">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: "info" | "muted" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-2.5 text-secondary",
        tone === "warning" && "border-warning-border bg-warning-bg text-warning-ink",
        tone === "info" && "border-info-border bg-info-bg text-info-ink",
        tone === "muted" && "border-border-subtle bg-surface-sunken text-text-default",
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 shrink-0" size={16} strokeWidth={1.8} />
      <p>{children}</p>
    </div>
  );
}

function ChecklistPanel({
  completedAt,
  completedByName,
  summary,
}: {
  completedAt: string | null;
  completedByName: string | null;
  summary: CrmChecklistSummary;
}) {
  const percent = Math.round((summary.done / summary.total) * 100);
  // The conversion RPC writes every checklist box at once, so an open lead has
  // no partial progress to show: until completedAt the items read "Chưa xác nhận".
  const isConfirmed = completedAt !== null;

  return (
    <section
      aria-labelledby="crm-checklist-title"
      className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-row px-4 py-2.5">
        <h2 className="text-body font-semibold text-text-strong" id="crm-checklist-title">Checklist nhập học</h2>
        {isConfirmed ? (
          <>
            <span className="text-secondary tabular-nums text-text-muted">{summary.done}/{summary.total} hoàn thành</span>
            <span aria-hidden="true" className="h-1.5 min-w-24 max-w-[200px] flex-1 overflow-hidden rounded-sm bg-border-row">
              <span className="block h-full bg-action-primary" style={{ width: `${percent}%` }} />
            </span>
          </>
        ) : (
          <span className="text-secondary text-text-muted">Xác nhận cùng lúc khi chuyển đổi</span>
        )}
      </div>
      {!summary.initialized ? (
        <p className="border-b border-border-row px-4 py-2.5 text-secondary text-text-muted">Chưa khởi tạo checklist cho lead này.</p>
      ) : null}
      <ol className="divide-y divide-border-row">
        {summary.items.map((item) => (
          <li className={cn("flex min-h-12 items-start gap-3 px-4 py-2.5", !item.done && item.hint ? "bg-warning-bg/40" : undefined)} key={item.key}>
            {item.done ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 shrink-0 text-success" size={16} strokeWidth={1.8} />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 shrink-0 text-text-subtle" size={16} strokeWidth={1.8} />
            )}
            <span className="min-w-0 flex-1 text-body text-text-default">
              {item.number}. {item.label}
              {item.hint ? <span className="block text-caption text-warning">{item.hint}</span> : null}
            </span>
            <span className={cn("shrink-0 text-caption", item.done ? "font-medium text-success" : "text-text-muted")}>
              {item.done ? "Đã xong" : isConfirmed ? "Chưa xong" : "Chưa xác nhận"}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-border-row px-4 py-2.5 text-caption text-text-muted">
        {completedAt
          ? `Hoàn tất ${formatCrmDate(completedAt)}${completedByName ? ` bởi ${completedByName}` : ""}.`
          : `Các mục được đánh dấu trong hộp thoại “Xác nhận chuyển đổi” (quyền ${permissionLabel("students.confirm_official")}).`}
      </p>
    </section>
  );
}

function TrialBookingRow({
  action,
  booking,
  canRecordResult,
  crmCaseId,
}: {
  action?: CrmActionOverrides["recordTrialResult"];
  booking: CrmTrialBookingReadModel;
  canRecordResult: boolean;
  crmCaseId: string;
}) {
  const status = getCrmTrialStatusMeta(booking.status);

  return (
    <li className="grid gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-start">
      <span className="text-body tabular-nums text-text-muted">{formatWeekdayDate(booking.trialDate, { year: false })}</span>
      <div className="min-w-0">
        <p className="text-body font-semibold text-text-strong">Học thử {formatCrmMode(booking.learningMode)}</p>
        {booking.teacherFeedback ? (
          <p className="mt-1 text-secondary text-text-default"><strong className="font-semibold">Phản hồi giáo viên:</strong> {booking.teacherFeedback}</p>
        ) : null}
        {booking.saleNotes ? <p className="mt-0.5 text-caption text-text-muted">Ghi chú sale: {booking.saleNotes}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Badge tone={status.tone}>{status.label}</Badge>
        {canRecordResult ? (
          <CrmTrialResultDialog action={action} bookingId={booking.id} crmCaseId={crmCaseId} trialDateLabel={formatCrmDate(booking.trialDate)} />
        ) : null}
      </div>
    </li>
  );
}

function ExpectedEnrollmentPanel({ detail }: { detail: CrmCaseDetailReadModel }) {
  const isOpen = detail.status !== "converted" && detail.status !== "dropped";
  const rows: { label: string; value: ReactNode }[] = [];
  if (detail.expectedTuitionFeeVnd !== null) {
    rows.push({ label: "Học phí", value: <span className="tabular-nums">{formatVnd(detail.expectedTuitionFeeVnd)}</span> });
  }
  if (detail.discountNotes) rows.push({ label: "Ưu đãi", value: detail.discountNotes });
  if (detail.expectedOfficialStartDate) {
    rows.push({ label: "Bắt đầu", value: <span className="tabular-nums">{formatCrmDate(detail.expectedOfficialStartDate)}</span> });
  } else if (isOpen) {
    rows.push({ label: "Bắt đầu", value: <span className="font-medium text-warning">Chưa nhập</span> });
  }
  if (detail.notes) rows.push({ label: "Nhu cầu", value: <span className="whitespace-pre-wrap">{detail.notes}</span> });

  if (rows.length === 0) return null;

  return (
    <Panel title="Dự kiến nhập học">
      <dl className="grid grid-cols-[112px_minmax(0,1fr)] px-4 py-1 text-secondary">
        {rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="py-[7px] text-text-muted">{row.label}</dt>
            <dd className="py-[7px] text-text-default">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function AssignmentRow({ entry }: { entry: CrmAssignmentHistoryReadModel }) {
  const meta = [
    formatCrmDate(entry.createdAt),
    entry.assignedByName ? `bởi ${entry.assignedByName}` : null,
    formatAssignmentMethod(entry.assignmentMethod),
  ].filter(Boolean).join(" · ");

  return (
    <li className="px-4 py-2.5 text-secondary">
      {/* The id tells a transfer from the first assignment: the previous
          owner's name can be hidden by profiles RLS (no staff.view). */}
      {entry.previousSaleOwnerId ? (
        <strong className="inline-flex flex-wrap items-center gap-1 font-semibold text-text-strong">
          {entry.previousSaleOwnerName ?? CRM_HIDDEN_PREVIOUS_SALE_OWNER_NAME}
          <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
          <span className="sr-only"> chuyển sang </span>
          {entry.newSaleOwnerName}
        </strong>
      ) : (
        <strong className="font-semibold text-text-strong">Gán ban đầu: {entry.newSaleOwnerName}</strong>
      )}
      <p className="tabular-nums text-text-muted">{meta}</p>
      {entry.reason ? <p className="text-text-default">Lý do: {entry.reason}</p> : null}
    </li>
  );
}
