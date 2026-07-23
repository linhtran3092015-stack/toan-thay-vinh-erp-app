"use client";

import type { ChangeEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { StudentDirectoryFiltersState } from "@/features/students/read-models";
import {
  defaultStudentFilters,
  hasActiveStudentFilters,
  studentStatusOptions,
} from "@/features/students/student-filters";
import { cn } from "@/lib/utils";

interface StudentFiltersProps {
  classNames: string[];
  filters: StudentDirectoryFiltersState;
  isMobileOpen: boolean;
  onChange: (filters: StudentDirectoryFiltersState) => void;
  onCloseMobile: () => void;
}

export function StudentFilters({
  classNames,
  filters,
  isMobileOpen,
  onChange,
  onCloseMobile,
}: StudentFiltersProps) {
  const updateFilter = (
    key: keyof StudentDirectoryFiltersState,
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    onChange({
      ...filters,
      [key]: event.target.value,
    });
  };

  const fields = (scope: "desktop" | "mobile") => (
    <FilterFields
      classNames={classNames}
      filters={filters}
      onReset={() => onChange(defaultStudentFilters)}
      onUpdate={updateFilter}
      scope={scope}
    />
  );

  return (
    <>
      <section className="hidden rounded-lg border border-hairline bg-surface-1 p-4 shadow-card lg:block">
        {fields("desktop")}
      </section>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink/[0.35] transition-opacity lg:hidden",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        aria-label="Bộ lọc học viên"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] transform flex-col bg-surface-1 shadow-drawer transition-transform lg:hidden",
          isMobileOpen
            ? "translate-x-0"
            : "translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-hairline px-4">
          <div>
            <h2 className="text-section font-semibold text-ink">
              Bộ lọc
            </h2>
            <p className="text-xs text-ink-muted">
              Lọc trên dữ liệu Supabase
            </p>
          </div>

          <button
            aria-label="Đóng bộ lọc"
            className="flex h-11 w-11 items-center justify-center rounded-md text-2xl text-ink-muted hover:bg-canvas hover:text-ink"
            onClick={onCloseMobile}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {fields("mobile")}
        </div>
      </aside>
    </>
  );
}

interface FilterFieldsProps {
  classNames: string[];
  filters: StudentDirectoryFiltersState;
  onReset: () => void;
  onUpdate: (
    key: keyof StudentDirectoryFiltersState,
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => void;
  scope: "desktop" | "mobile";
}

function FilterFields({
  classNames,
  filters,
  onReset,
  onUpdate,
  scope,
}: FilterFieldsProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_repeat(5,minmax(140px,1fr))_auto]">
      <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
        Tìm kiếm
        <input
          className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
          data-testid={`${scope}-student-search`}
          onChange={(event) => onUpdate("search", event)}
          placeholder="Tên, mã, phụ huynh hoặc SĐT"
          type="search"
          value={filters.search}
        />
      </label>

      <FilterSelect
        label="Khối"
        onChange={(event) => onUpdate("grade", event)}
        testId={`${scope}-student-grade`}
        value={filters.grade}
      >
        <option value="all">Khối 1–12</option>
        {Array.from({ length: 12 }).map((_, index) => (
          <option key={index + 1} value={String(index + 1)}>
            Khối {index + 1}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Lớp chính"
        onChange={(event) => onUpdate("className", event)}
        testId={`${scope}-student-class`}
        value={filters.className}
      >
        <option value="all">Tất cả lớp</option>
        {classNames.map((className) => (
          <option key={className} value={className}>
            {className}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Trạng thái"
        onChange={(event) => onUpdate("status", event)}
        testId={`${scope}-student-status`}
        value={filters.status}
      >
        <option value="all">Tất cả</option>
        {studentStatusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Mức"
        onChange={(event) =>
          onUpdate("learningLevel", event)
        }
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
        onChange={(event) =>
          onUpdate("registeredMode", event)
        }
        testId={`${scope}-student-mode`}
        value={filters.registeredMode}
      >
        <option value="all">Tất cả</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </FilterSelect>

      <div className="flex items-end">
        <Button
          className="min-h-11 w-full"
          data-testid={`${scope}-student-reset-filters`}
          disabled={!hasActiveStudentFilters(filters)}
          onClick={onReset}
          variant="ghost"
        >
          Xóa lọc
        </Button>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  children: ReactNode;
  label: string;
  onChange: (
    event: ChangeEvent<HTMLSelectElement>,
  ) => void;
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
    <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
      {label}
      <select
        className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
        data-testid={testId}
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}
