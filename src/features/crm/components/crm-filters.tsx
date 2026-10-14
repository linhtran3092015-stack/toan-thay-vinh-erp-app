"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  FilterSheet,
  FilterTrigger,
} from "@/components/patterns/filter-bar";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { CRM_CASE_STATUSES, crmStatusLabels } from "@/features/crm/crm-presentation";
import {
  getCrmDirectoryGrade,
  getCrmDirectoryStatus,
  isCrmSaleOwnerId,
  resetCrmDirectoryFilters,
  sanitizeCrmSearchTerm,
  serializeCrmDirectoryFilterChange,
} from "@/features/crm/crm-directory-url-state";
import type { CrmStatusCounts, LeadSourceOption, SaleOwnerOption } from "@/features/crm/read-models";

type CrmFilterKey = "search" | "status" | "source" | "grade" | "sale";
type CrmFilterValues = Record<CrmFilterKey, string>;

interface CrmFiltersProps {
  leadSources: LeadSourceOption[];
  saleOwners: SaleOwnerOption[];
  /** Matching leads, shown on the sheet's confirm button. */
  resultCount?: number;
  /** Per-status counts ignoring the status filter; the chips hide when `null`. */
  statusCounts?: CrmStatusCounts | null;
}

const ALL = "all";

/**
 * Lead list filters (design 12a): the five URL-backed filters in a FilterBar
 * on a wide work area, the same fields in a bottom sheet otherwise, and the
 * status chips. Every change rewrites only CRM-owned query keys.
 */
export function CrmFilters({ leadSources, resultCount, saleOwners, statusCounts }: CrmFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingParamsRef = useRef<URLSearchParams | null>(null);
  const sheetTitleId = useId();
  const queryString = searchParams?.toString() ?? "";

  useEffect(() => {
    pendingParamsRef.current = new URLSearchParams(queryString);
  }, [queryString]);

  const current = new URLSearchParams(queryString);
  const sale = current.get("sale");
  const grade = getCrmDirectoryGrade(current.get("grade"));
  // Read status, sale and grade the way the loaders do: a value they ignore (a
  // hand-edited URL) shows as "Tất cả" and is not counted as an active filter.
  const filters: CrmFilterValues = {
    grade: grade === null ? "" : String(grade),
    sale: isCrmSaleOwnerId(sale) ? sale : "",
    search: current.get("search") ?? "",
    source: current.get("source") ?? "",
    status: getCrmDirectoryStatus(current.get("status")) ?? "",
  };
  // A search that sanitises to nothing (e.g. "()") filters nothing, as in the loader.
  const activeCount = (Object.entries(filters) as [CrmFilterKey, string][])
    .filter(([key, value]) => (key === "search" ? sanitizeCrmSearchTerm(value) : value.trim()).length > 0).length;

  const navigate = (next: URLSearchParams) => {
    pendingParamsRef.current = next;
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const update = (key: CrmFilterKey, value: string) => {
    navigate(serializeCrmDirectoryFilterChange(pendingParamsRef.current ?? current, key, value));
  };

  const reset = () => navigate(resetCrmDirectoryFilters(pendingParamsRef.current ?? current));

  const fields = (scope: "desktop" | "mobile") => (
    <CrmFilterFields
      filters={filters}
      leadSources={leadSources}
      onChange={update}
      saleOwners={saleOwners}
      scope={scope}
    />
  );

  const chips: QuickFilterChip[] | null = statusCounts
    ? [
        { count: CRM_CASE_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0), label: "Tất cả", value: ALL },
        ...CRM_CASE_STATUSES.map((status) => ({ count: statusCounts[status], label: crmStatusLabels[status], value: status })),
      ]
    : null;

  return (
    <div aria-busy={isPending || undefined} className="grid gap-3">
      <div className="crm-filter-trigger-row">
        <FilterTrigger activeCount={activeCount} onClick={() => setIsSheetOpen(true)} ref={triggerRef} />
      </div>
      <FilterBar
        activeCount={activeCount}
        className="crm-filter-bar"
        fieldCount={4}
        label="Bộ lọc lead"
        onReset={reset}
      >
        {fields("desktop")}
      </FilterBar>
      <FilterSheet
        activeCount={activeCount}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onReset={reset}
        resetTestId="mobile-crm-reset-filters"
        resultLabel={resultCount === undefined ? "Xem kết quả" : `Xem ${resultCount} lead`}
        returnFocusRef={triggerRef}
        subject="lead"
        titleId={sheetTitleId}
      >
        {fields("mobile")}
      </FilterSheet>
      {chips ? (
        <QuickFilterChips
          chips={chips}
          label="Lọc nhanh theo trạng thái"
          onChange={(value) => update("status", value === ALL ? "" : value)}
          value={filters.status || ALL}
        />
      ) : null}
    </div>
  );
}

function CrmFilterFields({
  filters,
  leadSources,
  onChange,
  saleOwners,
  scope,
}: {
  filters: CrmFilterValues;
  leadSources: LeadSourceOption[];
  onChange: (key: CrmFilterKey, value: string) => void;
  saleOwners: SaleOwnerOption[];
  scope: "desktop" | "mobile";
}) {
  return (
    <>
      <FilterField label="Tìm kiếm">
        <FilterInput
          active={sanitizeCrmSearchTerm(filters.search).length > 0}
          autoComplete="off"
          data-testid={`${scope}-crm-search`}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder="Tên học sinh, phụ huynh, SĐT, mã lead"
          type="search"
          value={filters.search}
        />
      </FilterField>
      <FilterField label="Trạng thái">
        <FilterSelect active={Boolean(filters.status)} onChange={(event) => onChange("status", event.target.value)} value={filters.status}>
          <option value="">Tất cả</option>
          {CRM_CASE_STATUSES.map((status) => <option key={status} value={status}>{crmStatusLabels[status]}</option>)}
        </FilterSelect>
      </FilterField>
      <FilterField label="Nguồn">
        <FilterSelect active={Boolean(filters.source)} onChange={(event) => onChange("source", event.target.value)} value={filters.source}>
          <option value="">Tất cả</option>
          {leadSources.map((source) => <option key={source.id} value={source.code}>{source.name}</option>)}
        </FilterSelect>
      </FilterField>
      <FilterField label="Sale phụ trách">
        <FilterSelect active={Boolean(filters.sale)} onChange={(event) => onChange("sale", event.target.value)} value={filters.sale}>
          <option value="">Tất cả</option>
          {saleOwners.map((sale) => <option key={sale.id} value={sale.id}>{sale.fullName}</option>)}
        </FilterSelect>
      </FilterField>
      <FilterField label="Khối dự kiến">
        <FilterSelect active={Boolean(filters.grade)} onChange={(event) => onChange("grade", event.target.value)} value={filters.grade}>
          <option value="">Tất cả</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Khối {index + 1}</option>)}
        </FilterSelect>
      </FilterField>
    </>
  );
}
