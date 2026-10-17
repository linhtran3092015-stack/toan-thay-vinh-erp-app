"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { getButtonClassName } from "@/components/ui/button";
import { PaymentRequestCancelDialog } from "@/features/finance/components/payment-request-cancel-dialog";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import type { PaymentRequestActionOverrides } from "@/features/finance/payment-request-action-overrides";
import {
  canCancelPaymentRequest,
  describePaymentRequestBalance,
  describePaymentRequestBonus,
  describePaymentRequestSessionExtras,
  describePaymentRequestUnitPrice,
  getPaymentRequestTopupLabel,
  isPaymentRequestOverdue,
  keepTogether,
  PAYMENT_REQUEST_OVERDUE_CAPTION,
} from "@/features/finance/payment-request-directory-models";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";
import { formatDateTime, formatShortDateTime, getVietnamToday } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";

const CAPTION = "Danh sách yêu cầu thanh toán";

interface PaymentRequestTableProps {
  /** Server-action override for the /dev preview; the real page passes nothing. */
  actions?: PaymentRequestActionOverrides;
  /** `payments.manage`: pending rows with nothing paid get "Hủy phiếu". */
  canCancel?: boolean;
  /** `students.view`: the student name opens the profile. Default true (today's behaviour). */
  canViewStudents?: boolean;
  /** In-frame state (and the card-list replacement) shown when `items` is empty. */
  empty?: ReactNode;
  /** Frame footer (the frame pager). */
  footer?: ReactNode;
  items: PaymentRequestReadModel[];
  /** Under the cards (the standalone pager). */
  listFooter?: ReactNode;
  /** ISO timestamp of the server render; decides "chờ quá 14 ngày" (fallback: one client clock read). */
  now?: string;
  /** A cancel dialog opened (the page drops its last notice). */
  onCancelOpen?: () => void;
  /** A cancel succeeded (the page shows its notice). */
  onCancelled?: (item: PaymentRequestReadModel) => void;
  /** Vietnam business date `YYYY-MM-DD`; decides whether short dates carry a year. */
  today?: string;
}

interface RowContext {
  actions?: PaymentRequestActionOverrides;
  canCancel: boolean;
  canViewStudents: boolean;
  nowMs: number;
  onCancelOpen?: () => void;
  onCancelled?: (item: PaymentRequestReadModel) => void;
  today: string;
}

/**
 * Framed table from the 1120px work-area threshold (globals.css: the 1118px
 * floor + the frame border), labelled cards below; both stay in the DOM.
 * Column floors sum to 1118px (content = width − 24px padding, 28px for the
 * first and last column):
 * - Mã 200: the full `PAY-YYMMDD-XXXXXXXXXXXX` (~166px in 12px mono) over
 *   "{loại} · tạo {giờ}" (the time part never breaks; the line may wrap before
 *   it). Transfer code and full creation time sit in `title`s.
 * - Học sinh takes the rest (172 with Thao tác, 280 without).
 * - Phụ huynh 110 (name truncates with a title; a 10-digit phone ~79px).
 * - Số buổi 108: "20 buổi mua" (~81px, "buổi mua" never splits) over "+2 tặng".
 * - Phải thu 124: the amount over the unit price ("140.000 ₫/buổi", ~98px).
 * - Đã thu 132: the amount over "Còn X" / "Thừa X" and, on paid rows,
 *   "thanh toán {giờ}" (wraps before the time; ~147px on one line).
 * - Trạng thái 164: the widest badge "Thanh toán một phần" (~140px) and
 *   "chờ quá 14 ngày".
 * - Thao tác 108, only with `canCancel`: one 32px "Hủy phiếu" (the student
 *   name is the profile link, so no second control).
 */
