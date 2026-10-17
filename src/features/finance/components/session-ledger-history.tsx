import Link from "next/link";
import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";
import { formatDateTime } from "@/lib/datetime";

interface SessionLedgerHistoryProps {
  entries: CenterSessionLedgerEntryReadModel[];
}

const entryTypeLabels: Record<string, string> = {
  annual_carryover: "Kết chuyển năm",
  bonus_credit: "Thưởng buổi",
  manual_adjustment: "Điều chỉnh thủ công",
  payment_credit: "Nạp học phí",
  refund_debit: "Hoàn phí",
  session_charge: "Trừ buổi học",
  session_reversal: "Đảo trừ",
  transfer_in: "Chuyển buổi đến",
  transfer_out: "Chuyển buổi đi",
};

/** Finance-local event wording. A ledger event is not a balance or lifecycle status. */
export function getLedgerEntryLabel(entryType: string): string {
  return Object.hasOwn(entryTypeLabels, entryType)
    ? entryTypeLabels[entryType]
    : `Loại phát sinh chưa hỗ trợ: ${entryType}`;
}

/** Read-only audit presentation for the existing latest-100 ledger-entry read. */
export function SessionLedgerHistory({ entries }: SessionLedgerHistoryProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Sổ cái số buổi">
        <p className="mt-1 text-secondary text-text-muted">
          Nhật ký các biến động số buổi học đã được ghi nhận.
        </p>
      </PageHeader>

      <section
        aria-labelledby="session-ledger-result-context"
        className="session-ledger-operational-work-area grid min-w-0 gap-4"
      >
        <p
          className="text-secondary text-text-muted"
          id="session-ledger-result-context"
        >
          Hiển thị {entries.length} mục sổ cái mới nhất (tối đa 100).
        </p>

        {entries.length === 0 ? (
          <EmptyState
            description="Chưa có mục sổ cái số buổi nào được ghi nhận."
            title="Chưa có mục sổ cái"
          />
        ) : (
          <SessionLedgerEntries entries={entries} />
        )}
      </section>
    </div>
  );
}

function SessionLedgerEntries({ entries }: SessionLedgerHistoryProps) {
  return (
    <div className="session-ledger-results-work-area">
      <DataTableFrame
        body={entries.map((entry) => <SessionLedgerTableRow entry={entry} key={entry.id} />)}
        caption="Danh sách mục sổ cái số buổi mới nhất"
        className="session-ledger-directory-table"
        header={
          <tr>
            <TableHeader>Ngày hiệu lực</TableHeader>
            <TableHeader>Học viên</TableHeader>
            <TableHeader>Loại phát sinh</TableHeader>
            <TableHeader className="text-right">Số buổi</TableHeader>
            <TableHeader className="text-right">Đơn giá</TableHeader>
            <TableHeader>Tham chiếu</TableHeader>
            <TableHeader>Ghi chú</TableHeader>
          </tr>
        }
        tableClassName="min-w-[1080px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="session-ledger-directory-record-list"
        label="Danh sách mục sổ cái số buổi mới nhất"
      >
        {entries.map((entry) => <SessionLedgerRecord entry={entry} key={entry.id} />)}
      </ResponsiveRecordList>
    </div>
  );
}

function SessionLedgerTableRow({ entry }: { entry: CenterSessionLedgerEntryReadModel }) {
  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[146px] tabular-nums text-secondary text-text-muted">
        <p>{formatDate(entry.effectiveOn)}</p>
        <p className="mt-0.5 text-caption">Ghi nhận {formatDateTime(entry.createdAt)}</p>
      </TableCell>
      <TableCell className="w-[180px]">
        <StudentIdentity entry={entry} />
      </TableCell>
      <TableCell className="w-[156px] font-medium text-text-default">
        {getLedgerEntryLabel(entry.entryType)}
      </TableCell>
      <TableCell className="w-[108px] text-right tabular-nums font-semibold text-text-strong">
        {formatDeltaSessions(entry.deltaSessions)}
      </TableCell>
      <TableCell className="w-[128px] text-right tabular-nums text-text-default">
        {formatUnitPrice(entry.unitPriceVnd)}
      </TableCell>
      <TableCell className="w-[146px] break-words font-mono text-caption text-text-default">
        {entry.referenceCode ?? "—"}
      </TableCell>
      <TableCell className="w-[216px] break-words text-secondary text-text-muted">
        {entry.note ?? "—"}
      </TableCell>
    </tr>
  );
}

function SessionLedgerRecord({ entry }: { entry: CenterSessionLedgerEntryReadModel }) {
  return (
    <article
      className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <StudentIdentity entry={entry} />
        <p className="shrink-0 tabular-nums text-body font-semibold text-text-strong">
          {formatDeltaSessions(entry.deltaSessions)}
        </p>
      </div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p className="font-medium text-text-default">{getLedgerEntryLabel(entry.entryType)}</p>
        <p>
          <span className="font-medium text-text-default">Ngày hiệu lực:</span>{" "}
          {formatDate(entry.effectiveOn)}
        </p>
        <p>
          <span className="font-medium text-text-default">Tham chiếu:</span>{" "}
          <span className="break-words font-mono text-caption text-text-default">
            {entry.referenceCode ?? "—"}
          </span>
        </p>
        {entry.unitPriceVnd > 0 ? (
          <p>
            <span className="font-medium text-text-default">Đơn giá:</span>{" "}
            <span className="tabular-nums text-text-default">{formatUnitPrice(entry.unitPriceVnd)}</span>
          </p>
        ) : null}
        <p className="break-words text-text-default">{entry.note ?? "—"}</p>
        <p className="tabular-nums text-caption">Ghi nhận {formatDateTime(entry.createdAt)}</p>
      </div>
    </article>
  );
}

function StudentIdentity({ entry }: { entry: CenterSessionLedgerEntryReadModel }) {
  return (
    <div className="min-w-0">
      <Link
        aria-label={`Mở hồ sơ học viên ${entry.studentFullName}`}
        className="font-semibold text-text-strong hover:text-action-primary hover:underline"
        href={`/students/${entry.studentId}`}
      >
        {entry.studentFullName}
      </Link>
      {entry.studentPublicCode ? (
        <p className="mt-0.5 font-mono text-caption text-text-muted">{entry.studentPublicCode}</p>
      ) : null}
    </div>
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

function formatDate(value: string): string {
  const parts = value.split("T")[0]?.split("-");

  return parts?.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function formatDeltaSessions(value: number): string {
  return `${value > 0 ? "+" : ""}${value} buổi`;
}

function formatUnitPrice(value: number): string {
  return value > 0 ? currencyFormatter.format(value) : "—";
}
