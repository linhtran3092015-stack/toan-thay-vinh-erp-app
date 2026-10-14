"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import type { AllocationSuggestion, AllocationSuggestionsResult } from "@/features/finance/allocation-suggestions-data";
import { SepayHistorySyncPanel } from "@/features/finance/components/sepay-history-sync-panel";
import type { SepayReconciliationCandidateView } from "@/features/finance/components/sepay-reconciliation-actions";
import { SepayTransactionsScreen } from "@/features/finance/components/sepay-transactions-screen";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import { getSepayScreenAccess } from "@/features/finance/sepay-access";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import type { SepayHistorySyncActionResult } from "@/features/finance/sepay-history-sync-actions";
import { SEPAY_REVIEW_MATCH_STATUSES } from "@/features/finance/sepay-transaction-url-state";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type SepayPreviewTab = "review" | "all";
export type SepayPreviewRole = "owner" | "accountant";
export type SepayPreviewState = "normal" | "empty" | "errors";

const STUB = "Bản xem trước không ghi dữ liệu.";
const syncStub: SepayHistorySyncActionResult = { message: STUB, ok: false };

/**
 * Inert stand-ins for every server action the SePay screen can reach. The
 * preview runs on localhost where .env.local may point at production: it must
 * never reach allocation, reconciliation, reversal or history sync actions, so
 * every control gets one of these instead. Reads return fixtures so the
 * dialogs can be walked through; every write answers with the stub message.
 */
export const previewSepayActions: Required<SepayActionOverrides> = {
  allocate: async () => ({ message: STUB, ok: false }),
  getAllocationDetails: async () => ({
    data: [{
      allocated_amount_vnd: 2_400_000,
      allocated_at: "2026-10-10T03:20:00Z",
      allocated_by_name: "Phạm Thu Hạnh",
      allocated_sessions: 12,
      bonus_sessions: 0,
      notes: "Phụ huynh chuyển một lần cho hai con",
      payment_request_code: "YC-2610-0150",
      student_code: "TTV-00144",
      student_name: "Phạm Thu Hà",
      unit_price_vnd: 200_000,
    }],
    ok: true,
  }),
  matchHistorical: async () => ({ message: STUB, ok: false }),
  previewHistorySync: async () => ({
    accounts: [{ accountVersionId: "d1000000-0000-4000-8000-000000000002", label: "Tái phí · MB · 0399886886", totalAvailable: 0 }],
    continuationRequired: false,
    message: `${STUB} Số giao dịch dưới đây là dữ liệu mẫu, không đọc từ SePay.`,
    ok: true,
  }),
  resolveHistorical: async () => ({ message: STUB, ok: false }),
  reverseAllocation: async () => ({ message: STUB, ok: false }),
  searchAllocationStudents: async () => ({
    data: [{
      birthYear: 2011,
      guardianName: "Lý Văn Sơn",
      guardianPhone: "0912 345 678",
      id: "a1000000-0000-4000-8000-000000000088",
      name: "Lý Nhật Quang",
      publicCode: "TTV-00088",
      requests: [{
        amountVnd: 2_400_000,
        bonusSessions: 0,
        code: "YC-2610-0219",
        id: "a2000000-0000-4000-8000-000000000219",
        sessions: 12,
        status: "pending",
        topupType: "renewal",
      }],
    }],
    ok: true,
  }),
  searchReconciliationCandidates: async () => ({ candidates: [], ok: true }),
  syncHistory: async () => syncStub,
};

/** Accountant: reconciles and allocates; no reversal (payments.manage) and no history sync. */
const accountantPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "sepay.view",
  "sepay.allocate",
  "tuition_periods.view",
  "students.view",
];

function transaction(overrides: Partial<SepayTransactionReadModel> & Pick<SepayTransactionReadModel, "id">): SepayTransactionReadModel {
  return {
    accountNumber: "0399886886",
    accountPurpose: "renewal",
    amountVnd: 2_400_000,
    bankBrand: "MB Bank",
    bankTransactionId: "FT26285001",
    createdAt: "2026-10-12T01:14:40Z",
    ingestionSource: "webhook",
    matchStatus: "unmatched",
    matchedAt: null,
    matchedPaymentRequestCode: null,
    matchedStudentFullName: null,
    referenceNumber: null,
    sepayV2Id: null,
    transactionAt: "2026-10-12T01:14:37Z",
    transferContent: "",
    transferType: "in",
    ...overrides,
  };
}

