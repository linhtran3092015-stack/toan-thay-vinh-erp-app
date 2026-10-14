"use client";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { CrmDetailView } from "@/features/crm/components/crm-detail-view";
import { CrmListView } from "@/features/crm/components/crm-list-view";
import type { CrmActionOverrides } from "@/features/crm/crm-action-overrides";
import { getCrmDirectoryStatus } from "@/features/crm/crm-directory-url-state";
import { CRM_CASE_STATUSES } from "@/features/crm/crm-presentation";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";
import type {
  CrmCaseDetailReadModel,
  CrmLeadItemReadModel,
  CrmStatusCounts,
  EnrollmentChecklistReadModel,
  LeadSourceOption,
  SaleOwnerOption,
} from "@/features/crm/read-models";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type CrmPreviewView = "list" | "detail";
export type CrmPreviewState = "normal" | "empty" | "errors" | "converted" | "dropped";
export type CrmPreviewRole = "sale" | "leader" | "owner";

const STUB = "Bản xem trước không ghi dữ liệu.";
// After CRM_STATUS_TRACKING_SINCE, and fixture status changes fall on or after
// it, so the list suffixes and the rail's current-step date are trusted.
const TODAY = "2026-10-20";
const stub = async (): Promise<CrmActionResultState> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for every CRM server action (transfer, trial booking and
 * result, status changes, conversion, notes and follow-ups, lead creation).
 * The preview runs on localhost where .env.local may point at production, so
 * no control may reach a server action: each answers with the stub message.
 */
export const previewCrmActions: Required<CrmActionOverrides> = {
  addCaseNote: stub,
  bookTrial: stub,
  changeCaseStatus: stub,
  completeFollowUp: stub,
  convertStudent: stub,
  createCrmCase: stub,
  recordTrialResult: stub,
  transferLead: stub,
};

const basePermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "notifications.view",
  "timekeeping.check",
  "students.view",
  "crm.view",
  "crm.update",
];

const rolePermissions: Record<CrmPreviewRole, readonly PermissionCode[]> = {
  /** Trưởng nhóm tuyển sinh: also transfers leads. */
  leader: [...basePermissions, "crm.transfer"],
  owner: DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view"),
  /** Chuyên viên tuyển sinh: updates leads, no transfer, no conversion. */
  sale: basePermissions,
};

const roleUsers: Record<CrmPreviewRole, string> = {
  leader: "Đặng Phương Thảo",
  owner: "Nguyễn Văn Vinh",
  sale: "Hoàng Minh Khôi",
};

const SALES = {
  khoi: "c3000000-0000-4000-8000-000000000001",
  thao: "c3000000-0000-4000-8000-000000000002",
} as const;

const saleOwners: SaleOwnerOption[] = [
  { fullName: "Hoàng Minh Khôi", id: SALES.khoi },
  { fullName: "Đặng Phương Thảo", id: SALES.thao },
];

const leadSources: LeadSourceOption[] = [
  { code: "mma_fanpage", groupCode: "mma", id: "c4000000-0000-4000-8000-000000000001", name: "MMA · Facebook" },
  { code: "mma_tiktok", groupCode: "mma", id: "c4000000-0000-4000-8000-000000000002", name: "MMA · TikTok" },
  { code: "referral_student", groupCode: "sb", id: "c4000000-0000-4000-8000-000000000003", name: "SB · Giới thiệu" },
  { code: "referral_parent", groupCode: "sb", id: "c4000000-0000-4000-8000-000000000004", name: "SB F1 · Phụ huynh cũ" },
];

function lead(overrides: Partial<CrmLeadItemReadModel> & Pick<CrmLeadItemReadModel, "fullName" | "id" | "publicCode" | "status">): CrmLeadItemReadModel {
  return {
    birthYear: 2013,
    createdAt: "2026-10-12T02:00:00Z",
    dropReason: null,
    expectedGrade: 8,
    expectedLevel: "B",
    expectedMode: "offline",
    guardianFullName: "Nguyễn Thị Thu",
    guardianPhone: "0905 123 456",
    leadSourceName: "MMA · Facebook",
    nextTrialDate: null,
    saleOwnerId: SALES.khoi,
    saleOwnerName: "Hoàng Minh Khôi",
    statusChangedAt: overrides.createdAt ?? "2026-10-12T02:00:00Z",
    studentId: null,
    ...overrides,
  };
}

