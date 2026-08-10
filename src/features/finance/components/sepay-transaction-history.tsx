import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";

interface SepayTransactionHistoryProps {
  transactions: SepayTransactionReadModel[];
}

type SepayMatchTone = "info" | "neutral" | "success" | "warning";

interface SepayMatchPresentation {
  label: string;
  tone: SepayMatchTone;
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
      return { label: "Đã phân bổ nhiều học viên", tone: "info" };
    case "amount_mismatch":
      return { label: "Sai số tiền – cần đối soát", tone: "warning" };
    case "unmatched":
      return { label: "Chưa khớp", tone: "neutral" };
  }
}

/** Read-only presentation of the existing 100-row SePay transaction read. */
export function SepayTransactionHistory({
  transactions,
}: SepayTransactionHistoryProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Giao dịch SePay">
        <p className="mt-1 text-secondary text-text-muted">
          Lịch sử giao dịch ngân hàng được SePay ghi nhận.
        </p>
      </PageHeader>

      <section
        aria-labelledby="sepay-transaction-result-context"
        className="sepay-transaction-operational-work-area grid min-w-0 gap-4"
      >
        <p
          aria-live="polite"
          className="text-secondary text-text-muted"
          id="sepay-transaction-result-context"
        >
          Hiển thị {transactions.length} giao dịch SePay mới nhất (tối đa 100).
        </p>

        {transactions.length === 0 ? (
          <EmptyState
            description="Chưa có giao dịch SePay nào được ghi nhận."
            title="Chưa có giao dịch SePay"
          />
        ) : (
          <SepayTransactionTable transactions={transactions} />
        )}
      </section>
    </div>
  );
}

function SepayTransactionTable({
  transactions,
}: SepayTransactionHistoryProps) {
  return (
    <div className="sepay-transaction-results-work-area">
      <DataTableFrame
        body={transactions.map((transaction) => (
          <SepayTransactionTableRow key={transaction.id} transaction={transaction} />
        ))}
        caption="Danh sách giao dịch SePay mới nhất"
        className="sepay-transaction-directory-table"
        header={
          <tr>
            <TableHeader>Mã giao dịch</TableHeader>
            <TableHeader>Thời gian</TableHeader>
            <TableHeader>Ngân hàng · STK</TableHeader>
            <TableHeader>Nội dung chuyển khoản</TableHeader>
            <TableHeader className="text-right">Số tiền</TableHeader>
            <TableHeader>Trạng thái khớp</TableHeader>
            <TableHeader>Tham chiếu hiện có</TableHeader>
          </tr>
        }
        tableClassName="min-w-[1200px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="sepay-transaction-directory-record-list"
        label="Danh sách giao dịch SePay mới nhất"
      >
        {transactions.map((transaction) => (
          <SepayTransactionRecord key={transaction.id} transaction={transaction} />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function SepayTransactionTableRow({
  transaction,
}: {
  transaction: SepayTransactionReadModel;
}) {
  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[142px] font-mono text-caption font-semibold text-text-muted">
        {transaction.bankTransactionId}
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
    </tr>
  );
}

function SepayTransactionRecord({
  transaction,
}: {
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
        <p className="tabular-nums text-caption">
          {formatDateTime(transaction.transactionAt)}
        </p>
        <p>
          <span className="font-medium text-text-default">Ngân hàng · STK:</span>{" "}
          {transaction.bankBrand} · {transaction.accountNumber}
        </p>
        <p className="break-words font-mono text-caption text-text-default">
          {transaction.transferContent}
        </p>
        <p>
          <span className="font-medium text-text-default">Tham chiếu:</span>{" "}
          <SepayReference transaction={transaction} />
        </p>
      </div>
    </article>
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
