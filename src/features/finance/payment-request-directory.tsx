"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { PaymentRequestFilters } from "@/features/finance/components/payment-request-filters";
import { PaymentRequestTable } from "@/features/finance/components/payment-request-table";
import type {
  PaymentRequestFiltersState,
  PaymentRequestReadModel,
} from "@/features/finance/read-models";

const PAGE_SIZE = 20;

const defaultFilters: PaymentRequestFiltersState = {
  createdFrom: "",
  createdTo: "",
  search: "",
  status: "",
  topupType: "",
};

export function PaymentRequestDirectory({
  items,
}: {
  items: PaymentRequestReadModel[];
}) {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilters(item, filters)),
    [filters, items],
  );
  const summary = useMemo(() => summarizePaymentRequests(filteredItems), [filteredItems]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);
  const pageNumbers = getVisiblePageNumbers(currentPage, pageCount);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const updateFilters = (nextFilters: PaymentRequestFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ink-muted">Tài chính</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Yêu cầu thanh toán
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Theo dõi yêu cầu nạp học phí và tiến độ khớp tiền qua SePay.
          </p>
        </div>
        <p className="text-sm font-semibold text-ink-muted">
          {filteredItems.length}/{items.length} yêu cầu
        </p>
      </header>

      <section
        aria-label="Tổng quan yêu cầu thanh toán"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <SummaryItem label="Yêu cầu đang xem" value={String(summary.total)} />
        <SummaryItem label="Tổng dự kiến" value={formatCompactCurrency(summary.expectedVnd)} />
        <SummaryItem label="Đã nhận" value={formatCompactCurrency(summary.paidVnd)} />
        <SummaryItem
          emphasis={summary.outstandingVnd > 0}
          label="Còn chờ nhận"
          value={formatCompactCurrency(summary.outstandingVnd)}
        />
      </section>

      <PaymentRequestFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          actionLabel={hasActiveFilters ? "Xóa bộ lọc" : undefined}
          description={
            hasActiveFilters
              ? "Không có yêu cầu thanh toán nào phù hợp với điều kiện đang chọn."
              : "Chưa có yêu cầu nạp học phí nào được tạo."
          }
          onAction={hasActiveFilters ? resetFilters : undefined}
          title={hasActiveFilters ? "Không tìm thấy yêu cầu" : "Chưa có yêu cầu thanh toán"}
        />
      ) : (
        <>
          <PaymentRequestTable items={pageItems} />

          <nav
            aria-label="Phân trang yêu cầu thanh toán"
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm shadow-card md:flex-row md:items-center md:justify-between"
          >
            <p className="text-ink-muted">
              Hiển thị {pageStart + 1}-
              {Math.min(pageStart + PAGE_SIZE, filteredItems.length)} của {filteredItems.length}
              {" "}yêu cầu · Trang {currentPage}/{pageCount}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                type="button"
                variant="outline"
              >
                Trước
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  className="min-h-11 min-w-11"
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                  variant={pageNumber === currentPage ? "secondary" : "ghost"}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                className="min-h-11"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
                type="button"
                variant="outline"
              >
                Sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function SummaryItem({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`mt-2 text-xl font-bold ${emphasis ? "text-warning" : "text-ink"}`}>
        {value}
      </p>
    </article>
  );
}

function matchesFilters(
  item: PaymentRequestReadModel,
  filters: PaymentRequestFiltersState,
): boolean {
  const search = normalizeSearch(filters.search);
  const searchable = normalizeSearch(
    [
      item.publicCode,
      item.studentFullName,
      item.studentPublicCode,
      item.guardianFullName,
      item.guardianPhone,
      item.transferCode,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const createdDate = item.createdAt.slice(0, 10);

  return (
    (!search || searchable.includes(search)) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.topupType || item.topupType === filters.topupType) &&
    (!filters.createdFrom || createdDate >= filters.createdFrom) &&
    (!filters.createdTo || createdDate <= filters.createdTo)
  );
}

function summarizePaymentRequests(items: PaymentRequestReadModel[]) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary.expectedVnd += item.expectedAmountVnd;
      summary.paidVnd += item.paidAmountVnd;
      if (item.status === "pending" || item.status === "partially_paid") {
        summary.outstandingVnd += Math.max(
          item.expectedAmountVnd - item.paidAmountVnd,
          0,
        );
      }
      return summary;
    },
    { expectedVnd: 0, outstandingVnd: 0, paidVnd: 0, total: 0 },
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replaceAll("đ", "d")
    .toLocaleLowerCase("vi")
    .trim();
}

function getVisiblePageNumbers(currentPage: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const compactCurrencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