const leads: CrmLeadItemReadModel[] = [
  lead({ createdAt: "2026-10-12T02:00:00Z", fullName: "Nguyễn Gia Hân", id: "c1000000-0000-4000-8000-000000000048", publicCode: "LD-2610-0048", saleOwnerId: null, saleOwnerName: "Chưa phân công", status: "interested", statusChangedAt: "2026-10-12T02:00:00Z" }),
  lead({ birthYear: 2012, createdAt: "2026-10-09T03:00:00Z", expectedGrade: 9, expectedLevel: "A", fullName: "Trần Minh Quân", guardianFullName: "Trần Văn Long", guardianPhone: "0912 998 877", id: "c1000000-0000-4000-8000-000000000041", leadSourceName: "SB · Giới thiệu", nextTrialDate: "2026-10-21", publicCode: "LD-2610-0041", status: "trial_booked" }),
  lead({ birthYear: 2014, createdAt: "2026-10-06T03:00:00Z", expectedGrade: 7, expectedMode: "online", fullName: "Lê Phương Anh", guardianFullName: "Lê Thị Hoa", guardianPhone: "0987 112 334", id: "c1000000-0000-4000-8000-000000000037", leadSourceName: "MMA · TikTok", publicCode: "LD-2610-0037", status: "trial_completed" }),
  lead({ birthYear: 2011, createdAt: "2026-10-01T03:00:00Z", expectedGrade: 10, expectedLevel: "CLC", fullName: "Phạm Đức Anh", guardianFullName: "Phạm Văn Hùng", guardianPhone: "0934 556 677", id: "c1000000-0000-4000-8000-000000000029", leadSourceName: "SB F1 · Phụ huynh cũ", publicCode: "LD-2610-0029", status: "pending_enrollment_confirmation", statusChangedAt: "2026-10-15T08:00:00Z", studentId: "c2000000-0000-4000-8000-000000000029" }),
  lead({ birthYear: 2012, createdAt: "2026-09-18T03:00:00Z", expectedGrade: 9, fullName: "Đỗ Hoàng Long", guardianFullName: "Đỗ Văn Tâm", guardianPhone: "0918 334 455", id: "c1000000-0000-4000-8000-000000000210", leadSourceName: "SB · Giới thiệu", publicCode: "LD-2609-0210", saleOwnerId: SALES.thao, saleOwnerName: "Đặng Phương Thảo", status: "converted", statusChangedAt: "2026-10-16T03:00:00Z", studentId: "c2000000-0000-4000-8000-000000000318" }),
  lead({ birthYear: 2014, createdAt: "2026-09-15T03:00:00Z", dropReason: "Phụ huynh chọn học nơi khác gần nhà hơn", expectedGrade: 7, expectedMode: "online", fullName: "Bùi Thanh Tâm", guardianFullName: "Bùi Văn Nam", guardianPhone: "0966 778 990", id: "c1000000-0000-4000-8000-000000000198", publicCode: "LD-2609-0198", status: "dropped", statusChangedAt: "2026-10-15T03:00:00Z" }),
  lead({ createdAt: "2026-09-28T03:00:00Z", fullName: "Ngô Bảo Ngọc", guardianFullName: "Ngô Thị Lan", guardianPhone: "0903 445 566", id: "c1000000-0000-4000-8000-000000000187", leadSourceName: "SB · Giới thiệu", publicCode: "LD-2609-0187", saleOwnerId: SALES.thao, saleOwnerName: "Đặng Phương Thảo", status: "interested", statusChangedAt: "2026-10-14T03:00:00Z" }),
];

function countsFor(items: CrmLeadItemReadModel[]): CrmStatusCounts {
  return Object.fromEntries(CRM_CASE_STATUSES.map((status) => [status, items.filter((item) => item.status === status).length])) as CrmStatusCounts;
}

/** Only the conversion RPC writes the boxes, all at once: an open lead has none ticked. */
const checklistBase: EnrollmentChecklistReadModel = {
  completedAt: null,
  completedByName: null,
  id: "c5000000-0000-4000-8000-000000000029",
  isFullyCompleted: false,
  item10CommunicationGroupReady: false,
  item1PaymentReceived: false,
  item2SourceConfirmed: false,
  item3SaleConfirmed: false,
  item4ClassSelected: false,
  item5ModeConfirmed: false,
  item6FeeConfirmed: false,
  item7AssistantSessionsConfirmed: false,
  item8AccountantTransactionConfirmed: false,
  item9OfficialStartDateEntered: false,
};

