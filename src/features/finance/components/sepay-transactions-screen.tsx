"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { Tabs } from "@/components/ui/tabs";
import type { AllocationSuggestionsResult } from "@/features/finance/allocation-suggestions-data";
import { SepayAllocationSuggestions } from "@/features/finance/components/sepay-allocation-suggestions";
import type { SepayReconciliationCandidateView } from "@/features/finance/components/sepay-reconciliation-actions";
import { SepayReviewWorkspace } from "@/features/finance/components/sepay-review-workspace";
import { SepayTransactionHistory } from "@/features/finance/components/sepay-transaction-history";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import {
  getSepayDirectoryQuery,
  type SepayAccountPurposeFilter,
  type SepayQueueFilter,
} from "@/features/finance/sepay-transaction-url-state";
import { formatDateTime } from "@/lib/datetime";

/*
 * Design 07 frame 7c blocks left out (no data or no flow behind them yet):
 * - "Nhập sao kê thủ công" header action: no manual statement import exists.
 * - "Lịch sử đã khớp" header action: there is no matched-only list; the
 *   "Tất cả giao dịch" tab already opens the full history.
 * - Webhook health in the context line and the "Chưa nhận giao dịch mới từ …"
 *   banner with "Kiểm tra kết nối": no webhook heartbeat is stored.
 * - Tabs "Lệch số tiền", "Sai tài khoản mục đích", "Khớp tự động hôm nay",
 *   "Bỏ qua / hoàn tiền" with totals: the loader only counts the review queue;
 *   review statuses are chips inside "Cần xử lý" when the whole queue is loaded.
 * - Sender name / account ("Người chuyển"): not parsed from SePay payloads.
 * - Inline allocation table with "Xác nhận phân bổ" and "Bỏ qua giao dịch…":
 *   the existing Phân bổ học phí / Đối soát dialogs own those writes.
 * - "+" sign on amounts and the "Khớp thấp" confidence: amounts stay neutral
 *   (tests) and the suggestion RPC only returns high | medium.
 */

export interface SepayReceivingAccountSummary {
  accountNumber: string;
  bankCode: string;
  purpose: "new_enrollment" | "renewal";
}

export interface SepayTransactionsScreenProps {
  accountPurposeFilter: SepayAccountPurposeFilter;
  /** Replacements for every server action the screen can reach (dev preview only). */
  actions?: SepayActionOverrides;
  canAllocate: boolean;
  canReconcile: boolean;
  canReverse: boolean;
  candidates: SepayReconciliationCandidateView[];
  /** sepay.sync_history.manage (identity-conflict hint on the review tab). */
  canSyncHistory?: boolean;
  page: number;
  pageSize: number;
  queueFilter: SepayQueueFilter;
  /** Active receiving accounts, only when the existing sync read loaded them. */
  receivingAccounts?: readonly SepayReceivingAccountSummary[] | null;
  reconciliationError: boolean;
  /** Inbound transfers needing a decision, independent of the filters; null when the count failed. */
  reviewCount: number | null;
  /** null when the viewer may not allocate (no suggestions read). */
  suggestions: AllocationSuggestionsResult | null;
  /** History sync panel (or its load error), only for sepay.sync_history.manage. */
  syncPanel?: ReactNode;
  total: number;
  transactions: SepayTransactionReadModel[];
}

const purposeLabels: Record<SepayReceivingAccountSummary["purpose"], string> = {
  new_enrollment: "Tuyển mới",
  renewal: "Tái phí",
};

/** Context line facts that are actually known; nothing is shown for unknowns. */
function getSepayHeaderContext({
  accountPurposeFilter,
  page,
  queueFilter,
  receivingAccounts,
  transactions,
}: Pick<SepayTransactionsScreenProps, "accountPurposeFilter" | "page" | "queueFilter" | "receivingAccounts" | "transactions">): string[] {
  const parts = (receivingAccounts ?? []).map((account) => `TK nhận ${purposeLabels[account.purpose]} ${account.bankCode} ${account.accountNumber}`);
  // Only the unfiltered first page of "Tất cả giao dịch" starts with the newest transfer overall.
  const latest = queueFilter === "" && page === 1 && accountPurposeFilter === "" ? transactions[0] : undefined;
  if (latest && !Number.isNaN(new Date(latest.transactionAt).getTime())) {
    parts.push(`Giao dịch mới nhất ${formatDateTime(latest.transactionAt)}`);
  }
  return parts;
}

/** /finance/sepay: header, Cần xử lý / Tất cả giao dịch tabs and the active tab body. */
export function SepayTransactionsScreen({
  accountPurposeFilter,
  actions,
  canAllocate,
  canReconcile,
  canReverse,
  candidates,
  canSyncHistory = false,
  page,
  pageSize,
  queueFilter,
  receivingAccounts = null,
  reconciliationError,
  reviewCount,
  suggestions,
  syncPanel = null,
  total,
  transactions,
}: SepayTransactionsScreenProps) {
  const isReview = queueFilter === "review";
  const context = getSepayHeaderContext({ accountPurposeFilter, page, queueFilter, receivingAccounts, transactions });
  const allHref = `/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, "")}`;
  const reviewHref = `/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, "review")}`;

  const suggestionsPanel = suggestions === null ? null : suggestions.ok ? (
    <SepayAllocationSuggestions actions={actions} suggestions={suggestions.data} />
  ) : (
    <ErrorState description={suggestions.error} title="Không tải được gợi ý khớp giao dịch" />
  );

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Giao dịch SePay">
        <p className="mt-1 text-secondary text-text-muted">
          {context.length > 0 ? context.join(" · ") : "Lịch sử giao dịch ngân hàng được SePay ghi nhận."}
        </p>
      </PageHeader>

      <Tabs
        items={[
          { href: reviewHref, label: "Cần xử lý", pending: reviewCount !== null && reviewCount > 0 ? reviewCount : undefined, value: "review" },
          { href: allHref, label: "Tất cả giao dịch", value: "all" },
        ]}
        label="Hàng đợi đối soát SePay"
        value={isReview ? "review" : "all"}
      />

      {isReview ? (
        <>
          {reconciliationError ? (
            <p className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-secondary text-danger" role="alert">
              Không tải được danh sách yêu cầu thanh toán để đối soát. Thao tác khớp theo danh sách này đang tạm khóa; vui lòng tải lại trang.
            </p>
          ) : null}
          <SepayReviewWorkspace
            // A new purpose or page is a new data set: start over. The status chip and selection
            // are read from the address bar (useSearchParams) inside the workspace.
            key={`${accountPurposeFilter}|${page}`}
            accountPurposeFilter={accountPurposeFilter}
            actions={actions}
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            candidates={candidates}
            canSyncHistory={canSyncHistory}
            page={page}
            pageSize={pageSize}
            reconciliationError={reconciliationError}
            reviewCount={reviewCount}
            suggestions={suggestions?.ok ? suggestions.data : null}
            suggestionsError={suggestions && !suggestions.ok ? suggestions.error : null}
            total={total}
            transactions={transactions}
          />
        </>
      ) : (
        <SepayTransactionHistory
          accountPurposeFilter={accountPurposeFilter}
          actions={actions}
          candidates={candidates}
          canAllocate={canAllocate}
          canReconcile={canReconcile}
          canReverse={canReverse}
          managementPanel={
            suggestionsPanel || syncPanel ? (
              <div className="grid gap-4">
                {suggestionsPanel}
                {syncPanel}
              </div>
            ) : null
          }
          page={page}
          pageSize={pageSize}
          reconciliationError={reconciliationError}
          total={total}
          transactions={transactions}
        />
      )}
    </div>
  );
}
