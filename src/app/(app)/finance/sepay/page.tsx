import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSepayAllocationSuggestionsResult } from "@/features/finance/allocation-suggestions-data";
import { SepayHistorySyncPanel, type SepaySyncAccountView, type SepaySyncRunView } from "@/features/finance/components/sepay-history-sync-panel";
import { SepayTransactionsScreen, type SepayReceivingAccountSummary } from "@/features/finance/components/sepay-transactions-screen";
import { getSepayReconciliationCandidatesResult, getSepayTransactionsResult } from "@/features/finance/data";
import type { SepayReconciliationCandidateReadModel } from "@/features/finance/read-models";
import { getSepayScreenAccess } from "@/features/finance/sepay-access";
import { parseSepayAccountPurposeFilter, parseSepayQueueFilter } from "@/features/finance/sepay-transaction-url-state";
import { addDays, getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface SepayTransactionsPageProps {
  searchParams: Promise<{
    accountPurpose?: string | string[];
    page?: string | string[];
    queue?: string | string[];
    // `status` (match-status chip) and `tx` (selection) are read client-side by
    // SepayReviewWorkspace through useSearchParams; the loader does not use them.
  }>;
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
        description={permissionDeniedDescription("sepay.view")}
        title="Không có quyền xem Giao dịch SePay"
      />
    );
  }

  const params = await searchParams;
  const accountPurposeFilter = parseSepayAccountPurposeFilter(params.accountPurpose);
  const queueFilter = parseSepayQueueFilter(params.queue);
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { canAllocate, canReconcile, canReverse, canSyncHistory } = getSepayScreenAccess(permissionResult.permissions);

  const transactionsResult = await getSepayTransactionsResult(accountPurposeFilter, page, queueFilter);
  if (!transactionsResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được lịch sử giao dịch SePay. Vui lòng thử lại sau."
        title="Không tải được giao dịch SePay"
      />
    );
  }
  const [candidatesResult, suggestionsResult] = await Promise.all([
    canReconcile
      ? getSepayReconciliationCandidatesResult(transactionsResult.data.transactions)
      : Promise.resolve({ data: [] as SepayReconciliationCandidateReadModel[], ok: true as const }),
    canAllocate
      ? getSepayAllocationSuggestionsResult()
      : Promise.resolve({ data: [], ok: true as const }),
  ]);
  let syncPanel = null;
  let receivingAccounts: SepayReceivingAccountSummary[] | null = null;
  if (canSyncHistory) {
    const supabase = await createSupabaseServerClient();
    // The receiving accounts feed the header on both tabs; the sync runs only feed the
    // history sync panel, which lives on "Tất cả giao dịch".
    const showSyncPanel = queueFilter !== "review";
    const [{ data: accountRows, error: accountError }, runsResult] = await Promise.all([
      supabase
        .from("sepay_receiving_account_versions")
        .select("id,purpose,bank_code,account_number,effective_from,effective_to,sepay_bank_account_id")
        .eq("status", "active")
        .order("purpose")
        .order("effective_from", { ascending: false }),
      showSyncPanel
        ? supabase
            .from("sepay_sync_runs")
            .select("id,sync_session_id,account_version_id,date_from,date_to,status,total_seen,recorded_count,duplicate_count,manual_review_count,pages_processed,error_code,started_at")
            .order("started_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const accounts: SepaySyncAccountView[] = accountError ? [] : (accountRows ?? []).flatMap((account) => (
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
    if (!accountError) {
      const today = getVietnamToday();
      // Header context: the version in force today for each purpose (rows are newest first).
      receivingAccounts = (["new_enrollment", "renewal"] as const).flatMap((purpose) => {
        const current = accounts.find((account) => (
          account.purpose === purpose
          && account.effectiveFrom <= today
          && (account.effectiveTo === null || account.effectiveTo >= today)
        ));
        return current ? [{ accountNumber: current.accountNumber, bankCode: current.bankCode, purpose }] : [];
      });
    }
    if (showSyncPanel) {
      if (accountError || runsResult.error) {
        syncPanel = (
          <ErrorState
            title="Không tải được cấu hình đồng bộ SePay"
            description="Chưa tải được tài khoản nhận hoặc tiến độ đồng bộ. Vui lòng tải lại trang trước khi nhập lịch sử."
          />
        );
      } else {
        const recentRuns: SepaySyncRunView[] = (runsResult.data ?? []).flatMap((run) => (
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
        const yesterday = addDays(getVietnamToday(), -1);
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
  }

  return (
    <SepayTransactionsScreen
      accountPurposeFilter={accountPurposeFilter}
      candidates={candidatesResult.ok ? candidatesResult.data : []}
      canAllocate={canAllocate}
      canReconcile={canReconcile && candidatesResult.ok}
      canReverse={canReverse}
      canSyncHistory={canSyncHistory}
      page={transactionsResult.data.page}
      pageSize={transactionsResult.data.pageSize}
      queueFilter={queueFilter}
      receivingAccounts={receivingAccounts}
      reconciliationError={canReconcile && !candidatesResult.ok}
      reviewCount={transactionsResult.data.reviewCount}
      suggestions={canAllocate ? suggestionsResult : null}
      syncPanel={syncPanel}
      total={transactionsResult.data.total}
      transactions={transactionsResult.data.transactions}
    />
  );
}