const checklistConverted: EnrollmentChecklistReadModel = {
  completedAt: "2026-10-16T03:00:00Z",
  completedByName: "Nguyễn Văn Vinh",
  id: checklistBase.id,
  isFullyCompleted: true,
  item10CommunicationGroupReady: true,
  item1PaymentReceived: true,
  item2SourceConfirmed: true,
  item3SaleConfirmed: true,
  item4ClassSelected: true,
  item5ModeConfirmed: true,
  item6FeeConfirmed: true,
  item7AssistantSessionsConfirmed: true,
  item8AccountantTransactionConfirmed: true,
  item9OfficialStartDateEntered: true,
};

const pendingCase: CrmCaseDetailReadModel = {
  assignmentHistory: [
    { assignedByName: "Lê Thu Trang", assignmentMethod: "manual_transfer", createdAt: "2026-10-02T03:00:00Z", id: "c6000000-0000-4000-8000-000000000002", newSaleOwnerName: "Hoàng Minh Khôi", previousSaleOwnerId: SALES.thao, previousSaleOwnerName: "Đặng Phương Thảo", reason: "Lead khối 10, thuộc nhóm của Khôi" },
    { assignedByName: null, assignmentMethod: "auto_round_robin", createdAt: "2026-10-01T03:00:00Z", id: "c6000000-0000-4000-8000-000000000001", newSaleOwnerName: "Đặng Phương Thảo", previousSaleOwnerId: null, previousSaleOwnerName: null, reason: "Chia đều theo nguồn SB F1" },
  ],
  birthYear: 2011,
  caseNotes: [
    { createdAt: "2026-10-06T09:30:00Z", createdBy: "c3000000-0000-4000-8000-000000000001", createdByName: "Hoàng Minh Khôi", followUpAt: "2026-10-22", followUpDoneAt: null, followUpDoneByName: null, id: "c7000000-0000-4000-8000-000000000001", note: "Phụ huynh muốn học thử thêm 1 buổi hình trước khi chốt lớp." },
  ],
  checklist: checklistBase,
  createdAt: "2026-10-01T03:00:00Z",
  discountNotes: "F1 −10%, 1 buổi tặng",
  dropReason: null,
  droppedAt: null,
  expectedGrade: 10,
  expectedLevel: "CLC",
  expectedMode: "offline",
  expectedOfficialStartDate: null,
  expectedTuitionFeeVnd: 2_000_000,
  fullName: "Phạm Đức Anh",
  guardianFullName: "Phạm Văn Hùng",
  guardianId: null,
  guardianPhone: "0934 556 677",
  guardianRelationship: "Bố",
  id: "c1000000-0000-4000-8000-000000000029",
  leadSourceCode: "referral_parent",
  leadSourceName: "SB F1 · Phụ huynh cũ",
  nickname: null,
  notes: "Muốn lớp nâng cao buổi tối, ưu tiên thứ 2-6.",
  provinceCity: "Hà Nội",
  publicCode: "LD-2610-0029",
  saleOwnerId: SALES.khoi,
  saleOwnerName: "Hoàng Minh Khôi",
  status: "pending_enrollment_confirmation",
  statusChangedAt: "2026-10-15T08:00:00Z",
  studentId: "c2000000-0000-4000-8000-000000000029",
  trialBookings: [
    { classSessionId: null, createdAt: "2026-10-07T02:00:00Z", id: "c8000000-0000-4000-8000-000000000002", learningMode: "offline", resultRecordedAt: null, saleNotes: "Buổi thêm phần hình học theo đề nghị của phụ huynh", status: "scheduled", teacherFeedback: null, trialDate: "2026-10-22" },
    { classSessionId: null, createdAt: "2026-10-02T04:00:00Z", id: "c8000000-0000-4000-8000-000000000001", learningMode: "offline", resultRecordedAt: "2026-10-05T14:00:00Z", saleNotes: "Phụ huynh muốn học thử thêm 1 buổi hình", status: "attended", teacherFeedback: "Nền tảng đại số tốt, hình học cần bổ trợ. Phù hợp lớp CLC.", trialDate: "2026-10-05" },
  ],
};

