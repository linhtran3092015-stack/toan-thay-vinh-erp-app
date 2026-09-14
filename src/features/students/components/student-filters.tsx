"use client";

import { useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

import { FilterBar } from "@/components/patterns/filter-bar";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  returnFocusRef,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: StudentFiltersProps) {
  const [internalSearch, setInternalSearch] = useState(filters.search);

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
      onReset={onReset}
      onSearchChange={handleSearchInput}
      onSearchSubmit={onSearchSubmit}
      onSelectChange={handleSelectChange}
      searchValue={currentSearch}
      scope={scope}
    />
  );

  return (
    <>
      <FilterBar className="students-filter-bar">{fields("desktop")}</FilterBar>

      <Dialog
        ariaLabelledBy="student-filter-drawer-title"
        className="ml-auto flex h-full max-h-none max-w-[360px] flex-col rounded-none sm:max-h-[92vh] sm:rounded-xl"
        isOpen={isMobileOpen}
        onClose={onCloseMobile}
        returnFocusRef={returnFocusRef}
      >
        <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id="student-filter-drawer-title">
              Bộ lọc
            </h2>
            <p className="text-caption text-text-muted">
              {activeFilterCount > 0
                ? `${activeFilterCount} bộ lọc đang áp dụng`
                : "Lọc danh sách học viên hiện có"}
            </p>
          </div>

          <button
            aria-label="Đóng bộ lọc"
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-interactive-hover hover:text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            onClick={onCloseMobile}
            type="button"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{fields("mobile")}</div>
      </Dialog>
    </>
  );
}

interface FilterFieldsProps {
  classNames: string[];
  filters: StudentDirectoryFiltersState;
  onReset: () => void;
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
  onReset,
  onSearchChange,
  onSearchSubmit,
  onSelectChange,
  searchValue,
  scope,
}: FilterFieldsProps) {
  const isComposingRef = useRef(false);

  return (
    <div className="students-filter-fields grid gap-3">
      <label className="grid gap-1.5 text-label font-medium text-text-muted">
        Tìm kiếm
        <input
          autoComplete="off"
          autoCorrect="off"
          className="h-10 rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring"
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
          placeholder="Tên, mã, phụ huynh hoặc SĐT"
          spellCheck={false}
          type="search"
          value={searchValue}
        />
      </label>

      <FilterSelect
        label="Trạng thái"
        onChange={(event) => onSelectChange("status", event)}
        testId={`${scope}-student-status`}
        value={filters.status}
      >
        <option value="all">Tất cả</option>
        {studentStatusOptions.map((status) => (
          <option key={status.value} value={status.value}>{status.label}</option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Lớp chính"
        onChange={(event) => onSelectChange("className", event)}
        testId={`${scope}-student-class`}
        value={filters.className}
      >
        <option value="all">Tất cả lớp</option>
        {classNames.map((className) => (
          <option key={className} value={className}>{className}</option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Khối"
        onChange={(event) => onSelectChange("grade", event)}
        testId={`${scope}-student-grade`}
        value={filters.grade}
      >
        <option value="all">Khối 1–12</option>
        {Array.from({ length: 12 }).map((_, index) => (
          <option key={index + 1} value={String(index + 1)}>Khối {index + 1}</option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Mức"
        onChange={(event) => onSelectChange("learningLevel", event)}
        testId={`${scope}-student-level`}
        value={filters.learningLevel}
      >
        <option value="all">A/B/CLC</option>
        <option value="A">Mức A</option>
        <option value="B">Mức B</option>
        <option value="CLC">CLC</option>
      </FilterSelect>

      <FilterSelect
        label="Hình thức"
        onChange={(event) => onSelectChange("registeredMode", event)}
        testId={`${scope}-student-mode`}
        value={filters.registeredMode}
      >
        <option value="all">Tất cả</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </FilterSelect>

      {hasActiveStudentFilters({ ...filters, search: searchValue }) ? (
        <div className="flex items-end">
          <Button
            className="min-h-10 w-full"
            data-testid={`${scope}-student-reset-filters`}
            onClick={onReset}
            variant="ghost"
          >
            Xóa lọc
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface FilterSelectProps {
  children: ReactNode;
  label: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  testId: string;
  value: string;
}

function FilterSelect({
  children,
  label,
  onChange,
  testId,
  value,
}: FilterSelectProps) {
  return (
    <label className="grid gap-1.5 text-label font-medium text-text-muted">
      {label}
      <select
        className="h-10 rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring"
        data-testid={testId}
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}
