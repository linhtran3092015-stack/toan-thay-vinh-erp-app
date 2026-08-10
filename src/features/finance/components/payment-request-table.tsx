import type { ReactNode } from "react";
import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

interface PaymentRequestTableProps {
  items: PaymentRequestReadModel[];
}

export function PaymentRequestTable({ items }: PaymentRequestTableProps) {
  return (
    <div className="payment-request-results-work-area">
      <DataTableFrame
        body={items.map((item) => <PaymentRequestTableRow item={item} key={item.id} />)}
        caption="Danh sách yêu cầu thanh toán"
        className="payment-request-directory-table"
        header={(
          <tr>
            <TableHeader>Yêu cầu</TableHeader>
            <TableHeader>Học viên</TableHeader>
            <TableHeader>Phụ huynh</TableHeader>
            <TableHeader>Gói buổi học</TableHeader>
            <TableHeader className="text-right">Dự kiến</TableHeader>
            <TableHeader className="text-right">Đã nhận</TableHeader>
            <TableHeader>Nội dung CK</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Ngày tạo</TableHeader>
            <TableHeader className="text-right">Thao tác</TableHeader>
          </tr>
        )}
        tableClassName="min-w-[1280px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="payment-request-directory-record-list"
        label="Danh sách yêu cầu thanh toán"
      >
        {items.map((item) => <PaymentRequestRecord item={item} key={item.id} />)}
      </ResponsiveRecordList>
    </div>
  );
}

function PaymentRequestTableRow({ item }: { item: PaymentRequestReadModel }) {
  return (
    <tr className="transition-colors hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[122px]">
        <p className="tabular-nums text-body font-semibold text-text-strong">{item.publicCode}</p>
        <p className="mt-0.5 text-caption text-text-muted">{item.topupType === "renewal" ? "Tái phí" : "Tuyển mới"}</p>
      </TableCell>
      <TableCell className="w-[170px]">
        <p className="font-semibold text-text-strong">{item.studentFullName}</p>
        <p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.studentPublicCode}</p>
      </TableCell>
      <TableCell className="w-[180px]">
        <p className="font-medium text-text-default">{item.guardianFullName ?? "Chưa cập nhật"}</p>
        <p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.guardianPhone ?? "Chưa có SĐT"}</p>
      </TableCell>
      <TableCell className="w-[142px] text-secondary text-text-muted">
        <p><span className="tabular-nums font-semibold text-text-default">{item.purchasedSessions}</span> buổi mua</p>
        {item.bonusSessions > 0 ? <p className="mt-0.5 tabular-nums text-caption text-text-muted">+{item.bonusSessions} buổi tặng</p> : null}
      </TableCell>
      <TableCell className="w-[124px] text-right tabular-nums font-semibold text-text-strong">
        {formatCurrency(item.expectedAmountVnd)}
      </TableCell>
      <TableCell className="w-[124px] text-right tabular-nums">
        <p className="font-semibold text-text-strong">{formatCurrency(item.paidAmountVnd)}</p>
        {item.paidAmountVnd < item.expectedAmountVnd ? (
          <p className="mt-0.5 text-caption text-text-muted">Còn {formatCurrency(item.expectedAmountVnd - item.paidAmountVnd)}</p>
        ) : null}
      </TableCell>
      <TableCell className="w-[150px] break-all font-mono text-caption font-semibold text-action-link">{item.transferCode}</TableCell>
      <TableCell className="w-[150px]"><PaymentRequestStatusBadge status={item.status} /></TableCell>
      <TableCell className="w-[116px] tabular-nums text-secondary text-text-muted">{formatDate(item.createdAt)}</TableCell>
      <TableCell className="w-[120px] text-right">
        {item.studentId ? (
          <Link
            aria-label={`Mở hồ sơ học viên ${item.studentFullName}`}
            className="inline-flex h-8 items-center justify-center rounded-md px-2 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={`/students/${item.studentId}`}
          >
            Mở hồ sơ
          </Link>
        ) : <span className="text-caption text-text-subtle">Không có</span>}
      </TableCell>
    </tr>
  );
}

function PaymentRequestRecord({ item }: { item: PaymentRequestReadModel }) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold text-text-strong">{item.studentFullName}</p>
          <p className="mt-0.5 tabular-nums text-caption text-text-muted">{item.publicCode} · {item.studentPublicCode}</p>
        </div>
        <PaymentRequestStatusBadge status={item.status} />
      </div>

      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p><span className="font-medium text-text-default">Dự kiến:</span> <span className="tabular-nums font-semibold text-text-strong">{formatCurrency(item.expectedAmountVnd)}</span> · <span className="font-medium text-text-default">Đã nhận:</span> <span className="tabular-nums font-semibold text-text-strong">{formatCurrency(item.paidAmountVnd)}</span></p>
        <p><span className="tabular-nums">{item.purchasedSessions}</span> buổi mua{item.bonusSessions > 0 ? ` · +${item.bonusSessions} buổi tặng` : ""} · {item.topupType === "renewal" ? "Tái phí" : "Tuyển mới"}</p>
        <p>Phụ huynh: {item.guardianFullName ?? "Chưa cập nhật"}{item.guardianPhone ? ` · ${item.guardianPhone}` : ""}</p>
        <p className="break-all font-mono text-caption font-semibold text-action-link">{item.transferCode}</p>
        <p className="tabular-nums text-caption">Tạo ngày {formatDate(item.createdAt)}</p>
      </div>

      {item.studentId ? (
        <Link
          aria-label={`Mở hồ sơ học viên ${item.studentFullName}`}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
          href={`/students/${item.studentId}`}
        >
          Mở hồ sơ học viên
        </Link>
      ) : null}
    </article>
  );
}

function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">{children}</th>;
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`h-14 px-3 align-middle text-table-body ${className ?? ""}`}>{children}</td>;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}
