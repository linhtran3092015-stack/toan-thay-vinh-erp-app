"use client";

import { useId, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";

import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  FilterSheet,
} from "@/components/patterns/filter-bar";
import type { StudentDirectoryFiltersState } from "@/features/students/read-models";
import {
  hasActiveStudentFilters,
  studentStatusOptions,
} from "@/features/students/student-filters";

interface StudentFiltersProps {
  activeFilterCount: number;
  classNames: string[];
  filters: StudentDirectoryFiltersState;
  isMobileOpen: boolean;
  onFilterChange: (
    key: keyof StudentDirectoryFiltersState,
    value: string,
  ) => void;
  onCloseMobile: () => void;
  onReset: () => void;
  /** Result count shown on the sheet's confirm button. */
  resultCount?: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
}

export function StudentFilters({
  activeFilterCount,
  classNames,
  filters,
  isMobileOpen,
  onFilterChange,
  onCloseMobile,
  onReset,
  resultCount,
  returnFocusRef,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: StudentFiltersProps) {
  const [internalSearch, setInternalSearch] = useState(filters.search);
  const sheetTitleId = useId();

  // Sync internal search when external filters.search changes and no controlled searchValue is provided
  if (searchValue === undefined && internalSearch !== filters.search) {
    setInternalSearch(filters.search);
  }

  const currentSearch = searchValue !== undefined ? searchValue : internalSearch;

  const handleSearchInput = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearch(value);
      onFilterChange("search", value);
    }
  };

  const handleSelectChange = (
    key: keyof StudentDirectoryFiltersState,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    onFilterChange(key, event.target.value);
  };

  const fields = (scope: "desktop" | "mobile") => (
    <FilterFields
      classNames={classNames}
      filters={filters}
      onSearchChange={handleSearchInput}
      onSearchSubmit={onSearchSubmit}
      onSelectChange={handleSelectChange}
      searchValue={currentSearch}
      scope={scope}
    />
  );

  const isActive = hasActiveStudentFilters({ ...filters, search: currentSearch });

  return (
    <>
      <FilterBar
        activeCount={isActive ? Math.max(activeFilterCount, 1) : 0}
        className="students-filter-bar"
        fieldCount={5}
        label="Bộ lọc học sinh"
        onReset={onReset}
      >
        {fields("desktop")}
      </FilterBar>

      <FilterSheet
        activeCount={activeFilterCount}
        isOpen={isMobileOpen}
        onClose={onCloseMobile}
        onReset={onReset}
        resetTestId="mobile-student-reset-filters"
        resultLabel={resultCount === undefined ? "Xem kết quả" : `Xem ${resultCount} học sinh`}
        returnFocusRef={returnFocusRef}
        subject="học viên"
        titleId={sheetTitleId}
      >
        {fields("mobile")}
      </FilterSheet>
    </>
  );
}

interface FilterFieldsProps {
  classNames: string[];
  filters: StudentDirectoryFiltersState;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  onSelectChange: (
    key: keyof StudentDirectoryFiltersState,
    event: ChangeEvent<HTMLSelectElement>,
  ) => void;
  searchValue: string;
  scope: "desktop" | "mobile";
}

function FilterFields({
  classNames,
  filters,
  onSearchChange,
  onSearchSubmit,
  onSelectChange,
  searchValue,
  scope,
}: FilterFieldsProps) {
  const isComposingRef = useRef(false);

  return (
    <>
      <FilterField label="Tìm kiếm">
        <FilterInput
          active={searchValue.trim().length > 0}
          autoComplete="off"
          autoCorrect="off"
          data-testid={`${scope}-student-search`}
          onChange={(event) => onSearchChange(event.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            onSearchChange(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isComposingRef.current) {
              event.preventDefault();
              onSearchSubmit?.();
            }
          }}
          placeholder="Tên, mã TTV, SĐT phụ huynh"
          spellCheck={false}
          type="search"
          value={searchValue}
        />
      </FilterField>

      <SelectFilter
        label="Lớp"
        onChange={(event) => onSelectChange("className", event)}
        testId={`${scope}-student-class`}
        value={filters.className}
      >
        <option value="all">Tất cả lớp</option>
        {classNames.map((className) => (
          <option key={className} value={className}>{className}</option>
        ))}
      </SelectFilter>

      <SelectFilter
        label="Trạng thái"
        onChange={(event) => onSelectChange("status", event)}
        testId={`${scope}-student-status`}
        value={filters.status}
      >
        <option value="all">Tất cả</option>
        {studentStatusOptions.map((status) => (
          <option key={status.value} value={status.value}>{status.label}</option>
        ))}
      </SelectFilter>

      <SelectFilter
        label="Khối"
        onChange={(event) => onSelectChange("grade", event)}
        testId={`${scope}-student-grade`}
        value={filters.grade}
      >
        <option value="all">Khối 1–12</option>
        {Array.from({ length: 12 }).map((_, index) => (
          <option key={index + 1} value={String(index + 1)}>Khối {index + 1}</option>
        ))}
      </SelectFilter>

      <SelectFilter
        label="Mức"
        onChange={(event) => onSelectChange("learningLevel", event)}
        testId={`${scope}-student-level`}
        value={filters.learningLevel}
      >
        <option value="all">A/B/CLC</option>
        <option value="A">Mức A</option>
        <option value="B">Mức B</option>
        <option value="CLC">CLC</option>
      </SelectFilter>

      <SelectFilter
        label="Hình thức"
        onChange={(event) => onSelectChange("registeredMode", event)}
        testId={`${scope}-student-mode`}
        value={filters.registeredMode}
      >
        <option value="all">Tất cả</option>
        <option value="online">Trực tuyến</option>
        <option value="offline">Tại lớp</option>
      </SelectFilter>
    </>
  );
}

interface SelectFilterProps {
  children: ReactNode;
  label: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  testId: string;
  value: string;
}

function SelectFilter({ children, label, onChange, testId, value }: SelectFilterProps) {
  return (
    <FilterField label={label}>
      <FilterSelect active={value !== "all"} data-testid={testId} onChange={onChange} value={value}>
        {children}
      </FilterSelect>
    </FilterField>
  );
}
