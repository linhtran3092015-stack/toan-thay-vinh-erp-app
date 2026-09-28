"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { getSepayAccountPurposeQuery, type SepayAccountPurposeFilter } from "@/features/finance/sepay-transaction-url-state";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import { SepayReconciliationActions, type SepayReconciliationCandidateView } from "@/features/finance/components/sepay-reconciliation-actions";
import { SepayManualAllocation } from "@/features/finance/components/sepay-manual-allocation";
import { SepayReconciliationDialog } from "@/features/finance/components/sepay-reconciliation-dialog";

interface SepayTransactionHistoryProps {
  accountPurposeFilter?: SepayAccountPurposeFilter;
  canAllocate?: boolean;
  canReconcile?: boolean;
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
      return { label: "Chưa khớp", tone: "neutral" };
  }
}

/** Paginated SePay transaction history with permission-gated reconciliation. */
export function SepayTransactionHistory({
  accountPurposeFilter = "",
  canAllocate = false,
  canReconcile = false,
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
      <PageHeader title="Giao dịch SePay">
        <p className="mt-1 text-secondary text-text-muted">
          Lịch sử giao dịch ngân hàng được SePay ghi nhận.
        </p>
      </PageHeader>

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
        <nav aria-label="Lọc mục đích tài khoản nhận" className="flex flex-wrap gap-2">
          <SepayPurposeFilterLink active={accountPurposeFilter === ""} purpose="">Tất cả tài khoản</SepayPurposeFilterLink>
          <SepayPurposeFilterLink active={accountPurposeFilter === "new_enrollment"} purpose="new_enrollment">Tuyển mới</SepayPurposeFilterLink>
          <SepayPurposeFilterLink active={accountPurposeFilter === "renewal"} purpose="renewal">Tái phí</SepayPurposeFilterLink>
          <SepayPurposeFilterLink active={accountPurposeFilter === "unknown"} purpose="unknown">Chưa xác định</SepayPurposeFilterLink>
        </nav>
        <p
          aria-live="polite"
          className="text-secondary text-text-muted"
          id="sepay-transaction-result-context"
        >
          Hiển thị {transactions.length} trong tổng số {total} giao dịch.
        </p>

        {transactions.length === 0 ? (
          <EmptyState
            description="Chưa có giao dịch SePay nào được ghi nhận."
            title="Chưa có giao dịch SePay"
          />
        ) : (
          <SepayTransactionTable
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            candidates={candidates}
            onOpenReconciliation={handleOpenReconciliation}
            transactions={transactions}
          />
        )}
        <SepayPagination accountPurposeFilter={accountPurposeFilter} page={page} pageSize={pageSize} total={total} />
      </section>

      {canReconcile ? (
        <SepayReconciliationDialog
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
  canAllocate,
  canReconcile,
  candidates,
  onOpenReconciliation,
  transactions,
}: Pick<SepayTransactionHistoryProps, "canAllocate" | "canReconcile" | "candidates" | "transactions"> & {
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
}) {
  return (
    <div className="sepay-transaction-results-work-area">
      <DataTableFrame
        body={transactions.map((transaction) => (
          <SepayTransactionTableRow
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            candidates={candidates}
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
            canAllocate={canAllocate}
            canReconcile={canReconcile}
            candidates={candidates}
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
  canAllocate,
  canReconcile,
  candidates,
  onOpenReconciliation,
  transaction,
}: {
  canAllocate?: boolean;
  canReconcile?: boolean;
  candidates?: SepayReconciliationCandidateView[];
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
  transaction: SepayTransactionReadModel;
}) {
  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[142px] font-mono text-caption font-semibold text-text-muted">
        {transaction.bankTransactionId}
        <span className="mt-1 block font-sans font-normal text-text-muted">{getSourceLabel(transaction.ingestionSource)}</span>
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
        {formatCurrency(transaction.amountVnd)}
      </TableCell>
      <TableCell className="w-[180px]">
        <SepayMatchBadge status={transaction.matchStatus} />
      </TableCell>
      <TableCell className="w-[170px] text-secondary text-text-muted">
        <SepayReference transaction={transaction} />
      </TableCell>
      <TableCell className="w-[160px]">
        <div className="flex flex-col items-start gap-2">
          <SepayManualAllocation canAllocate={canAllocate} transaction={transaction} />
          {canReconcile ? (
            <SepayReconciliationActions
              candidates={candidates ?? []}
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
  canAllocate,
  canReconcile,
  candidates,
  onOpenReconciliation,
  transaction,
}: {
  canAllocate?: boolean;
  canReconcile?: boolean;
  candidates?: SepayReconciliationCandidateView[];
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
          {formatCurrency(transaction.amountVnd)}
        </p>
        <SepayMatchBadge status={transaction.matchStatus} />
      </div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p className="font-mono text-caption font-semibold text-text-default">
          {transaction.bankTransactionId}
        </p>
        <p>Nguồn: {getSourceLabel(transaction.ingestionSource)}{transaction.referenceNumber ? ` · Ref: ${transaction.referenceNumber}` : ""}</p>
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
          <SepayManualAllocation canAllocate={canAllocate} transaction={transaction} />
          {canReconcile ? (
            <SepayReconciliationActions
              candidates={candidates ?? []}
              onOpenDialog={onOpenReconciliation}
              transaction={transaction}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getSourceLabel(source: SepayTransactionReadModel["ingestionSource"]): string {
  switch (source) {
    case "api_v2": return "Lịch sử API";
    case "reconciled": return "Webhook + API";
    case "webhook": return "Webhook";
  }
}

function SepayPagination({
  accountPurposeFilter,
  page,
  pageSize,
  total,
}: {
  accountPurposeFilter: SepayAccountPurposeFilter;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (accountPurposeFilter) params.set("accountPurpose", accountPurposeFilter);
    params.set("page", String(target));
    return `/finance/sepay?${params.toString()}`;
  };

  return (
    <nav aria-label="Phân trang giao dịch SePay" className="flex items-center justify-end gap-2">
      {page > 1 ? <Link className="rounded-md border border-border-subtle px-3 py-2 text-control font-semibold" href={href(page - 1)}>Trang trước</Link> : null}
      <span className="text-secondary text-text-muted">Trang {page}/{pageCount}</span>
      {page < pageCount ? <Link className="rounded-md border border-border-subtle px-3 py-2 text-control font-semibold" href={href(page + 1)}>Trang sau</Link> : null}
    </nav>
  );
}

function SepayPurposeFilterLink({
  active,
  children,
  purpose,
}: {
  active: boolean;
  children: ReactNode;
  purpose: SepayAccountPurposeFilter;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 items-center rounded-md border px-3 text-control font-semibold transition-colors ${active ? "border-action-primary bg-action-primary text-text-on-primary" : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover hover:text-text-strong"}`}
      href={`/finance/sepay${getSepayAccountPurposeQuery(purpose)}`}
    >
      {children}
    </Link>
  );
}

function SepayMatchBadge({
  status,
}: {
  status: SepayTransactionReadModel["matchStatus"];
}) {
  const presentation = getSepayMatchPresentation(status);

  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

function SepayAccountPurposeBadge({
  purpose,
}: {
  purpose: SepayTransactionReadModel["accountPurpose"];
}) {
  const presentation = getSepayAccountPurposePresentation(purpose);
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

function SepayReference({
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

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDateTime(value: string): string {
  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime()) ? value : dateTimeFormatter.format(timestamp);
}