const reviewTransactions: SepayTransactionReadModel[] = [
  transaction({
    bankTransactionId: "FT26285001",
    id: "c1000000-0000-4000-8000-000000000001",
    referenceNumber: "SP-88214102",
    transactionAt: "2026-10-12T01:14:37Z",
    transferContent: "LY VAN SON CK HOC PHI THANG 10 QUANG",
  }),
  transaction({
    amountVnd: 1_900_000,
    bankTransactionId: "FT26285014",
    id: "c1000000-0000-4000-8000-000000000002",
    matchStatus: "amount_mismatch",
    transactionAt: "2026-10-12T02:02:11Z",
    transferContent: "TTV00117 T10",
  }),
  transaction({
    amountVnd: 500_000,
    bankTransactionId: "FT26284977",
    id: "c1000000-0000-4000-8000-000000000003",
    matchStatus: "account_purpose_mismatch",
    transactionAt: "2026-10-11T13:41:05Z",
    transferContent: "NGUYEN THI THU chuyen tien",
  }),
  transaction({
    accountNumber: "0399886887",
    accountPurpose: "new_enrollment",
    amountVnd: 1_440_000,
    bankTransactionId: "FT26283310",
    id: "c1000000-0000-4000-8000-000000000004",
    ingestionSource: "api_v2",
    matchStatus: "identity_conflict",
    sepayV2Id: "95000000-0000-4000-8000-000000000004",
    transactionAt: "2026-10-10T09:12:44Z",
    transferContent: "MAI PHUONG LINH HP T10 TOAN 7A",
  }),
];

const settledTransactions: SepayTransactionReadModel[] = [
  transaction({
    bankTransactionId: "FT26285120",
    id: "c2000000-0000-4000-8000-000000000001",
    matchStatus: "auto_matched",
    matchedAt: "2026-10-12T06:58:30Z",
    matchedPaymentRequestCode: "YC-2610-0204",
    matchedStudentFullName: "Nguyễn Minh Anh",
    transactionAt: "2026-10-12T06:58:12Z",
    transferContent: "TTVC YC26100204 NGUYEN MINH ANH",
  }),
  transaction({
    amountVnd: 4_800_000,
    bankTransactionId: "FT26284002",
    id: "c2000000-0000-4000-8000-000000000002",
    matchStatus: "split_allocated",
    matchedAt: "2026-10-10T03:20:00Z",
    transactionAt: "2026-10-10T02:51:09Z",
    transferContent: "PHAM VAN TUAN HP 2 CON T10",
  }),
  transaction({
    accountNumber: "0399886887",
    accountPurpose: "new_enrollment",
    amountVnd: 1_440_000,
    bankTransactionId: "FT26283998",
    id: "c2000000-0000-4000-8000-000000000003",
    matchStatus: "manual_matched",
    matchedAt: "2026-10-09T08:00:00Z",
    matchedPaymentRequestCode: "YC-2610-0091",
    matchedStudentFullName: "Vũ Gia Bảo",
    transactionAt: "2026-10-09T07:40:00Z",
    transferContent: "VU GIA BAO DANG KY LOP 7A",
  }),
  transaction({
    amountVnd: 2_000_000,
    bankTransactionId: "FT26270110",
    id: "c2000000-0000-4000-8000-000000000004",
    ingestionSource: "api_v2",
    matchStatus: "historical_accounted",
    sepayV2Id: "95000000-0000-4000-8000-000000000010",
    transactionAt: "2026-09-27T04:10:00Z",
    transferContent: "HO ANH KHOA HP T9",
  }),
  transaction({
    accountNumber: "0399886887",
    accountPurpose: "unknown",
    amountVnd: 50_000,
    bankTransactionId: "FT26269001",
    id: "c2000000-0000-4000-8000-000000000005",
    matchStatus: "ignored",
    transactionAt: "2026-09-26T10:00:00Z",
    transferContent: "CHUYEN NHAM",
  }),
];

const allTransactions = [...reviewTransactions, ...settledTransactions]
  .sort((a, b) => b.transactionAt.localeCompare(a.transactionAt));

const suggestions: AllocationSuggestion[] = [
  {
    accountPurpose: "renewal",
    amountVnd: 2_400_000,
    candidateCount: 2,
    candidates: [
      {
        birthYear: 2011,
        candidateRank: 1,
        confidence: "high",
        currentGrade: 9,
        guardianName: "Lý Văn Sơn",
        guardianPhone: "0912 345 678",
        matchReasons: ["student_name", "guardian_phone"],
        pendingRequestId: "a2000000-0000-4000-8000-000000000219",
        studentCode: "TTV-00088",
        studentId: "a1000000-0000-4000-8000-000000000088",
        studentName: "Lý Nhật Quang",
        suggestedSessions: 12,
        unitPriceVnd: 200_000,
      },
      {
        birthYear: 2014,
        candidateRank: 2,
        confidence: "medium",
        currentGrade: 6,
        guardianName: "Lý Văn Sơn",
        guardianPhone: "0912 345 678",
        matchReasons: ["guardian_phone"],
        pendingRequestId: null,
        studentCode: "TTV-00241",
        studentId: "a1000000-0000-4000-8000-000000000241",
        studentName: "Lý Gia Hân",
        suggestedSessions: 12,
        unitPriceVnd: 120_000,
      },
    ],
    transactionAt: reviewTransactions[0].transactionAt,
    transactionId: reviewTransactions[0].id,
    transferContent: reviewTransactions[0].transferContent,
  },
  {
    accountPurpose: "renewal",
    amountVnd: 1_900_000,
    candidateCount: 1,
    candidates: [{
      birthYear: 2011,
      candidateRank: 1,
      confidence: "medium",
      currentGrade: 9,
      guardianName: "Bùi Văn Hưng",
      guardianPhone: "0987 111 222",
      matchReasons: ["student_code"],
      pendingRequestId: "a2000000-0000-4000-8000-000000000117",
      studentCode: "TTV-00117",
      studentId: "a1000000-0000-4000-8000-000000000117",
      studentName: "Bùi Quang Minh",
      suggestedSessions: null,
      unitPriceVnd: 210_000,
    }],
    transactionAt: reviewTransactions[1].transactionAt,
    transactionId: reviewTransactions[1].id,
    transferContent: reviewTransactions[1].transferContent,
  },
];

