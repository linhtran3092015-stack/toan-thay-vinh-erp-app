"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setFinanceOrderReviewAction } from "@/features/finance/actions/finance-actions";
import {
  formatFinanceCurrency,
  formatFinanceDateTime,
  getFinanceOrderCostPresentation,
  getFinanceOrderSourceLabel,
  getFinanceOrderTypePresentation,
  getSettlementPeriodLabel,
} from "@/features/finance/finance-order-presentation";
import { serializeFinanceOrdersFilters } from "@/features/finance/finance-orders-url-state";
import type {
  FinanceOrderFiltersState,
  FinanceOrderReadModel,
  FinanceOrdersDashboardReadModel,
} from "@/features/finance/read-models";

interface FinanceOrdersPageProps {
  canReview: boolean;
  dashboard: FinanceOrdersDashboardReadModel;
  filters: FinanceOrderFiltersState;
}

export function FinanceOrdersPage({
  canReview,
  dashboard,
  filters,
}: FinanceOrdersPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<string | null>(null);

  function updateFilter<K extends keyof FinanceOrderFiltersState>(
    key: K,
    value: FinanceOrderFiltersState[K],
  ) {
    const next = serializeFinanceOrdersFilters(searchParams, { ...filters, [key]: value });
    router.replace(`/finance/orders?${next.toString()}`);
  }

  function updateReview(order: FinanceOrderReadModel, isChecked: boolean) {
    setReviewError(null);
    startTransition(async () => {
      const result = await setFinanceOrderReviewAction(
        order.sourceCashflowRecordId,
        isChecked,
      );

      if (result.status === "success") {
        setReviewOverrides((current) => ({
          ...current,
          [order.sourceCashflowRecordId]: isChecked,
        }));
        return;
      }

      setReviewError(result.message);
    });
  }

  const orders = dashboard.orders.map((order) => ({
    ...order,
    isChecked: reviewOverrides[order.sourceCashflowRecordId] ?? order.isChecked,
  }));

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Đơn hàng">
        <p className="mt-1 text-secondary text-text-muted">
          Doanh thu học phí theo từng khoản thu xác nhận; giao dịch SePay phân bổ nhiều học viên sẽ tạo nhiều đơn tương ứng.
        </p>
      </PageHeader>

      <section className="finance-orders-operational-work-area grid min-w-0 gap-4">
        <OrderFilters filters={filters} onChange={updateFilter} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tổng số đơn" value={String(dashboard.summary.orderCount)} />
          <SummaryCard label="Tổng học phí" value={formatFinanceCurrency(dashboard.summary.tuitionAmountVnd)} />
          <SummaryCard label="Chi phí vận hành" value={formatFinanceCurrency(dashboard.summary.operatingCostVnd)} />
          <SummaryCard
            label="Đã xác nhận"
            value={`${dashboard.summary.checkedCount}/${dashboard.summary.orderCount}`}
          />
        </div>

        {dashboard.summary.unconfiguredCount > 0 ? (
          <p className="rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-secondary text-warning" role="status">
            Có {dashboard.summary.unconfiguredCount} đơn chưa có chính sách chi phí vận hành. Các đơn này không được quy đổi thành 0 VND.
          </p>
        ) : null}

        {reviewError ? (
          <p className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-secondary text-danger" role="alert">
            {reviewError}
          </p>
        ) : null}

        <OrderResults
          canReview={canReview}
          isReviewPending={isPending}
          orders={orders}
          onReview={updateReview}
        />
      </section>

      <SettlementSection dashboard={dashboard} />
    </div>
  );
}