export function PaymentRequestTable({
  actions,
  canCancel = false,
  canViewStudents = true,
  empty,
  footer,
  items,
  listFooter,
  now,
  onCancelOpen,
  onCancelled,
  today,
}: PaymentRequestTableProps) {
  // Tests and previews may omit the server clock; read it once so renders agree.
  const [fallbackClock] = useState(() => ({ now: new Date().toISOString(), today: getVietnamToday() }));
  const context: RowContext = {
    actions,
    canCancel,
    canViewStudents,
    nowMs: Date.parse(now ?? fallbackClock.now),
    onCancelOpen,
    onCancelled,
    today: today ?? fallbackClock.today,
  };
  const isEmpty = items.length === 0 && empty !== undefined;

  return (
    <div className="payment-request-results-work-area grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <DataTableFrame
        body={items.map((item) => <PaymentRequestTableRow context={context} item={item} key={item.id} />)}
        caption={CAPTION}
        className="payment-request-directory-table"
        empty={empty}
        footer={footer}
        header={(
          <tr>
            <TableHeaderCell className="w-[200px]" title="Mã phiếu, loại nạp và giờ tạo (giờ Việt Nam); rê chuột lên mã để xem mã chuyển khoản">Mã</TableHeaderCell>
            <TableHeaderCell>Học sinh</TableHeaderCell>
            <TableHeaderCell className="w-[110px]">Phụ huynh</TableHeaderCell>
            <TableHeaderCell className="w-[108px]" title="Số buổi mua và buổi tặng ghi trên phiếu">Số buổi</TableHeaderCell>
            <TableHeaderCell className="w-[124px]" numeric title="Số tiền và đơn giá ghi trên phiếu">Phải thu</TableHeaderCell>
            <TableHeaderCell className="w-[132px]" numeric title="Tiền đã nhận; số còn thiếu hoặc thừa, giờ thanh toán (giờ Việt Nam)">Đã thu</TableHeaderCell>
            <TableHeaderCell className="w-[164px]">Trạng thái</TableHeaderCell>
            {canCancel ? <TableHeaderCell className="w-[108px]" numeric>Thao tác</TableHeaderCell> : null}
          </tr>
        )}
        status={isEmpty ? "empty" : "ready"}
        tableClassName="min-w-[1118px] table-fixed"
      />

      <div className="payment-request-directory-record-list gap-2">
        {isEmpty ? (
          <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">{empty}</div>
        ) : (
          <>
            <ResponsiveRecordList label={CAPTION}>
              {items.map((item) => <PaymentRequestRecord context={context} item={item} key={item.id} />)}
            </ResponsiveRecordList>
            {listFooter}
          </>
        )}
      </div>
    </div>
  );
}

function getRowFacts(item: PaymentRequestReadModel, { nowMs, today }: Pick<RowContext, "nowMs" | "today">) {
  const topup = getPaymentRequestTopupLabel(item.topupType);
  return {
    balance: describePaymentRequestBalance(item),
    bonus: describePaymentRequestBonus(item),
    createdAt: keepTogether(formatShortDateTime(item.createdAt, today)),
    createdAtFull: formatDateTime(item.createdAt),
    extras: describePaymentRequestSessionExtras(item),
    guardianName: item.guardianFullName ?? "Chưa cập nhật",
    guardianPhone: item.guardianPhone ?? "Chưa có SĐT",
    overdue: isPaymentRequestOverdue(item, nowMs),
    paidAt: item.paidAt ? keepTogether(formatShortDateTime(item.paidAt, today)) : null,
    paidAtFull: item.paidAt ? formatDateTime(item.paidAt) : null,
    topup,
    unitPrice: describePaymentRequestUnitPrice(item),
  };
}

function profileLabel(item: PaymentRequestReadModel): string {
  return `Mở hồ sơ học viên ${item.studentFullName}`;
}

