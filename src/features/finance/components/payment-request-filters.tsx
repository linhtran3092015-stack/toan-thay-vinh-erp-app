"use client";

import { useId, type ChangeEvent, type ReactNode, type RefObject } from "react";

import { FilterBar, FilterField, FilterInput, FilterSelect, FilterSheet } from "@/components/patterns/filter-bar";
import { paymentRequestStatusLabels, type PaymentRequestStatus } from "@/features/finance/payment-request-directory-models";
import type { PaymentRequestFiltersState } from "@/features/finance/read-models";

interface PaymentRequestFiltersProps {
  activeFilterCount: number;
  filters: PaymentRequestFiltersState;
  isSheetOpen: boolean;
  onChange: (key: keyof PaymentRequestFiltersState, value: string) => void;
  onCloseSheet: () => void;
  onReset: () => void;
  /** Rows the current filters keep, for the sheet's "Xem n yêu cầu". */
  resultCount: number;
  returnFocusRef: RefObject<HTMLElement | null>;
}

/**
 * Tìm kiếm · Trạng thái · Loại nạp · Từ ngày · Đến ngày. Both selects get a
 * 196px floor (the longest option, "Thanh toán một phần", ~140px of 14px text
 * plus padding and the arrow), the date inputs 140px (a full dd/mm/yyyy and the
 * picker icon). At the 1120px work-area threshold the bar's inner width is
 * 1086px (p-4 and the border); minus 5 × 12px gaps and the ~100px "Xóa lọc (n)"
 * button, 926px remain: the floors take 220 + 2 × 196 + 2 × 140 = 892px and the
 * 34px left over is shared by the fr weights.
 */
const PAYMENT_REQUEST_FILTER_COLUMNS = "minmax(220px, 1fr) repeat(2, minmax(196px, 1fr)) repeat(2, minmax(140px, 0.8fr))";

/** The select's order (expired kept as an option though nothing writes it today); words from the badge map. */
const statusOptions: readonly PaymentRequestStatus[] = ["pending", "partially_paid", "paid", "expired", "cancelled"];

/**
 * Desktop bar from the 1120px work-area threshold, a sheet behind the "Bộ lọc"
 * trigger below it (sessions precedent). The bar sits in a wrapper carrying the
 * `.payment-request-filter-bar` hook: globals.css switches that hook between
 * `none` and `block`, which would otherwise replace the bar's own grid.
 */
export function PaymentRequestFilters({
  activeFilterCount,
  filters,
  isSheetOpen,
  onChange,
  onCloseSheet,
  onReset,
  resultCount,
  returnFocusRef,
}: PaymentRequestFiltersProps) {
  const titleId = useId();

  return (
    <>
      <div className="payment-request-filter-bar">
        <FilterBar
          activeCount={activeFilterCount}
          columns={PAYMENT_REQUEST_FILTER_COLUMNS}
          label="Bộ lọc yêu cầu thanh toán"
          onReset={onReset}
        >
          <PaymentRequestFilterFields filters={filters} onChange={onChange} scope="desktop" />
        </FilterBar>
      </div>

      <FilterSheet
        activeCount={activeFilterCount}
        isOpen={isSheetOpen}
        onClose={onCloseSheet}
        onReset={onReset}
        resetTestId="drawer-payment-request-reset-filters"
        resultLabel={`Xem ${resultCount} yêu cầu`}
        returnFocusRef={returnFocusRef}
        subject="yêu cầu thanh toán"
        titleId={titleId}
      >
        <PaymentRequestFilterFields filters={filters} onChange={onChange} scope="drawer" />
      </FilterSheet>
    </>
  );
}

function PaymentRequestFilterFields({
  filters,
  onChange,
  scope,
}: {
  filters: PaymentRequestFiltersState;
  onChange: (key: keyof PaymentRequestFiltersState, value: string) => void;
  scope: "desktop" | "drawer";
}) {
  const update = (key: keyof PaymentRequestFiltersState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange(key, event.target.value);

  return (
    <>
      <FilterField label="Tìm kiếm">
        <FilterInput
          active={filters.search.trim().length > 0}
          autoComplete="off"
          data-testid={`${scope}-payment-request-search`}
          onChange={update("search")}
          placeholder="Mã yêu cầu, học sinh, SĐT, nội dung CK"
          type="search"
          value={filters.search}
        />
      </FilterField>
      <SelectField label="Trạng thái" onChange={update("status")} testId={`${scope}-payment-request-status`} value={filters.status}>
        <option value="">Tất cả trạng thái</option>
        {statusOptions.map((status) => (
          <option key={status} value={status}>{paymentRequestStatusLabels[status]}</option>
        ))}
      </SelectField>
      <SelectField label="Loại nạp" onChange={update("topupType")} testId={`${scope}-payment-request-topup`} value={filters.topupType}>
        <option value="">Tất cả loại nạp</option>
        <option value="new">Tuyển mới</option>
        <option value="renewal">Tái phí</option>
      </SelectField>
      <FilterField label="Từ ngày">
        <FilterInput
          active={filters.createdFrom.length > 0}
          data-testid={`${scope}-payment-request-from`}
          onChange={update("createdFrom")}
          type="date"
          value={filters.createdFrom}
        />
      </FilterField>
      <FilterField label="Đến ngày">
        <FilterInput
          active={filters.createdTo.length > 0}
          data-testid={`${scope}-payment-request-to`}
          onChange={update("createdTo")}
          type="date"
          value={filters.createdTo}
        />
      </FilterField>
    </>
  );
}

function SelectField({
  children,
  label,
  onChange,
  testId,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  testId: string;
  value: string;
}) {
  return (
    <FilterField label={label}>
      <FilterSelect active={value !== ""} data-testid={testId} onChange={onChange} value={value}>
        {children}
      </FilterSelect>
    </FilterField>
  );
}
