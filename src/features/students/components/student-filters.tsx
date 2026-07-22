"use client";

import type { ChangeEvent } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  defaultStudentFilters,
  hasActiveStudentFilters,
  studentStatusOptions,
} from "@/features/students/student-filters";
import type { StudentFiltersState } from "@/features/students/types";

interface StudentFiltersProps {
  classNames: string[];
  filters: StudentFiltersState;
  isMobileOpen: boolean;
  onChange: (filters: StudentFiltersState) => void;
  onCloseMobile: () => void;
  saleOwners: string[];
}

export function StudentFilters({
  classNames,
  filters,
  isMobileOpen,
  onChange,
  onCloseMobile,
  saleOwners,
}: StudentFiltersProps) {
  const updateFilter = (
    key: keyof StudentFiltersState,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  const resetFilters = () => {
    onChange(defaultStudentFilters);
  };

  const desktopFields = (
    <FilterFields
      classNames={classNames}
      filters={filters}
      onReset={resetFilters}
      onUpdate={updateFilter}
      saleOwners={saleOwners}
      scope="desktop"
    />
  );
  const mobileFields = (
    <FilterFields
      classNames={classNames}
      filters={filters}
      onReset={resetFilters}
      onUpdate={updateFilter}
      saleOwners={saleOwners}
      scope="mobile"
    />
  );

  return (
    <>
      <section className="hidden rounded-lg border border-hairline bg-surface-1 p-4 shadow-card lg:block">
        {desktopFields}
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
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] transform flex-col bg-surface-1 shadow-drawer transition-transform lg:hidden",
          isMobileOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Bộ lọc học viên"
      >
        <div className="flex h-16 items-center justify-between border-b border-hairline px-4">
          <div>
            <h2 className="text-section font-semibold text-ink">Bộ lọc</h2>
            <p className="text-xs text-ink-muted">Lọc trên dữ liệu mock</p>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-md text-2xl text-ink-muted hover:bg-canvas hover:text-ink"
            onClick={onCloseMobile}
            type="button"
            aria-label="Đóng bộ lọc"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{mobileFields}</div>
      </aside>
    </>
  );
}

interface FilterFieldsProps {
  classNames: string[];
  filters: StudentFiltersState;
  onReset: () => void;
  onUpdate: (
    key: keyof StudentFiltersState,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  saleOwners: string[];
  scope: "desktop" | "mobile";
}

function FilterFields({
  classNames,
  filters,
  onReset,
  onUpdate,
  saleOwners,
  scope,
}: FilterFieldsProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(150px,1fr))]">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          Tìm kiếm
          <input
            className="h-11 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
            data-testid={`${scope}-student-search`}
            onChange={(event) => onUpdate("search", event)}
            placeholder="Tên học viên, mã học viên, SĐT phụ huynh"
            type="search"
            value={filters.search}
          />
        </label>
        <FilterSelect
          label="Khối"
          testId={`${scope}-student-grade`}
          onChange={(event) => onUpdate("grade", event)}
          value={filters.grade}
        >
          <option value="all">Khối 1-12</option>
          {Array.from({ length: 12 }).map((_, index) => (
            <option key={index + 1} value={String(index + 1)}>
              Khối {index + 1}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Lớp chính"
          testId={`${scope}-student-class`}
          onChange={(event) => onUpdate("className", event)}
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
          testId={`${scope}-student-status`}
          onChange={(event) => onUpdate("status", event)}
          value={filters.status}
        >
          <option value="all">Tất cả trạng thái</option>
          {studentStatusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Mức"
          testId={`${scope}-student-level`}
          onChange={(event) => onUpdate("learningLevel", event)}
          value={filters.learningLevel}
        >
          <option value="all">A/B/CLC</option>
          <option value="A">Mức A</option>
          <option value="B">Mức B</option>
          <option value="CLC">CLC</option>
        </FilterSelect>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(140px,1fr))_auto]">
        <FilterSelect
          label="Hình thức"
          testId={`${scope}-student-mode`}
          onChange={(event) => onUpdate("registeredMode", event)}
          value={filters.registeredMode}
        >
          <option value="all">Online/offline</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </FilterSelect>
        <FilterSelect
          label="Nguồn"
          testId={`${scope}-student-source`}
          onChange={(event) => onUpdate("leadSourceGroup", event)}
          value={filters.leadSourceGroup}
        >
          <option value="all">MMA/Sandbox/khác</option>
          <option value="mma">MMA</option>
          <option value="sandbox">Sandbox</option>
          <option value="other">Khác</option>
        </FilterSelect>
        <FilterSelect
          label="Sale phụ trách"
          testId={`${scope}-student-sale`}
          onChange={(event) => onUpdate("saleOwnerName", event)}
          value={filters.saleOwnerName}
        >
          <option value="all">Tất cả sale</option>
          {saleOwners.map((saleOwner) => (
            <option key={saleOwner} value={saleOwner}>
              {saleOwner}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Số dư"
          testId={`${scope}-student-balance`}
          onChange={(event) => onUpdate("balance", event)}
          value={filters.balance}
        >
          <option value="all">Mọi số dư</option>
          <option value="positive">Số dư dương</option>
          <option value="zero">Số dư bằng 0</option>
          <option value="negative">Số dư âm</option>
        </FilterSelect>
        <FilterSelect
          label="Cảnh báo"
          testId={`${scope}-student-alert`}
          onChange={(event) => onUpdate("alert", event)}
          value={filters.alert}
        >
          <option value="all">Tất cả</option>
          <option value="has_alert">Có cảnh báo</option>
        </FilterSelect>
        <FilterSelect
          label="Sổ liên lạc"
          testId={`${scope}-student-communication`}
          onChange={(event) => onUpdate("communicationGroup", event)}
          value={filters.communicationGroup}
        >
          <option value="all">Tất cả</option>
          <option value="has_group">Có sổ liên lạc</option>
          <option value="no_group">Chưa có sổ liên lạc</option>
        </FilterSelect>
        <div className="flex items-end">
          <Button
            className="min-h-11 w-full"
            data-testid={`${scope}-student-reset-filters`}
            disabled={!hasActiveStudentFilters(filters)}
            onClick={onReset}
            variant="ghost"
          >
            Xóa bộ lọc
          </Button>
        </div>
      </div>
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