function OrderFilters({
  filters,
  onChange,
}: {
  filters: FinanceOrderFiltersState;
  onChange: <K extends keyof FinanceOrderFiltersState>(
    key: K,
    value: FinanceOrderFiltersState[K],
  ) => void;
}) {
  const controlClassName = "h-11 min-w-0 rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring";

  return (
    <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Tháng giao dịch</span>
        <input
          className={controlClassName}
          onChange={(event) => onChange("month", event.target.value)}
          type="month"
          value={filters.month}
        />
      </label>
      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Loại đơn</span>
        <select className={controlClassName} onChange={(event) => onChange("orderType", event.target.value as FinanceOrderFiltersState["orderType"])} value={filters.orderType}>
          <option value="">Tất cả loại đơn</option>
          <option value="new_enrollment">Tuyển mới</option>
          <option value="renewal">Tái phí</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Nguồn</span>
        <select className={controlClassName} onChange={(event) => onChange("source", event.target.value as FinanceOrderFiltersState["source"])} value={filters.source}>
          <option value="">Tất cả nguồn</option>
          <option value="mma">MMA</option>
          <option value="sb">SB</option>
          <option value="sb_f1">SB F1</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Đợt quyết toán</span>
        <select className={controlClassName} onChange={(event) => onChange("period", event.target.value as FinanceOrderFiltersState["period"])} value={filters.period}>
          <option value="">Cả tháng</option>
          <option value="1">Đợt 1 (01–10)</option>
          <option value="2">Đợt 2 (11–20)</option>
          <option value="3">Đợt 3 (21–cuối tháng)</option>
        </select>
      </label>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base p-4">
      <p className="text-label text-text-muted">{label}</p>
      <p className="mt-2 tabular-nums text-numeric font-semibold text-text-strong">{value}</p>
    </article>
  );
}

function OrderResults({
  canReview,
  isReviewPending,
  onReview,
  orders,
}: {
  canReview: boolean;
  isReviewPending: boolean;
  onReview: (order: FinanceOrderReadModel, isChecked: boolean) => void;
  orders: FinanceOrderReadModel[];
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        description="Không có khoản thu học phí đã xác nhận khớp với bộ lọc này."
        title="Chưa có đơn hàng"
      />
    );
  }

  return (
    <div className="finance-orders-results-work-area">
      <DataTableFrame
        body={orders.map((order) => (
          <OrderTableRow
            canReview={canReview}
            isReviewPending={isReviewPending}
            key={order.sourceCashflowRecordId}
            onReview={onReview}
            order={order}
          />
        ))}
        caption="Danh sách đơn hàng tài chính"
        className="finance-orders-directory-table"
        header={<OrderTableHeader />}
        tableClassName="min-w-[1880px] table-fixed text-table-body text-text-default"
      />
      <ResponsiveRecordList
        className="finance-orders-directory-record-list"
        label="Danh sách đơn hàng tài chính"
      >
        {orders.map((order) => (
          <OrderRecord
            canReview={canReview}
            isReviewPending={isReviewPending}
            key={order.sourceCashflowRecordId}
            onReview={onReview}
            order={order}
          />
        ))}
      </ResponsiveRecordList>
    </div>
  );
}

function OrderTableHeader() {
  return (
    <tr>
      <TableHeader>Thời gian · Mã</TableHeader>
      <TableHeader>Loại đơn</TableHeader>
      <TableHeader>Học viên · Lớp</TableHeader>
      <TableHeader>Phụ huynh</TableHeader>
      <TableHeader>SĐT phụ huynh</TableHeader>
      <TableHeader>Sale · Nguồn</TableHeader>
      <TableHeader className="text-right">Học phí</TableHeader>
      <TableHeader className="text-right">Chi phí vận hành</TableHeader>
      <TableHeader>Cơ chế · Đợt</TableHeader>
      <TableHeader>Nội dung chuyển khoản</TableHeader>
      <TableHeader>Xác nhận</TableHeader>
    </tr>
  );
}

