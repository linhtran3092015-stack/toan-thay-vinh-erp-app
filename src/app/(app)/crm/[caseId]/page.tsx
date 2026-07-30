import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmConversionChecklistDialog } from "@/features/crm/components/crm-conversion-checklist-dialog";
import { CrmLeadTransferDialog } from "@/features/crm/components/crm-lead-transfer-dialog";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import { CrmTrialBookingDialog } from "@/features/crm/components/crm-trial-booking-dialog";
import { getCrmCaseDetail, getSaleOwners } from "@/features/crm/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface CrmCaseDetailPageProps {
  params: Promise<{
    caseId: string;
  }>;
}

export default async function CrmCaseDetailPage({ params }: CrmCaseDetailPageProps) {
  const { caseId } = await params;
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
        description="Tài khoản hiện tại không có quyền crm.view."
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
    <div className="grid min-w-0 gap-4">
      {/* Header */}
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-3 flex items-center gap-2 text-sm text-ink-muted">
          <Link className="font-semibold text-primary hover:underline" href="/crm">
            CRM & Tuyển sinh
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">{detail.publicCode}</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink md:text-3xl">{detail.fullName}</h1>
              <CrmStatusBadge status={detail.status} />
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge tone="info">Mã: {detail.publicCode}</Badge>
              <Badge tone="info">Khối {detail.expectedGrade}</Badge>
              {detail.expectedLevel ? <Badge tone="purple">Mức {detail.expectedLevel}</Badge> : null}
              {detail.expectedMode ? <Badge tone="neutral">{detail.expectedMode}</Badge> : null}
              <Badge tone="neutral">Sale: {detail.saleOwnerName ?? "Chưa phân công"}</Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {canTransfer && detail.status !== "converted" ? (
              <CrmLeadTransferDialog
                crmCaseId={detail.id}
                currentSaleOwnerId={detail.saleOwnerId}
                saleOwners={saleOwners}
              />
            ) : null}

            {canUpdate && detail.status !== "converted" ? (
              <CrmTrialBookingDialog crmCaseId={detail.id} />
            ) : null}

            {canConfirmOfficial && detail.status !== "converted" ? (
              <CrmConversionChecklistDialog
                checklist={detail.checklist}
                classes={activeClasses}
                crmCaseId={detail.id}
                hasAccountantPermission={hasAccountantPermission}
              />
            ) : null}

            {detail.studentId ? (
              <Link href={`/students/${detail.studentId}`}>
                <Button variant="outline">Xem Hồ sơ Học viên Chính thức ➔</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Grid Details */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid content-start gap-4">
          {/* Lead & Guardian Info */}
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

          {/* Trial Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử Học thử (Trial Bookings)</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.trialBookings.length === 0 ? (
                <p className="text-sm text-ink-muted">Chưa có lịch học thử nào được đặt.</p>
              ) : (
                <div className="grid gap-3">
                  {detail.trialBookings.map((t) => (
                    <div className="rounded-md border border-hairline bg-canvas p-3 text-sm" key={t.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">Ngày thử: {formatDate(t.trialDate)}</span>
                        <Badge tone={t.status === "attended" ? "success" : "warning"}>{t.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">Hình thức: {t.learningMode}</p>
                      {t.saleNotes ? <p className="mt-1 text-xs text-ink">Ghi chú sale: {t.saleNotes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          {/* 10 Checklist Status Summary */}
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
                <p className="text-sm text-ink-muted">Chưa khởi tạo checklist.</p>
              )}
            </CardContent>
          </Card>

          {/* Lead Assignment History */}
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử phân công Lead</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.assignmentHistory.length === 0 ? (
                <p className="text-sm text-ink-muted">Chưa có lịch sử chuyển giao.</p>
              ) : (
                <div className="grid gap-3">
                  {detail.assignmentHistory.map((h) => (
                    <div className="rounded-md border border-hairline bg-canvas p-3 text-xs" key={h.id}>
                      <div className="flex items-center justify-between font-semibold text-ink">
                        <span>{h.previousSaleOwnerName ? `${h.previousSaleOwnerName} ➔ ${h.newSaleOwnerName}` : `Gán ban đầu: ${h.newSaleOwnerName}`}</span>
                        <span className="text-[10px] text-ink-muted">{formatDate(h.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-ink-muted">Phương thức: {h.assignmentMethod}</p>
                      <p className="mt-0.5 text-ink">Lý do: {h.reason}</p>
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
    <div className={`rounded-md border border-hairline bg-canvas p-3 ${wide ? "md:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ChecklistSummaryRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border border-hairline px-3 py-2 bg-canvas">
      <span className="text-ink">{label}</span>
      <Badge tone={value ? "success" : "neutral"}>{value ? "Đã duyệt" : "Chưa"}</Badge>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const parts = value.split("T")[0].split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
