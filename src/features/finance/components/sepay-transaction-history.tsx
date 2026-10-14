"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { getSepayDirectoryQuery, type SepayAccountPurposeFilter, type SepayQueueFilter } from "@/features/finance/sepay-transaction-url-state";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import { formatDateTime } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { SepayReconciliationActions, type SepayReconciliationCandidateView } from "@/features/finance/components/sepay-reconciliation-actions";
import { SepayAllocationReversalDialog } from "@/features/finance/components/sepay-allocation-reversal-dialog";
import { SepayManualAllocation } from "@/features/finance/components/sepay-manual-allocation";
import { SepayReconciliationDialog } from "@/features/finance/components/sepay-reconciliation-dialog";

interface SepayTransactionHistoryProps {
  accountPurposeFilter?: SepayAccountPurposeFilter;
  /** Replacements for every server action reachable from the list (dev preview only). */
  actions?: SepayActionOverrides;
  canAllocate?: boolean;
  canReconcile?: boolean;
  /** payments.manage: may undo a matched or allocated transaction. */
  canReverse?: boolean;
  candidates?: SepayReconciliationCandidateView[];
  managementPanel?: ReactNode;
  page?: number;
  pageSize?: number;
  reconciliationError?: boolean;
  total?: number;
  transactions: SepayTransactionReadModel[];
}

type SepayMatchTone = "info" | "neutral" | "success" | "warning";

interface SepayMatchPresentation {
  label: string;
  tone: SepayMatchTone;
}

export function getSepayAccountPurposePresentation(
  purpose: SepayTransactionReadModel["accountPurpose"],
): { label: string; tone: SepayMatchTone } {
  switch (purpose) {
    case "new_enrollment":
      return { label: "Tuyển mới", tone: "success" };
    case "renewal":
      return { label: "Tái phí", tone: "info" };
    case "unknown":
      return { label: "Chưa xác định", tone: "warning" };
  }
}

/** SePay-local reconciliation wording; it does not imply payment settlement. */
export function getSepayMatchPresentation(
  status: SepayTransactionReadModel["matchStatus"],
): SepayMatchPresentation {
  switch (status) {
    case "auto_matched":
      return { label: "Khớp tự động", tone: "success" };
    case "manual_matched":
      return { label: "Khớp thủ công", tone: "success" };
    case "split_allocated":
      return { label: "Đã phân bổ học phí", tone: "info" };
    case "amount_mismatch":
      return { label: "Sai số tiền – cần đối soát", tone: "warning" };
    case "account_purpose_mismatch":
      return { label: "Sai tài khoản nhận – cần đối soát", tone: "warning" };
    case "identity_conflict":
      return { label: "Trùng nhận diện – cần đối soát", tone: "warning" };
    case "historical_accounted":
      return { label: "Đã hạch toán trước đây", tone: "info" };
    case "ignored":
      return { label: "Đã bỏ qua", tone: "neutral" };
    case "unmatched":
      return { label: "Chưa khớp – cần đối soát", tone: "warning" };
  }
}

/**
 * "Tất cả giao dịch": paginated SePay transaction history with
 * permission-gated reconciliation. The page header and the Cần xử lý /
 * Tất cả giao dịch tabs live in SepayTransactionsScreen.
 */