function OrderTableRow({
  canReview,
  isReviewPending,
  onReview,
  order,
}: {
  canReview: boolean;
  isReviewPending: boolean;
  onReview: (order: FinanceOrderReadModel, isChecked: boolean) => void;
  order: FinanceOrderReadModel;
}) {
  const type = getFinanceOrderTypePresentation(order.orderType);
  const cost = getFinanceOrderCostPresentation(order);

  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[170px]">
        <p className="tabular-nums text-secondary text-text-muted">{formatFinanceDateTime(order.transactionAt)}</p>
        <p className="mt-0.5 break-all font-mono text-caption font-semibold text-text-default">{order.bankTransactionId}</p>
      </TableCell>
      <TableCell className="w-[130px]"><Badge tone={type.tone}>{type.label}</Badge></TableCell>
      <TableCell className="w-[210px]">
        <p className="font-semibold text-text-strong">{order.studentFullName}</p>
        <p className="mt-0.5 text-caption text-text-muted">{order.studentPublicCode} · {order.className ? `${order.classCode ?? ""} ${order.className}`.trim() : "Chưa xác định"}</p>
      </TableCell>
      <TableCell className="w-[165px] text-secondary text-text-muted">{order.guardianFullName ?? "Chưa xác định"}</TableCell>
      <TableCell className="w-[135px] tabular-nums text-secondary text-text-muted">{order.guardianPhone ?? "Chưa có SĐT"}</TableCell>
      <TableCell className="w-[185px]">
        <p className="font-medium text-text-default">{order.saleOwnerFullName ?? "Chưa xác định"}</p>
        <p className="mt-0.5 text-caption text-text-muted">{getFinanceOrderSourceLabel(order)}</p>
      </TableCell>
      <TableCell className="w-[148px] text-right tabular-nums font-semibold text-text-strong">{formatFinanceCurrency(order.tuitionAmountVnd)}</TableCell>
      <TableCell className="w-[165px] text-right tabular-nums text-text-default">{order.operatingCostVnd === null ? "—" : formatFinanceCurrency(order.operatingCostVnd)}</TableCell>
      <TableCell className="w-[195px]">
        <Badge title={cost.description} tone={cost.tone}>{cost.label}</Badge>
        <p className="mt-1 text-caption text-text-muted">{getSettlementPeriodLabel(order.settlementPeriod)}</p>
      </TableCell>
      <TableCell className="w-[320px] break-words font-mono text-caption text-text-default">{order.transferContent}</TableCell>
      <TableCell className="w-[150px]"><ReviewControl canReview={canReview} isPending={isReviewPending} onReview={onReview} order={order} /></TableCell>
    </tr>
  );
}

function OrderRecord({
  canReview,
  isReviewPending,
  onReview,
  order,
}: {
  canReview: boolean;
  isReviewPending: boolean;
  onReview: (order: FinanceOrderReadModel, isChecked: boolean) => void;
  order: FinanceOrderReadModel;
}) {
  const type = getFinanceOrderTypePresentation(order.orderType);
  const cost = getFinanceOrderCostPresentation(order);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text-strong">{order.studentFullName}</p>
          <p className="mt-0.5 text-caption text-text-muted">{formatFinanceDateTime(order.transactionAt)} · {order.bankTransactionId}</p>
        </div>
        <Badge tone={type.tone}>{type.label}</Badge>
      </div>
      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p><span className="font-medium text-text-default">Lớp:</span> {order.className ? `${order.classCode ?? ""} ${order.className}`.trim() : "Chưa xác định"}</p>
        <p><span className="font-medium text-text-default">Phụ huynh:</span> {order.guardianFullName ?? "Chưa xác định"}</p>
        <p><span className="font-medium text-text-default">SĐT phụ huynh:</span> {order.guardianPhone ?? "Chưa có SĐT"}</p>
        <p><span className="font-medium text-text-default">Sale · Nguồn:</span> {order.saleOwnerFullName ?? "Chưa xác định"} · {getFinanceOrderSourceLabel(order)}</p>
        <p><span className="font-medium text-text-default">Học phí:</span> <span className="tabular-nums font-semibold text-text-strong">{formatFinanceCurrency(order.tuitionAmountVnd)}</span></p>
        <p><span className="font-medium text-text-default">Chi phí vận hành:</span> <span className="tabular-nums">{order.operatingCostVnd === null ? "—" : formatFinanceCurrency(order.operatingCostVnd)}</span></p>
        <p><span className="font-medium text-text-default">Cơ chế:</span> <Badge className="align-middle" title={cost.description} tone={cost.tone}>{cost.label}</Badge> · {getSettlementPeriodLabel(order.settlementPeriod)}</p>
        <p className="break-words font-mono text-caption text-text-default"><span className="font-sans font-medium">Nội dung chuyển khoản:</span> {order.transferContent}</p>
      </div>
      <div className="mt-3"><ReviewControl canReview={canReview} isPending={isReviewPending} onReview={onReview} order={order} /></div>
    </article>
  );
}