const candidates: SepayReconciliationCandidateView[] = [
  { expectedAmountVnd: 2_400_000, id: "a2000000-0000-4000-8000-000000000219", publicCode: "YC-2610-0219", studentFullName: "Lý Nhật Quang", topupType: "renewal" },
  { expectedAmountVnd: 500_000, id: "a2000000-0000-4000-8000-000000000301", publicCode: "YC-2610-0301", studentFullName: "Nguyễn Thị Thu", topupType: "renewal" },
];

const syncAccounts = [
  { accountNumber: "0399886887", bankCode: "MB", effectiveFrom: "2026-01-01", effectiveTo: null, id: "d1000000-0000-4000-8000-000000000001", purpose: "new_enrollment" as const, sepayBankAccountId: "21001" },
  { accountNumber: "0399886886", bankCode: "MB", effectiveFrom: "2026-01-01", effectiveTo: null, id: "d1000000-0000-4000-8000-000000000002", purpose: "renewal" as const, sepayBankAccountId: "21002" },
];

export function SepayPreview({
  role,
  state,
  tab,
}: {
  role: SepayPreviewRole;
  state: SepayPreviewState;
  tab: SepayPreviewTab;
}) {
  const permissions = role === "accountant" ? accountantPermissions : DATABASE_PERMISSION_CODES;
  const access = getSepayScreenAccess(permissions);
  const errors = state === "errors";
  const transactions = state === "empty" ? [] : tab === "review" ? reviewTransactions : allTransactions;
  const reviewCount = state === "empty" ? 0 : reviewTransactions.filter((row) => (SEPAY_REVIEW_MATCH_STATUSES as readonly string[]).includes(row.matchStatus)).length;
  const suggestionsResult: AllocationSuggestionsResult | null = access.canAllocate
    ? errors
      ? { error: "Không tải được gợi ý khớp giao dịch.", ok: false }
      : { data: state === "empty" ? [] : suggestions, ok: true }
    : null;

  const syncPanel = access.canSyncHistory ? (
    errors ? (
      <ErrorState
        description="Chưa tải được tài khoản nhận hoặc tiến độ đồng bộ. Vui lòng tải lại trang trước khi nhập lịch sử."
        title="Không tải được cấu hình đồng bộ SePay"
      />
    ) : (
      <SepayHistorySyncPanel
        accounts={syncAccounts}
        actions={previewSepayActions}
        defaultDateFrom="2026-10-01"
        defaultDateTo="2026-10-13"
        recentRuns={[{
          accountVersionId: syncAccounts[1].id,
          dateFrom: "2026-09-01",
          dateTo: "2026-09-30",
          duplicateCount: 212,
          errorCode: null,
          id: "d2000000-0000-4000-8000-000000000001",
          manualReviewCount: 3,
          pagesProcessed: 3,
          recordedCount: 18,
          startedAt: "2026-10-01T01:00:00Z",
          status: "completed",
          syncSessionId: "d3000000-0000-4000-8000-000000000001",
          totalSeen: 233,
        }]}
      />
    )
  ) : null;

  return (
    <AppShell
      authUser={{ displayName: role === "accountant" ? "Phạm Thu Hạnh" : "Nguyễn Văn Vinh", email: "preview@example.com", id: "dev-user", initials: role === "accountant" ? "PH" : "NV" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname="/finance/sepay"
      unreadNotificationCount={3}
    >
      <SepayTransactionsScreen
        accountPurposeFilter=""
        actions={previewSepayActions}
        candidates={errors ? [] : candidates}
        canAllocate={access.canAllocate}
        canReconcile={access.canReconcile && !errors}
        canReverse={access.canReverse}
        canSyncHistory={access.canSyncHistory}
        page={1}
        pageSize={50}
        queueFilter={tab === "review" ? "review" : ""}
        receivingAccounts={access.canSyncHistory && !errors ? syncAccounts.map(({ accountNumber, bankCode, purpose }) => ({ accountNumber, bankCode, purpose })) : null}
        reconciliationError={access.canReconcile && errors}
        reviewCount={reviewCount}
        suggestions={suggestionsResult}
        syncPanel={syncPanel}
        total={transactions.length}
        transactions={transactions}
      />
    </AppShell>
  );
}