function PaymentRequestTableRow({ context, item }: { context: RowContext; item: PaymentRequestReadModel }) {
  const facts = getRowFacts(item, context);

  return (
    <TableRow tall>
      <TableCell className="py-2">
        <span className="block truncate font-mono text-caption font-medium text-text-strong" title={`Mã chuyển khoản: ${item.transferCode}`}>
          {item.publicCode}
        </span>
        <span className="block text-caption text-text-muted" title={`Tạo lúc ${facts.createdAtFull}`}>
          {facts.topup} · <span className="whitespace-nowrap tabular-nums">tạo {facts.createdAt}</span>
        </span>
      </TableCell>
      <TableCell className="py-2">
        {context.canViewStudents && item.studentId ? (
          <Link
            aria-label={profileLabel(item)}
            className="block max-w-full truncate rounded-sm font-semibold text-text-strong! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            href={`/students/${item.studentId}`}
            title={item.studentFullName}
          >
            {item.studentFullName}
          </Link>
        ) : (
          <span className="block truncate font-semibold text-text-strong" title={item.studentFullName}>{item.studentFullName}</span>
        )}
        <span className="block truncate text-caption tabular-nums text-text-muted">{item.studentPublicCode || "—"}</span>
      </TableCell>
      <TableCell className="py-2">
        <span className="block truncate text-secondary text-text-default" title={facts.guardianName}>{facts.guardianName}</span>
        <span className="block truncate text-caption tabular-nums text-text-muted">{facts.guardianPhone}</span>
      </TableCell>
      <TableCell className="py-2">
        <p className="text-secondary text-text-muted">
          <span className="font-semibold tabular-nums text-text-strong">{item.purchasedSessions}</span>{" buổi\u00a0mua"}
        </p>
        {facts.bonus ? <p className="text-caption tabular-nums text-text-muted">{facts.bonus}</p> : null}
      </TableCell>
      <TableCell className="py-2" numeric>
        <span className="block font-semibold text-text-strong">{formatVnd(item.expectedAmountVnd)}</span>
        {facts.unitPrice ? <span className="block whitespace-nowrap text-caption text-text-muted">{facts.unitPrice}</span> : null}
      </TableCell>
      <TableCell className="py-2" numeric>
        <span className="block font-semibold text-text-strong">{formatVnd(item.paidAmountVnd)}</span>
        {facts.balance ? <span className="block text-caption text-text-muted">{facts.balance}</span> : null}
        {facts.paidAt ? (
          <span className="block text-caption text-text-muted" title={`Thanh toán lúc ${facts.paidAtFull}`}>
            thanh toán <span className="whitespace-nowrap">{facts.paidAt}</span>
          </span>
        ) : null}
      </TableCell>
      <TableCell className="py-2">
        <div className="grid justify-items-start gap-0.5">
          <PaymentRequestStatusBadge status={item.status} />
          {facts.overdue ? <span className="text-caption font-medium text-warning">{PAYMENT_REQUEST_OVERDUE_CAPTION}</span> : null}
        </div>
      </TableCell>
      {context.canCancel ? (
        <TableCell className="py-2" numeric>
          {canCancelPaymentRequest(item) ? (
            // px-2!: the 108px cell holds the 32px trigger with its full label.
            <PaymentRequestCancelDialog
              actions={context.actions}
              item={item}
              onCancelled={context.onCancelled}
              onOpen={context.onCancelOpen}
              triggerClassName="px-2!"
              triggerSize="sm"
            />
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/** Phone/narrow card: non-link (no request detail route); profile link and cancel as 44px controls. */
function PaymentRequestRecord({ context, item }: { context: RowContext; item: PaymentRequestReadModel }) {
  const facts = getRowFacts(item, context);
  const canOpenProfile = context.canViewStudents && Boolean(item.studentId);
  const canCancel = context.canCancel && canCancelPaymentRequest(item);
  const sessions = [`${item.purchasedSessions} buổi mua`, ...facts.extras].join(" · ");

  return (
    <article
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)]"
      role="listitem"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The card's identity: wraps instead of truncating (the table cell truncates with a title). */}
          <p className="min-w-0 break-words text-body font-semibold text-text-strong">{item.studentFullName}</p>
          <p className="break-all font-mono text-caption font-semibold text-text-muted">{item.publicCode}</p>
        </div>
        <div className="grid shrink-0 justify-items-end gap-0.5">
          <PaymentRequestStatusBadge status={item.status} />
          {facts.overdue ? <span className="text-caption font-medium text-warning">{PAYMENT_REQUEST_OVERDUE_CAPTION}</span> : null}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-secondary">
        <dt className="text-text-muted">Phải thu</dt>
        <dd className="font-semibold tabular-nums text-text-strong">{formatVnd(item.expectedAmountVnd)}</dd>
        <dt className="text-text-muted">Đã thu</dt>
        <dd className="tabular-nums text-text-strong">
          <span className="font-semibold">{formatVnd(item.paidAmountVnd)}</span>
          {facts.balance ? <span className="text-text-muted"> · {facts.balance}</span> : null}
        </dd>
        <dt className="text-text-muted">Số buổi</dt>
        <dd className="tabular-nums text-text-default">{sessions}</dd>
        <dt className="text-text-muted">Phụ huynh</dt>
        <dd className="break-words text-text-default">
          {facts.guardianName} · <span className="tabular-nums">{facts.guardianPhone}</span>
        </dd>
        <dt className="text-text-muted">Loại · mã CK</dt>
        <dd className="min-w-0 text-text-default">
          {facts.topup} · <span className="break-all font-mono text-caption">{item.transferCode}</span>
        </dd>
        <dt className="text-text-muted">Tạo lúc</dt>
        <dd className="tabular-nums text-text-default">
          {facts.createdAt}
          {facts.paidAt ? <span className="text-text-muted"> · thanh toán {facts.paidAt}</span> : null}
        </dd>
      </dl>

      {canOpenProfile || canCancel ? (
        // Auto-width 44px controls on the right; they share the row only in a narrow container.
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border-row pt-3">
          {canOpenProfile ? (
            <Link
              aria-label={profileLabel(item)}
              className={getButtonClassName({ className: "text-text-strong! @max-[480px]:flex-1", size: "lg", variant: "secondary" })}
              href={`/students/${item.studentId}`}
            >
              Mở hồ sơ
            </Link>
          ) : null}
          {canCancel ? (
            <PaymentRequestCancelDialog
              actions={context.actions}
              item={item}
              onCancelled={context.onCancelled}
              onOpen={context.onCancelOpen}
              triggerClassName="@max-[480px]:flex-1"
              triggerSize="lg"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
