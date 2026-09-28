import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SepayTransactionHistory } from "@/features/finance/components/sepay-transaction-history";
import { SepayHistorySyncPanel, type SepaySyncAccountView, type SepaySyncRunView } from "@/features/finance/components/sepay-history-sync-panel";
import { getSepayReconciliationCandidatesResult, getSepayTransactionsResult } from "@/features/finance/data";
import type { SepayReconciliationCandidateReadModel } from "@/features/finance/read-models";
import { parseSepayAccountPurposeFilter } from "@/features/finance/sepay-transaction-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SepayTransactionsPageProps {
  searchParams: Promise<{ accountPurpose?: string | string[]; page?: string | string[] }>;
}

function getVietnamDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date(Date.now() + offsetDays * 86_400_000));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function SepayTransactionsPage({ searchParams }: SepayTransactionsPageProps) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Giao dịch SePay."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("sepay.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền sepay.view."
        title="Không có quyền xem Giao dịch SePay"
      />
    );
  }

  const params = await searchParams;
  const accountPurposeFilter = parseSepayAccountPurposeFilter(params.accountPurpose);
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const canSyncHistory = permissionResult.permissions.includes("sepay.sync_history.manage");
  const canReconcile = canSyncHistory
    || permissionResult.permissions.includes("sepay.allocate")
    || permissionResult.permissions.includes("payments.manage");

  const transactionsResult = await getSepayTransactionsResult(accountPurposeFilter, page);
  if (!transactionsResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được lịch sử giao dịch SePay. Vui lòng thử lại sau."
        title="Không tải được giao dịch SePay"
      />
    );
  }
  const candidatesResult = canReconcile
    ? await getSepayReconciliationCandidatesResult(transactionsResult.data.transactions)
    : { data: [] as SepayReconciliationCandidateReadModel[], ok: true as const };

  let syncPanel = null;
  if (canSyncHistory) {
    const supabase = await createSupabaseServerClient();
    const [{ data: accountRows, error: accountError }, { data: runRows, error: runError }] = await Promise.all([
      supabase
        .from("sepay_receiving_account_versions")
        .select("id,purpose,bank_code,account_number,effective_from,effective_to,sepay_bank_account_id")
        .eq("status", "active")
        .order("purpose")
        .order("effective_from", { ascending: false }),
      supabase
        .from("sepay_sync_runs")
        .select("id,sync_session_id,account_version_id,date_from,date_to,status,total_seen,recorded_count,duplicate_count,manual_review_count,pages_processed,error_code,started_at")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    if (accountError || runError) {
      syncPanel = (
        <ErrorState
          title="Không tải được cấu hình đồng bộ SePay"
          description="Chưa tải được tài khoản nhận hoặc tiến độ đồng bộ. Vui lòng tải lại trang trước khi nhập lịch sử."
        />
      );
    } else {
    const accounts: SepaySyncAccountView[] = (accountRows ?? []).flatMap((account) => (
      account.purpose === "new_enrollment" || account.purpose === "renewal"
        ? [{
            accountNumber: account.account_number,
            bankCode: account.bank_code,
            effectiveFrom: account.effective_from,
            effectiveTo: account.effective_to,
            id: account.id,
            purpose: account.purpose,
            sepayBankAccountId: account.sepay_bank_account_id,
          }]
        : []
    ));
    const recentRuns: SepaySyncRunView[] = (runRows ?? []).flatMap((run) => (
      run.status === "running" || run.status === "completed" || run.status === "failed"
        ? [{
            accountVersionId: run.account_version_id,
            dateFrom: run.date_from,
            dateTo: run.date_to,
            duplicateCount: run.duplicate_count,
            errorCode: run.error_code,
            id: run.id,
            manualReviewCount: run.manual_review_count,
            pagesProcessed: run.pages_processed,
            recordedCount: run.recorded_count,
            startedAt: run.started_at,
            status: run.status,
            syncSessionId: run.sync_session_id,
            totalSeen: run.total_seen,
          }]
        : []
    ));
    const yesterday = getVietnamDate(-1);
    syncPanel = (
      <SepayHistorySyncPanel
        accounts={accounts}
        defaultDateFrom={`${yesterday.slice(0, 8)}01`}
        defaultDateTo={yesterday}
        recentRuns={recentRuns}
      />
    );
    }
  }

  return (
    <SepayTransactionHistory
      accountPurposeFilter={accountPurposeFilter}
      candidates={candidatesResult.ok ? candidatesResult.data : []}
      canAllocate={permissionResult.permissions.includes("sepay.allocate") || permissionResult.permissions.includes("payments.manage")}
      canReconcile={canReconcile && candidatesResult.ok}
      managementPanel={syncPanel}
      page={transactionsResult.data.page}
      pageSize={transactionsResult.data.pageSize}
      reconciliationError={canReconcile && !candidatesResult.ok}
      total={transactionsResult.data.total}
      transactions={transactionsResult.data.transactions}
    />
  );
}