export function SepayTransactionHistory({
  accountPurposeFilter = "",
  actions,
  canAllocate = false,
  canReconcile = false,
  canReverse = false,
  candidates = [],
  managementPanel,
  page = 1,
  pageSize = 50,
  reconciliationError = false,
  transactions,
  total = transactions.length,
}: SepayTransactionHistoryProps) {
  const [reconcilingTransaction, setReconcilingTransaction] = useState<SepayTransactionReadModel | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenReconciliation = (
    transaction: SepayTransactionReadModel,
    trigger: HTMLElement | null,
  ) => {
    triggerButtonRef.current = trigger as HTMLButtonElement | null;
    setReconcilingTransaction(transaction);
  };

  const handleCloseReconciliation = () => {
    setReconcilingTransaction(null);
  };

  return (
    <div className="grid min-w-0 gap-5">
      {managementPanel}

      {reconciliationError ? (
        <p className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-secondary text-danger" role="alert">
          Không tải được danh sách yêu cầu thanh toán để đối soát. Thao tác khớp theo danh sách này đang tạm khóa; vui lòng tải lại trang.
        </p>
      ) : null}

      <section
        aria-labelledby="sepay-transaction-result-context"
        className="sepay-transaction-operational-work-area grid min-w-0 gap-4"
      >
        <SepayPurposeFilterNav purpose={accountPurposeFilter} queue="" />
        <p
          aria-live="polite"
          className="text-secondary text-text-muted"
          id="sepay-transaction-result-context"
        >
          Hiển thị {transactions.length} trong tổng số {total} giao dịch.
        </p>

        {transactions.length === 0 && total > 0 ? (
          // A stale ?page= past the last row (the loader returns an empty page with the real total).
          <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4">
            <h2 className="text-control font-semibold text-text-strong">Trang này không còn giao dịch.</h2>
            <p className="text-secondary text-text-muted">Danh sách có {total} giao dịch; trang này nằm sau trang cuối.</p>
            <div>
              <Link
                className={getButtonClassName({ size: "lg", variant: "secondary" })}
                href={`/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, "")}`}
              >
                Về trang 1
              </Link>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            description="Chưa có giao dịch SePay nào được ghi nhận."
            title="Chưa có giao dịch SePay"
          />
        ) : (
          <SepayTransactionTable
            actions={actions}
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            canReverse={canReverse}
            onOpenReconciliation={handleOpenReconciliation}
            transactions={transactions}
          />
        )}
        <SepayPagination accountPurposeFilter={accountPurposeFilter} page={page} pageSize={pageSize} queue="" total={total} />
      </section>

      {canReconcile ? (
        <SepayReconciliationDialog
          actions={actions}
          candidates={candidates}
          isOpen={reconcilingTransaction !== null}
          onClose={handleCloseReconciliation}
          returnFocusRef={triggerButtonRef}
          transaction={reconcilingTransaction}
        />
      ) : null}
    </div>
  );
}

