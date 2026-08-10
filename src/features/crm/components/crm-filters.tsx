"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import { FilterBar } from "@/components/patterns/filter-bar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  resetCrmDirectoryFilters,
  serializeCrmDirectoryFilterChange,
} from "@/features/crm/crm-directory-url-state";
import type { LeadSourceOption, SaleOwnerOption } from "@/features/crm/read-models";

interface CrmFiltersProps {
  leadSources: LeadSourceOption[];
  saleOwners: SaleOwnerOption[];
}

const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function CrmFilters({ leadSources, saleOwners }: CrmFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingParamsRef = useRef<URLSearchParams | null>(null);
  const queryString = searchParams.toString();

  useEffect(() => {
    pendingParamsRef.current = new URLSearchParams(queryString);
  }, [queryString]);

  const filters = {
    grade: searchParams.get("grade") ?? "",
    sale: searchParams.get("sale") ?? "",
    search: searchParams.get("search") ?? "",
    source: searchParams.get("source") ?? "",
    status: searchParams.get("status") ?? "",
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const navigate = (next: URLSearchParams) => {
    pendingParamsRef.current = next;
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const update = (key: "search" | "status" | "source" | "grade" | "sale", value: string) => {
    navigate(serializeCrmDirectoryFilterChange(
      pendingParamsRef.current ?? searchParams,
      key,
      value,
    ));
  };

  const reset = () => navigate(resetCrmDirectoryFilters(pendingParamsRef.current ?? searchParams));
  const fields = (scope: "desktop" | "mobile") => (
    <CrmFilterFields
      filters={filters}
      leadSources={leadSources}
      onChange={update}
      onReset={reset}
      saleOwners={saleOwners}
      scope={scope}
    />
  );

  return (
    <>
      <div className="crm-filter-trigger-row">
        <Button
          className="crm-filter-trigger min-h-11"
          onClick={() => setIsDrawerOpen(true)}
          ref={filterTriggerRef}
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" size={18} strokeWidth={1.8} />
          {activeFilterCount ? `Bộ lọc (${activeFilterCount})` : "Bộ lọc"}
        </Button>
      </div>
      <FilterBar className="crm-filter-bar">{fields("desktop")}</FilterBar>
      <Dialog
        ariaLabelledBy="crm-filter-drawer-title"
        className="ml-auto flex h-full max-h-none max-w-[360px] flex-col rounded-none sm:max-h-[92vh] sm:rounded-xl"
        isOpen={isDrawerOpen}
        onClose={() => {
          if (!isPending) setIsDrawerOpen(false);
        }}
        returnFocusRef={filterTriggerRef}
      >
        <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id="crm-filter-drawer-title">Bộ lọc</h2>
            <p className="text-caption text-text-muted">
              {activeFilterCount ? `${activeFilterCount} bộ lọc đang áp dụng` : "Lọc danh sách lead hiện có"}
            </p>
          </div>
          <button aria-label="Đóng bộ lọc" className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" onClick={() => setIsDrawerOpen(false)} type="button">
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{fields("mobile")}</div>
      </Dialog>
    </>
  );
}

function CrmFilterFields({
  filters,
  leadSources,
  onChange,
  onReset,
  saleOwners,
  scope,
}: {
  filters: Record<"grade" | "sale" | "search" | "source" | "status", string>;
  leadSources: LeadSourceOption[];
  onChange: (key: "search" | "status" | "source" | "grade" | "sale", value: string) => void;
  onReset: () => void;
  saleOwners: SaleOwnerOption[];
  scope: "desktop" | "mobile";
}) {
  const update = (key: "search" | "status" | "source" | "grade" | "sale") => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(key, event.target.value);
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="crm-filter-fields grid gap-3">
      <FilterField label="Tìm kiếm">
        <input className={fieldClassName} data-testid={`${scope}-crm-search`} onChange={update("search")} placeholder="Tên, SĐT phụ huynh hoặc mã lead" type="search" value={filters.search} />
      </FilterField>
      <SelectField label="Trạng thái" onChange={update("status")} value={filters.status}>
        <option value="">Tất cả trạng thái</option><option value="interested">Đang quan tâm</option><option value="trial_booked">Đã đặt học thử</option><option value="trial_completed">Đã học thử</option><option value="pending_enrollment_confirmation">Chờ xác nhận nhập học</option><option value="converted">Đã nhập học</option><option value="dropped">Đã dừng</option>
      </SelectField>
      <SelectField label="Nguồn" onChange={update("source")} value={filters.source}>
        <option value="">Tất cả nguồn lead</option>{leadSources.map((source) => <option key={source.id} value={source.code}>{source.name}</option>)}
      </SelectField>
      <SelectField label="Khối" onChange={update("grade")} value={filters.grade}>
        <option value="">Tất cả khối</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Khối {index + 1}</option>)}
      </SelectField>
      <SelectField label="Sale phụ trách" onChange={update("sale")} value={filters.sale}>
        <option value="">Tất cả sale</option>{saleOwners.map((sale) => <option key={sale.id} value={sale.id}>{sale.fullName}</option>)}
      </SelectField>
      {active ? <div className="flex items-end"><Button className="min-h-10 w-full" data-testid={`${scope}-crm-reset-filters`} onClick={onReset} variant="ghost">Xóa lọc</Button></div> : null}
    </div>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-label font-medium text-text-muted"><span>{label}</span>{children}</label>;
}

function SelectField({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; value: string }) {
  return <FilterField label={label}><select className={fieldClassName} onChange={onChange} value={value}>{children}</select></FilterField>;
}
