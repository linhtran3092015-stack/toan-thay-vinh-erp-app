import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmCaseNotesPanel } from "@/features/crm/components/crm-case-notes-panel";
import { CrmCaseStatusDialog } from "@/features/crm/components/crm-case-status-dialog";
import { CrmConversionChecklistDialog } from "@/features/crm/components/crm-conversion-checklist-dialog";
import { CrmLeadTransferDialog } from "@/features/crm/components/crm-lead-transfer-dialog";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import { CrmTrialBookingDialog } from "@/features/crm/components/crm-trial-booking-dialog";
import { CrmTrialResultDialog } from "@/features/crm/components/crm-trial-result-dialog";
import { getCrmCaseDetail, getSaleOwners } from "@/features/crm/data";
import { getCrmDirectoryHref } from "@/features/crm/crm-directory-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CrmCaseDetailPageProps {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    grade?: string;
    sale?: string;
    search?: string;
    source?: string;
    status?: string;
  }>;
}

export default async function CrmCaseDetailPage({ params, searchParams }: CrmCaseDetailPageProps) {
  const { caseId } = await params;
  const returnParams = await searchParams;
  const directoryHref = getCrmDirectoryHref(new URLSearchParams(returnParams));
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập CRM."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("crm.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("crm.view")}
        title="Không có quyền xem chi tiết CRM case"
      />
    );
  }

  const canUpdate = permissionResult.permissions.includes("crm.update");
  const canTransfer = permissionResult.permissions.includes("crm.transfer");
  const canConfirmOfficial = permissionResult.permissions.includes("students.confirm_official");
  const hasAccountantPermission = permissionResult.permissions.includes("sepay.accountant_confirm");

  const [detail, saleOwners] = await Promise.all([
    getCrmCaseDetail(caseId),
    getSaleOwners(),
  ]);

  if (!detail) {
    return (
      <EmptyState
        description="Hồ sơ Lead không tồn tại hoặc đã bị xóa."
        title="Không tìm thấy CRM case"
      />
    );
  }

  // Fetch active classes for official conversion dropdown
  const supabase = await createSupabaseServerClient();
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");

  const activeClasses = (classRows ?? []).map((c) => ({
    code: c.code,
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-3">
        <Link className="inline-flex w-fit items-center gap-2 text-control font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={directoryHref}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} /> Quay lại CRM & Tuyển sinh
        </Link>
        <PageHeader
          actions={<div className="flex flex-wrap items-center gap-2">
            {canTransfer && detail.status !== "converted" ? (
              <CrmLeadTransferDialog
                crmCaseId={detail.id}
                currentSaleOwnerId={detail.saleOwnerId}
                saleOwners={saleOwners}
              />
            ) : null}

            {canUpdate && detail.status !== "converted" && detail.status !== "dropped" ? (
              <CrmTrialBookingDialog crmCaseId={detail.id} />
            ) : null}

            {canUpdate && (detail.status === "interested" || detail.status === "trial_booked" || detail.status === "trial_completed") ? (
              <CrmCaseStatusDialog crmCaseId={detail.id} targetStatus="pending_enrollment_confirmation" />
            ) : null}

            {canUpdate && detail.status === "dropped" ? (
              <CrmCaseStatusDialog crmCaseId={detail.id} targetStatus="interested" />
            ) : null}

            {canUpdate && detail.status !== "converted" && detail.status !== "dropped" ? (
              <CrmCaseStatusDialog crmCaseId={detail.id} targetStatus="dropped" />
            ) : null}

            {canConfirmOfficial && detail.status !== "converted" && detail.status !== "dropped" ? (
              <CrmConversionChecklistDialog
                checklist={detail.checklist}
                classes={activeClasses}
                crmCaseId={detail.id}
                hasAccountantPermission={hasAccountantPermission}
              />
            ) : null}

            {detail.studentId ? (
              <Link href={`/students/${detail.studentId}`}>
                <Button variant="outline">{detail.status === "converted" ? "Xem hồ sơ học viên" : "Hồ sơ tạm & phiếu thu"} <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} /></Button>
              </Link>
            ) : null}
          </div>}
          context={<CrmStatusBadge status={detail.status} />}
          title={detail.fullName}
        >
          {detail.status === "dropped" && detail.dropReason ? (
            <p className="mt-1 text-secondary text-danger">Đã dừng{detail.droppedAt ? ` ngày ${formatDate(detail.droppedAt)}` : ""}: {detail.dropReason}</p>
          ) : null}
          {detail.status === "pending_enrollment_confirmation" && detail.studentId ? (
            <p className="mt-1 text-secondary text-text-muted">Hồ sơ học sinh tạm đã tạo: kế toán có thể lập phiếu thu tuyển mới từ trang Phiếu thu; tiền về sẽ tự khớp theo mã chuyển khoản.</p>
          ) : null}
          <p className="mt-1 tabular-nums text-secondary text-text-muted">{detail.publicCode} · Khối {detail.expectedGrade}{detail.expectedLevel ? ` · Mức ${detail.expectedLevel}` : ""}{detail.expectedMode ? ` · ${formatMode(detail.expectedMode)}` : ""} · Sale: {detail.saleOwnerName ?? "Chưa phân công"}</p>
        </PageHeader>
      </div>

      {/* Main Grid Details */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin Lead & Phụ huynh</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoTile label="Họ và tên con" value={detail.fullName} />
              <InfoTile label="Năm sinh" value={String(detail.birthYear)} />
              <InfoTile label="Họ tên phụ huynh" value={detail.guardianFullName} />
              <InfoTile label="SĐT phụ huynh" value={detail.guardianPhone} />
              <InfoTile label="Mức học lực mong muốn" value={detail.expectedLevel ?? "Chưa xác định"} />
              <InfoTile label="Hình thức học mong muốn" value={detail.expectedMode ?? "Chưa xác định"} />
              <InfoTile label="Nguồn Lead" value={detail.leadSourceName} />
              <InfoTile label="Tỉnh / Thành phố" value={detail.provinceCity ?? "Chưa cập nhật"} />
              <InfoTile label="Ghi chú nhu cầu" value={detail.notes ?? "Chưa có ghi chú"} wide />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử Học thử (Trial Bookings)</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.trialBookings.length === 0 ? (
                <p className="text-body text-text-muted">Chưa có lịch học thử nào được đặt.</p>
              ) : (
                <div className="grid gap-3">
                  {detail.trialBookings.map((t) => (
                    <div className="rounded-md border border-border-subtle bg-surface-sunken p-3 text-body" key={t.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text-strong">Ngày thử: {formatDate(t.trialDate)}</span>
                        <div className="flex items-center gap-2">
                          <Badge tone={t.status === "attended" ? "success" : t.status === "scheduled" ? "info" : "neutral"}>{formatTrialStatus(t.status)}</Badge>
                          {canUpdate && t.status === "scheduled" && detail.status !== "converted" && detail.status !== "dropped" ? (
                            <CrmTrialResultDialog bookingId={t.id} crmCaseId={detail.id} trialDateLabel={formatDate(t.trialDate)} />
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 text-caption text-text-muted">Hình thức: {t.learningMode}</p>
                      {t.teacherFeedback ? <p className="mt-1 text-caption text-text-default">Nhận xét giáo viên: {t.teacherFeedback}</p> : null}
                      {t.saleNotes ? <p className="mt-1 text-caption text-text-default">Ghi chú sale: {t.saleNotes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <CrmCaseNotesPanel canUpdate={canUpdate && detail.status !== "converted"} crmCaseId={detail.id} notes={detail.caseNotes} todayIso={getVietnamToday()} />
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist Nhập học 10 bước</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs font-medium">
              {detail.checklist ? (
                <>
                  <ChecklistSummaryRow label="1. Đã nhận học phí" value={detail.checklist.item1PaymentReceived} />
                  <ChecklistSummaryRow label="2. Đã xác nhận nguồn lead" value={detail.checklist.item2SourceConfirmed} />
                  <ChecklistSummaryRow label="3. Đã xác nhận sale chốt" value={detail.checklist.item3SaleConfirmed} />
                  <ChecklistSummaryRow label="4. Đã chọn lớp chính" value={detail.checklist.item4ClassSelected} />
                  <ChecklistSummaryRow label="5. Đã xác nhận online/offline" value={detail.checklist.item5ModeConfirmed} />
                  <ChecklistSummaryRow label="6. Đã xác nhận học phí & ưu đãi" value={detail.checklist.item6FeeConfirmed} />
                  <ChecklistSummaryRow label="7. Trợ lý xác nhận số buổi" value={detail.checklist.item7AssistantSessionsConfirmed} />
                  <ChecklistSummaryRow label="8. Kế toán xác nhận giao dịch" value={detail.checklist.item8AccountantTransactionConfirmed} />
                  <ChecklistSummaryRow label="9. Đã nhập ngày học chính" value={detail.checklist.item9OfficialStartDateEntered} />
                  <ChecklistSummaryRow label="10. Sổ liên lạc / Zalo sẵn sàng" value={detail.checklist.item10CommunicationGroupReady} />
                </>
              ) : (
                <p className="text-body text-text-muted">Chưa khởi tạo checklist.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử phân công Lead</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.assignmentHistory.length === 0 ? (
                <p className="text-body text-text-muted">Chưa có lịch sử chuyển giao.</p>
              ) : (
                <div className="grid gap-3">
                  {detail.assignmentHistory.map((h) => (
                    <div className="rounded-md border border-border-subtle bg-surface-sunken p-3 text-caption" key={h.id}>
                      <div className="flex items-center justify-between gap-3 font-semibold text-text-strong">
                        <span className="inline-flex items-center gap-1">{h.previousSaleOwnerName ? <>{h.previousSaleOwnerName}<ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />{h.newSaleOwnerName}</> : `Gán ban đầu: ${h.newSaleOwnerName}`}</span>
                        <span className="tabular-nums text-text-muted">{formatDate(h.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-text-muted">Phương thức: {h.assignmentMethod}</p>
                      <p className="mt-0.5 text-text-default">Lý do: {h.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md border border-border-subtle bg-surface-sunken p-3 ${wide ? "md:col-span-2" : ""}`}>
      <p className="text-label font-semibold text-text-subtle">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-body font-semibold text-text-strong">{value}</p>
    </div>
  );
}

function ChecklistSummaryRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-sunken px-3 py-2">
      <span className="text-text-default">{label}</span>
      <Badge tone={value ? "success" : "neutral"}>{value ? "Đã duyệt" : "Chưa"}</Badge>
    </div>
  );
}

function formatMode(mode: string): string {
  return mode === "online" ? "Online" : mode === "offline" ? "Offline" : mode === "hybrid" ? "Kết hợp" : mode;
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const parts = value.split("T")[0].split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTrialStatus(status: string): string {
  switch (status) {
    case "attended": return "Đã đến học thử";
    case "no_show": return "Vắng";
    case "cancelled": return "Đã hủy";
    case "scheduled": return "Đã đặt lịch";
    default: return status;
  }
}

function getVietnamToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