function ReviewControl({
  canReview,
  isPending,
  onReview,
  order,
}: {
  canReview: boolean;
  isPending: boolean;
  onReview: (order: FinanceOrderReadModel, isChecked: boolean) => void;
  order: FinanceOrderReadModel;
}) {
  if (!canReview) {
    return <Badge tone={order.isChecked ? "success" : "neutral"}>{order.isChecked ? "Đã xác nhận" : "Chưa xác nhận"}</Badge>;
  }

  return (
    <Button
      aria-label={`${order.isChecked ? "Bỏ xác nhận" : "Xác nhận"} đơn ${order.bankTransactionId}`}
      disabled={isPending}
      isLoading={isPending}
      onClick={() => onReview(order, !order.isChecked)}
      size="sm"
      variant={order.isChecked ? "outline" : "primary"}
    >
      {order.isChecked ? "Bỏ xác nhận" : "Xác nhận"}
    </Button>
  );
}

function SettlementSection({ dashboard }: { dashboard: FinanceOrdersDashboardReadModel }) {
  return (
    <section aria-labelledby="finance-orders-settlement-title" className="grid gap-4">
      <div>
        <h2 className="text-section-title text-text-strong" id="finance-orders-settlement-title">Quyết toán chi phí vận hành SB</h2>
        <p className="mt-1 text-secondary text-text-muted">Đợt 1: 01–10 · Đợt 2: 11–20 · Đợt 3: 21–cuối tháng.</p>
      </div>
      {!dashboard.settlementEligible ? (
        <EmptyState description="Không có dữ liệu quyết toán SB khi lọc nguồn MMA hoặc SB F1." title="Không áp dụng quyết toán SB" />
      ) : dashboard.settlement.length === 0 ? (
        <EmptyState description="Chưa có khoản thu SB phù hợp với bộ lọc hiện tại." title="Chưa có dữ liệu quyết toán SB" />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {dashboard.settlement.map((row) => (
            <article className="rounded-lg border border-border-subtle bg-surface-base p-4" key={row.period}>
              <p className="font-semibold text-text-strong">{getSettlementPeriodLabel(row.period)}</p>
              <p className="mt-2 text-secondary text-text-muted">Tuyển mới: {row.newEnrollmentCount} · Tái phí: {row.renewalCount}</p>
              <p className="mt-2 tabular-nums font-semibold text-text-strong">Học phí {formatFinanceCurrency(row.tuitionAmountVnd)}</p>
              <p className="mt-1 tabular-nums text-secondary text-text-muted">Chi phí {formatFinanceCurrency(row.operatingCostVnd)}</p>
              <p className="mt-2 text-caption text-text-muted">Đã xác nhận {row.checkedCount} · Chưa xác nhận {row.uncheckedCount}{row.unconfiguredCount > 0 ? ` · Chưa cấu hình ${row.unconfiguredCount}` : ""}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TableHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className}`} scope="col">{children}</th>;
}

function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`h-16 px-3 align-middle text-table-body ${className}`}>{children}</td>;
}
