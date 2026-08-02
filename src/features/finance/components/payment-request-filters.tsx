import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { PaymentRequestFiltersState } from "@/features/finance/read-models";

interface PaymentRequestFiltersProps {
  filters: PaymentRequestFiltersState;
  hasActiveFilters: boolean;
  onChange: (filters: PaymentRequestFiltersState) => void;
  onReset: () => void;
}

export function PaymentRequestFilters({
  filters,
  hasActiveFilters,
  onChange,
  onReset,
}: PaymentRequestFiltersProps) {
  const updateFilter = (
    key: keyof PaymentRequestFiltersState,
    value: string,
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section
      aria-label="Bộ lọc yêu cầu thanh toán"
      className="border-y border-hairline bg-surface-1 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted sm:col-span-2">
          <span>Tìm kiếm</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Mã yêu cầu, học viên, SĐT, nội dung CK..."
            type="search"
            value={filters.search}
          />
        </label>

        <FilterSelect
          label="Trạng thái"
          onChange={(value) => updateFilter("status", value)}
          value={filters.status}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ thanh toán</option>
          <option value="partially_paid">Thanh toán một phần</option>
          <option value="paid">Đã thanh toán</option>
          <option value="expired">Hết hạn</option>
          <option value="cancelled">Đã hủy</option>
        </FilterSelect>

        <FilterSelect
          label="Loại nạp"
          onChange={(value) => updateFilter("topupType", value)}
          value={filters.topupType}
        >
          <option value="">Tất cả loại nạp</option>
          <option value="new">Tuyển mới</option>
          <option value="renewal">Tái phí</option>
        </FilterSelect>

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Từ ngày</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("createdFrom", event.target.value)}
            type="date"
            value={filters.createdFrom}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Đến ngày</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("createdTo", event.target.value)}
            type="date"
            value={filters.createdTo}
          />
        </label>

        <div className="flex items-end">
          <Button
            className="min-h-11 w-full"
            disabled={!hasActiveFilters}
            onClick={onReset}
            type="button"
            variant="outline"
          >
            Xóa lọc
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
      <span>{label}</span>
      <select
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20";
