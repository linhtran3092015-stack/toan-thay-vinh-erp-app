import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";

import { FilterBar } from "@/components/patterns/filter-bar";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PaymentRequestFiltersState } from "@/features/finance/read-models";

interface PaymentRequestFiltersProps {
  activeFilterCount: number;
  filters: PaymentRequestFiltersState;
  isDrawerOpen: boolean;
  onChange: (key: keyof PaymentRequestFiltersState, value: string) => void;
  onCloseDrawer: () => void;
  onReset: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function PaymentRequestFilters({
  activeFilterCount,
  filters,
  isDrawerOpen,
  onChange,
  onCloseDrawer,
  onReset,
  returnFocusRef,
}: PaymentRequestFiltersProps) {
  return (
    <>
      <FilterBar
        className="payment-request-filter-bar"
      >
        <PaymentRequestFilterFields
          filters={filters}
          onChange={onChange}
          onReset={onReset}
          scope="desktop"
          showReset={activeFilterCount > 0}
        />
      </FilterBar>

      <Dialog
        ariaLabelledBy="payment-request-filter-drawer-title"
        className="ml-auto flex h-full max-h-none w-full max-w-sm flex-col rounded-none sm:max-h-[92vh] sm:rounded-xl"
        onClose={onCloseDrawer}
        isOpen={isDrawerOpen}
        returnFocusRef={returnFocusRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-section-title text-text-strong" id="payment-request-filter-drawer-title">
              Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </h2>
            <p className="mt-1 text-secondary text-text-muted">Thu hẹp danh sách yêu cầu đang tải.</p>
          </div>
          <button
            aria-label="Đóng bộ lọc"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            onClick={onCloseDrawer}
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <PaymentRequestFilterFields
            filters={filters}
            onChange={onChange}
            onReset={onReset}
            scope="drawer"
            showReset={activeFilterCount > 0}
          />
        </div>
      </Dialog>
    </>
  );
}

function PaymentRequestFilterFields({
  filters,
  onChange,
  onReset,
  scope,
  showReset,
}: {
  filters: PaymentRequestFiltersState;
  onChange: (key: keyof PaymentRequestFiltersState, value: string) => void;
  onReset: () => void;
  scope: "desktop" | "drawer";
  showReset: boolean;
}) {
  const prefix = scope === "desktop" ? "payment-request-filter-grid" : "grid";
  return (
    <div className={`${prefix} gap-3`}>
      <label className="grid gap-1.5 text-label text-text-muted payment-request-search-field">
        <span>Tìm kiếm</span>
        <input
          className={inputClassName}
          data-testid={`${scope}-payment-request-search`}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder="Mã yêu cầu, học viên, SĐT, nội dung CK..."
          type="search"
          value={filters.search}
        />
      </label>

      <FilterSelect label="Trạng thái" onChange={(value) => onChange("status", value)} value={filters.status}>
        <option value="">Tất cả trạng thái</option>
        <option value="pending">Chờ thanh toán</option>
        <option value="partially_paid">Thanh toán một phần</option>
        <option value="paid">Đã thanh toán</option>
        <option value="expired">Hết hạn</option>
        <option value="cancelled">Đã hủy</option>
      </FilterSelect>

      <FilterSelect label="Loại nạp" onChange={(value) => onChange("topupType", value)} value={filters.topupType}>
        <option value="">Tất cả loại nạp</option>
        <option value="new">Tuyển mới</option>
        <option value="renewal">Tái phí</option>
      </FilterSelect>

      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Từ ngày</span>
        <input className={inputClassName} onChange={(event) => onChange("createdFrom", event.target.value)} type="date" value={filters.createdFrom} />
      </label>
      <label className="grid gap-1.5 text-label text-text-muted">
        <span>Đến ngày</span>
        <input className={inputClassName} onChange={(event) => onChange("createdTo", event.target.value)} type="date" value={filters.createdTo} />
      </label>
      <div className="flex items-end">
        <Button className="min-h-11 w-full" disabled={!showReset} onClick={onReset} type="button" variant="outline">
          Xóa lọc
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-1.5 text-label text-text-muted">
      <span>{label}</span>
      <select className={inputClassName} onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
    </label>
  );
}

const inputClassName = "h-11 min-w-0 rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:bg-disabled-bg disabled:text-text-muted";