function detailFor(state: CrmPreviewState): CrmCaseDetailReadModel | null {
  if (state === "errors") return null;
  if (state === "converted") {
    return {
      ...pendingCase,
      checklist: checklistConverted,
      expectedOfficialStartDate: "2026-10-19",
      status: "converted",
      statusChangedAt: "2026-10-16T03:00:00Z",
      trialBookings: pendingCase.trialBookings.filter((booking) => booking.status === "attended"),
    };
  }
  if (state === "dropped") {
    return {
      ...pendingCase,
      dropReason: "Phụ huynh chọn học nơi khác gần nhà hơn",
      droppedAt: "2026-10-16T03:00:00Z",
      status: "dropped",
      statusChangedAt: "2026-10-16T03:00:00Z",
      // Dropping cancels the trials still scheduled.
      trialBookings: pendingCase.trialBookings.map((booking) => booking.status === "scheduled" ? { ...booking, resultRecordedAt: "2026-10-16T03:00:00Z", status: "cancelled" } : booking),
    };
  }
  if (state === "empty") {
    return {
      ...pendingCase,
      assignmentHistory: [],
      caseNotes: [],
      checklist: null,
      discountNotes: null,
      expectedTuitionFeeVnd: null,
      notes: null,
      saleOwnerId: null,
      saleOwnerName: "Chưa phân công",
      status: "interested",
      statusChangedAt: "2026-10-01T03:00:00Z",
      studentId: null,
      trialBookings: [],
    };
  }
  return pendingCase;
}

export function CrmPreview({
  role,
  state,
  statusFilter,
  view,
}: {
  role: CrmPreviewRole;
  state: CrmPreviewState;
  /** `status` from the URL, written by the preview's own chips and filter. */
  statusFilter?: string | null;
  view: CrmPreviewView;
}) {
  const permissions = rolePermissions[role];
  const can = (code: PermissionCode) => permissions.includes(code);
  const detail = view === "detail" ? detailFor(state) : null;
  const pathname = view === "list" ? "/crm" : `/crm/${pendingCase.id}`;
  const displayName = roleUsers[role];

  return (
    <AppShell
      authUser={{ displayName, email: "preview@example.com", id: "dev-user", initials: displayName.split(" ").map((part) => part[0]).slice(-2).join("") }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={pathname}
      unreadNotificationCount={3}
    >
      {view === "list" ? (
        <ListPreview canCreateLead={can("crm.update")} state={state} statusFilter={statusFilter ?? null} />
      ) : detail ? (
        <CrmDetailView
          actions={previewCrmActions}
          activeClasses={[
            { code: "T10-NC", id: "c9000000-0000-4000-8000-000000000001", name: "Toán 10 nâng cao tối 2-6" },
            { code: "T9-A", id: "c9000000-0000-4000-8000-000000000002", name: "Toán 9A" },
          ]}
          canConfirmOfficial={can("students.confirm_official")}
          canTransfer={can("crm.transfer")}
          canUpdate={can("crm.update")}
          detail={detail}
          directoryHref="/dev/crm?view=list"
          hasAccountantPermission={can("sepay.accountant_confirm")}
          saleOwners={saleOwners}
          todayIso={TODAY}
        />
      ) : (
        <EmptyState description="Hồ sơ Lead không tồn tại hoặc đã bị xóa." title="Không tìm thấy CRM case" />
      )}
    </AppShell>
  );
}

function ListPreview({ canCreateLead, state, statusFilter }: { canCreateLead: boolean; state: CrmPreviewState; statusFilter: string | null }) {
  const all = state === "empty" || state === "errors" ? [] : leads;
  const status = getCrmDirectoryStatus(statusFilter);
  const items = status ? all.filter((item) => item.status === status) : all;

  return (
    <CrmListView
      canCreateLead={canCreateLead}
      createHref="/dev/crm?view=list"
      directory={state === "errors" ? { failed: true, items: [], totalCount: 0 } : { items, totalCount: items.length }}
      directoryQuery={status ? `status=${status}` : ""}
      leadSources={leadSources}
      overview={{
        monthLabel: "10/2026",
        newLeadsThisMonth: state === "errors" ? null : all.filter((item) => item.createdAt >= "2026-10-01").length,
        pendingConfirmation: state === "errors" ? null : all.filter((item) => item.status === "pending_enrollment_confirmation").length,
      }}
      saleOwners={saleOwners}
      statusCounts={state === "errors" ? null : countsFor(all)}
      todayIso={TODAY}
    />
  );
}