function SepayTransactionTable({
  actions,
  canAllocate,
  canReconcile,
  canReverse,
  onOpenReconciliation,
  transactions,
}: Pick<SepayTransactionHistoryProps, "actions" | "canAllocate" | "canReconcile" | "canReverse" | "transactions"> & {
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
}) {
  return (
    <div className="sepay-transaction-results-work-area">
      <DataTableFrame
        body={transactions.map((transaction) => (
          <SepayTransactionTableRow
            actions={actions}
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            canReverse={canReverse}
            key={transaction.id}
            onOpenReconciliation={onOpenReconciliation}
            transaction={transaction}
          />
        ))}
        caption="Danh sách giao dịch SePay mới nhất"
        className="sepay-transaction-directory-table"
        header={
          <tr>
            <TableHeader>Mã giao dịch</TableHeader>
            <TableHeader>Thời gian</TableHeader>
            <TableHeader>Ngân hàng · STK</TableHeader>
            <TableHeader>Tài khoản nhận</TableHeader>
            <TableHeader>Nội dung chuyển khoản</TableHeader>
            <TableHeader className="text-right">Số tiền</TableHeader>
            <TableHeader>Trạng thái khớp</TableHeader>
            <TableHeader>Tham chiếu hiện có</TableHeader>
            <TableHeader>Thao tác</TableHeader>
          </tr>
        }
        tableClassName="min-w-[1340px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="sepay-transaction-directory-record-list"
        label="Danh sách giao dịch SePay mới nhất"
      >
        {transactions.map((transaction) => (
          <SepayTransactionRecord
            actions={actions}
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            canReverse={canReverse}
            key={transaction.id}
            onOpenReconciliation={onOpenReconciliation}
            transaction={transaction}
          />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function SepayTransactionTableRow({
  actions,
  canAllocate,
  canReconcile,
  canReverse,
  onOpenReconciliation,
  transaction,
}: {
  actions?: SepayActionOverrides;
  canAllocate?: boolean;
  canReconcile?: boolean;
  canReverse?: boolean;
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
  transaction: SepayTransactionReadModel;
}) {
  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[142px] font-mono text-caption font-semibold text-text-muted">
        {transaction.bankTransactionId}
        <span className="mt-1 block font-sans font-normal text-text-muted">{getSepaySourceLabel(transaction.ingestionSource)}</span>
        {transaction.referenceNumber ? <span className="mt-1 block break-all font-sans font-normal">Ref: {transaction.referenceNumber}</span> : null}
      </TableCell>
      <TableCell className="w-[132px] tabular-nums text-secondary text-text-muted">
        {formatDateTime(transaction.transactionAt)}
      </TableCell>
      <TableCell className="w-[156px]">
        <p className="font-semibold text-text-strong">{transaction.bankBrand}</p>
        <p className="mt-0.5 break-all font-mono text-caption text-text-muted">
          {transaction.accountNumber}
        </p>
      </TableCell>
      <TableCell className="w-[136px]"><SepayAccountPurposeBadge purpose={transaction.accountPurpose} /></TableCell>
      <TableCell className="w-[286px] break-words font-mono text-caption text-text-default">
        {transaction.transferContent}
      </TableCell>
      <TableCell className="w-[134px] text-right tabular-nums font-semibold text-text-strong">
        {formatVnd(transaction.amountVnd)}
      </TableCell>
      <TableCell className="w-[180px]">
        <SepayMatchBadge status={transaction.matchStatus} />
      </TableCell>
      <TableCell className="w-[170px] text-secondary text-text-muted">
        <SepayReference transaction={transaction} />
      </TableCell>
      <TableCell className="w-[160px]">
        <div className="flex flex-col items-start gap-2">
          <SepayManualAllocation actions={actions} canAllocate={canAllocate} transaction={transaction} />
          {canReverse ? <SepayAllocationReversalDialog actions={actions} transaction={transaction} /> : null}
          {canReconcile ? (
            <SepayReconciliationActions
              onOpenDialog={onOpenReconciliation}
              transaction={transaction}
            />
          ) : null}
        </div>
      </TableCell>
    </tr>
  );
}

function SepayTransactionRecord({
  actions,
  canAllocate,
  canReconcile,
  canReverse,
  onOpenReconciliation,
  transaction,
}: {
  actions?: SepayActionOverrides;
  canAllocate?: boolean;
  canReconcile?: boolean;
  canReverse?: boolean;
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
  transaction: SepayTransactionReadModel;
}) {
  return (
    <article
      className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="tabular-nums text-body font-semibold text-text-strong">
          {formatVnd(transaction.amountVnd)}
        </p>
        <SepayMatchBadge status={transaction.matchStatus} />
      </div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p className="font-mono text-caption font-semibold text-text-default">
          {transaction.bankTransactionId}
        </p>
        <p>Nguồn: {getSepaySourceLabel(transaction.ingestionSource)}{transaction.referenceNumber ? ` · Ref: ${transaction.referenceNumber}` : ""}</p>
        <p className="tabular-nums text-caption">
          {formatDateTime(transaction.transactionAt)}
        </p>
        <p>
          <span className="font-medium text-text-default">Ngân hàng · STK:</span>{" "}
          {transaction.bankBrand} · {transaction.accountNumber}
        </p>
        <p><span className="font-medium text-text-default">Tài khoản nhận:</span> <SepayAccountPurposeBadge purpose={transaction.accountPurpose} /></p>
        <p className="break-words font-mono text-caption text-text-default">
          {transaction.transferContent}
        </p>
        <p>
          <span className="font-medium text-text-default">Tham chiếu:</span>{" "}
          <SepayReference transaction={transaction} />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
          <SepayManualAllocation actions={actions} canAllocate={canAllocate} transaction={transaction} />
          {canReverse ? <SepayAllocationReversalDialog actions={actions} transaction={transaction} /> : null}
          {canReconcile ? (
            <SepayReconciliationActions
              onOpenDialog={onOpenReconciliation}
              transaction={transaction}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function getSepaySourceLabel(source: SepayTransactionReadModel["ingestionSource"]): string {
  switch (source) {
    case "api_v2": return "Lịch sử API";
    case "reconciled": return "Webhook + API";
    case "webhook": return "Webhook";
  }
}

export function SepayPagination({
  accountPurposeFilter,
  page,
  pageSize,
  queue,
  total,
}: {
  accountPurposeFilter: SepayAccountPurposeFilter;
  page: number;
  pageSize: number;
  queue: SepayQueueFilter;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const href = (target: number) => `/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, queue, target) || "?page=1"}`;

  return (
    <nav aria-label="Phân trang giao dịch SePay" className="flex items-center justify-end gap-2">
      {page > 1 ? <Link className="inline-flex min-h-11 items-center rounded-md border border-border-subtle px-3 py-2 text-control font-semibold sm:min-h-0" href={href(page - 1)}>Trang trước</Link> : null}
      <span className="text-secondary text-text-muted">Trang {page}/{pageCount}</span>
      {page < pageCount ? <Link className="inline-flex min-h-11 items-center rounded-md border border-border-subtle px-3 py-2 text-control font-semibold sm:min-h-0" href={href(page + 1)}>Trang sau</Link> : null}
    </nav>
  );
}

/** Receiving-account purpose filter; keeps the current tab (queue). */
export function SepayPurposeFilterNav({
  purpose,
  queue,
}: {
  purpose: SepayAccountPurposeFilter;
  queue: SepayQueueFilter;
}) {
  return (
    <nav aria-label="Lọc mục đích tài khoản nhận" className="flex flex-wrap gap-2">
      <SepayPurposeFilterLink active={purpose === ""} purpose="" queue={queue}>Tất cả tài khoản</SepayPurposeFilterLink>
      <SepayPurposeFilterLink active={purpose === "new_enrollment"} purpose="new_enrollment" queue={queue}>Tuyển mới</SepayPurposeFilterLink>
      <SepayPurposeFilterLink active={purpose === "renewal"} purpose="renewal" queue={queue}>Tái phí</SepayPurposeFilterLink>
      <SepayPurposeFilterLink active={purpose === "unknown"} purpose="unknown" queue={queue}>Chưa xác định</SepayPurposeFilterLink>
    </nav>
  );
}

function SepayPurposeFilterLink({
  active,
  children,
  purpose,
  queue,
}: {
  active: boolean;
  children: ReactNode;
  purpose: SepayAccountPurposeFilter;
  queue: SepayQueueFilter;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      // Soft active chip (HANDOFF §2): the page keeps one filled primary. Text colours are
      // important because the unlayered global `a { color: inherit }` beats utilities on links.
      className={`inline-flex min-h-11 items-center rounded-md border px-3 text-control font-semibold transition-colors sm:h-9 sm:min-h-9 ${active ? "border-action-primary bg-action-primary-soft text-action-primary!" : "border-border-subtle bg-surface-base text-text-muted! hover:bg-interactive-hover hover:text-text-strong!"}`}
      href={`/finance/sepay${getSepayDirectoryQuery(purpose, queue)}`}
    >
      {children}
    </Link>
  );
}

export function SepayMatchBadge({
  status,
}: {
  status: SepayTransactionReadModel["matchStatus"];
}) {
  const presentation = getSepayMatchPresentation(status);

  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

export function SepayAccountPurposeBadge({
  purpose,
}: {
  purpose: SepayTransactionReadModel["accountPurpose"];
}) {
  const presentation = getSepayAccountPurposePresentation(purpose);
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

export function SepayReference({
  transaction,
}: {
  transaction: SepayTransactionReadModel;
}) {
  if (!transaction.matchedPaymentRequestCode && !transaction.matchedStudentFullName) {
    return <span>Chưa có tham chiếu</span>;
  }

  return (
    <>
      {transaction.matchedPaymentRequestCode ?? "Chưa có mã yêu cầu"}
      {transaction.matchedStudentFullName
        ? ` · ${transaction.matchedStudentFullName}`
        : ""}
    </>
  );
}

function TableHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`h-14 px-3 align-middle text-table-body ${className}`}>{children}</td>;
}
