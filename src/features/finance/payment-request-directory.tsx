"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { PaymentRequestFilters } from "@/features/finance/components/payment-request-filters";
import { PaymentRequestTable } from "@/features/finance/components/payment-request-table";
import type { PaymentRequestFiltersState, PaymentRequestReadModel } from "@/features/finance/read-models";
import {
  arePaymentRequestFiltersEqual,
  defaultPaymentRequestFilters,
  getPaymentRequestDirectoryHref,
  getPaymentRequestDirectoryQuery,
  mergePendingPaymentRequestFilter,
  parsePaymentRequestDirectoryViewState,
  resetPaymentRequestDirectoryViewState,
} from "@/features/finance/payment-request-url-state";

export const PAYMENT_REQUEST_PAGE_SIZE = 20;

export function PaymentRequestDirectory({ canCreatePaymentRequests, items }: { canCreatePaymentRequests: boolean; items: PaymentRequestReadModel[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingFiltersRef = useRef<PaymentRequestFiltersState | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const viewState = useMemo(() => parsePaymentRequestDirectoryViewState(searchParams), [searchParams]);
  const { filters, page } = viewState;

  useEffect(() => {
    if (pendingFiltersRef.current && arePaymentRequestFiltersEqual(pendingFiltersRef.current, filters)) {
      pendingFiltersRef.current = null;
    }
  }, [filters]);

  const filteredItems = useMemo(() => filterPaymentRequests(items, filters), [filters, items]);
  const pagination = useMemo(() => paginatePaymentRequests(filteredItems, page), [filteredItems, page]);
  const summary = useMemo(() => summarizePaymentRequests(filteredItems), [filteredItems]);
  const activeFilterCount = countActivePaymentRequestFilters(filters);
  const hasActiveFilters = activeFilterCount > 0;
  const directoryQuery = getPaymentRequestDirectoryQuery(searchParams);
  const createHref = directoryQuery ? `/finance/payment-requests/new?${directoryQuery}` : "/finance/payment-requests/new";

  const replaceFilters = (nextFilters: PaymentRequestFiltersState) => {
    pendingFiltersRef.current = nextFilters;
    router.replace(getPaymentRequestDirectoryHref(searchParams, { filters: nextFilters, page: 1 }), { scroll: false });
  };

  const updateFilter = (key: keyof PaymentRequestFiltersState, value: string) => {
    replaceFilters(mergePendingPaymentRequestFilter(pendingFiltersRef.current, filters, key, value));
  };

  const resetFilters = () => {
    pendingFiltersRef.current = defaultPaymentRequestFilters;
    router.replace(getPaymentRequestDirectoryHref(searchParams, resetPaymentRequestDirectoryViewState()), { scroll: false });
  };

  const updatePage = (nextPage: number) => {
    router.push(getPaymentRequestDirectoryHref(searchParams, { filters, page: nextPage }), { scroll: false });
  };

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={canCreatePaymentRequests ? (
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={createHref}>
            Tạo yêu cầu
          </Link>
        ) : undefined}
        title="Yêu cầu thanh toán"
      >
        <p className="mt-1 text-secondary text-text-muted">Theo dõi các yêu cầu thanh toán đang tải; trạng thái thanh toán do hệ thống ghi nhận.</p>
      </PageHeader>

      <div className="payment-request-operational-work-area grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className="text-secondary text-text-muted">
            {filteredItems.length}/{items.length} yêu cầu trong danh sách đã tải
          </p>
          <Button
            className="payment-request-filter-trigger min-h-11"
            onClick={() => setIsFilterDrawerOpen(true)}
            ref={filterTriggerRef}
            type="button"
            variant="outline"
          >
            <Filter aria-hidden="true" size={18} strokeWidth={2} />
            Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        <PaymentRequestFilters
          activeFilterCount={activeFilterCount}
          filters={filters}
          isDrawerOpen={isFilterDrawerOpen}
          onChange={updateFilter}
          onCloseDrawer={() => setIsFilterDrawerOpen(false)}
          onReset={resetFilters}
          returnFocusRef={filterTriggerRef}
        />

        {filteredItems.length === 0 ? (
          <EmptyState
            actionLabel={hasActiveFilters ? "Xóa bộ lọc" : undefined}
            description={hasActiveFilters ? "Không có yêu cầu thanh toán nào phù hợp với điều kiện đang chọn." : "Chưa có yêu cầu nạp học phí nào được tạo."}
            onAction={hasActiveFilters ? resetFilters : undefined}
            title={hasActiveFilters ? "Không tìm thấy yêu cầu" : "Chưa có yêu cầu thanh toán"}
          />
        ) : (
          <>
            <section aria-label="Tóm tắt danh sách yêu cầu đang tải" className="grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-3">
              <SummaryItem label="Tổng dự kiến" value={formatCurrency(summary.expectedVnd)} />
              <SummaryItem label="Đã nhận" value={formatCurrency(summary.paidVnd)} />
              <SummaryItem description="Trong danh sách yêu cầu đang tải" label="Còn chờ nhận" value={formatCurrency(summary.outstandingVnd)} />
            </section>

            <PaymentRequestTable items={pagination.items} />

            <nav aria-label="Phân trang yêu cầu thanh toán" className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 md:flex-row md:items-center md:justify-between">
              <p className="text-secondary text-text-muted">
                Hiển thị {pagination.start + 1}-{Math.min(pagination.start + PAYMENT_REQUEST_PAGE_SIZE, filteredItems.length)} của {filteredItems.length} yêu cầu · Trang {pagination.page}/{pagination.pageCount}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={pagination.page === 1} onClick={() => updatePage(pagination.page - 1)} type="button" variant="outline">Trước</Button>
                {getVisiblePageNumbers(pagination.page, pagination.pageCount).map((pageNumber) => (
                  <Button aria-current={pageNumber === pagination.page ? "page" : undefined} className="min-h-11 min-w-11" key={pageNumber} onClick={() => updatePage(pageNumber)} type="button" variant={pageNumber === pagination.page ? "secondary" : "ghost"}>{pageNumber}</Button>
                ))}
                <Button className="min-h-11" disabled={pagination.page === pagination.pageCount} onClick={() => updatePage(pagination.page + 1)} type="button" variant="outline">Sau</Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

export function filterPaymentRequests(items: PaymentRequestReadModel[], filters: PaymentRequestFiltersState): PaymentRequestReadModel[] {
  const search = normalizeSearch(filters.search);
  return items.filter((item) => {
    const searchable = normalizeSearch([item.publicCode, item.studentFullName, item.studentPublicCode, item.guardianFullName, item.guardianPhone, item.transferCode].filter(Boolean).join(" "));
    const createdDate = item.createdAt.slice(0, 10);
    return (!search || searchable.includes(search))
      && (!filters.status || item.status === filters.status)
      && (!filters.topupType || item.topupType === filters.topupType)
      && (!filters.createdFrom || createdDate >= filters.createdFrom)
      && (!filters.createdTo || createdDate <= filters.createdTo);
  });
}

export function paginatePaymentRequests(items: PaymentRequestReadModel[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAYMENT_REQUEST_PAGE_SIZE));
  const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const start = (page - 1) * PAYMENT_REQUEST_PAGE_SIZE;
  return { items: items.slice(start, start + PAYMENT_REQUEST_PAGE_SIZE), page, pageCount, start };
}

export function countActivePaymentRequestFilters(filters: PaymentRequestFiltersState): number {
  return [filters.search, filters.status, filters.topupType, filters.createdFrom, filters.createdTo].filter(Boolean).length;
}

function summarizePaymentRequests(items: PaymentRequestReadModel[]) {
  return items.reduce((summary, item) => {
    summary.expectedVnd += item.expectedAmountVnd;
    summary.paidVnd += item.paidAmountVnd;
    if (item.status === "pending" || item.status === "partially_paid") summary.outstandingVnd += Math.max(item.expectedAmountVnd - item.paidAmountVnd, 0);
    return summary;
  }, { expectedVnd: 0, outstandingVnd: 0, paidVnd: 0 });
}

function SummaryItem({ description, label, value }: { description?: string; label: string; value: string }) {
  return <div className="bg-surface-base px-4 py-3"><p className="text-label text-text-muted">{label}</p><p className="mt-1 tabular-nums text-numeric text-text-strong">{value}</p>{description ? <p className="mt-1 text-caption text-text-muted">{description}</p> : null}</div>;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("đ", "d").toLocaleLowerCase("vi").trim();
}

function getVisiblePageNumbers(currentPage: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" });
function formatCurrency(value: number): string { return currencyFormatter.format(value); }
