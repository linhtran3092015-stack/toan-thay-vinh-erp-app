import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { LearningResultFiltersState } from "@/features/learning-results/read-models";

interface ClassOption {
  id: string;
  label: string;
}

interface LearningResultsFiltersProps {
  classOptions: readonly ClassOption[];
  filters: LearningResultFiltersState;
  gradeOptions: readonly number[];
  hasActiveFilters: boolean;
  onChange: (nextFilters: LearningResultFiltersState) => void;
  onReset: () => void;
}

export function LearningResultsFilters({
  classOptions,
  filters,
  gradeOptions,
  hasActiveFilters,
  onChange,
  onReset,
}: LearningResultsFiltersProps) {
  const updateFilter = (
    key: keyof LearningResultFiltersState,
    value: string,
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section
      aria-label="Bộ lọc kết quả học tập"
      className="border-y border-hairline bg-surface-1 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted sm:col-span-2">
          <span>Tìm học viên hoặc lớp</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Tên, mã học viên, tên lớp..."
            type="search"
            value={filters.search}
          />
        </label>

        <FilterSelect
          label="Khối"
          onChange={(value) => updateFilter("grade", value)}
          value={filters.grade}
        >
          <option value="">Khối 1-12</option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>
              Khối {grade}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Lớp"
          onChange={(value) => updateFilter("classId", value)}
          value={filters.classId}
        >
          <option value="">Tất cả lớp</option>
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Tình trạng"
          onChange={(value) => updateFilter("scoreStatus", value)}
          value={filters.scoreStatus}
        >
          <option value="">Tất cả</option>
          <option value="attention">Cần chú ý</option>
          <option value="complete">Đủ dữ liệu</option>
          <option value="missing">Thiếu dữ liệu</option>
        </FilterSelect>

        <FilterSelect
          label="Trạng thái vở"
          onChange={(value) => updateFilter("notebookStatus", value)}
          value={filters.notebookStatus}
        >
          <option value="">Tất cả</option>
          <option value="submitted">Đã nộp</option>
          <option value="not_submitted">Chưa nộp</option>
          <option value="not_required">Không yêu cầu</option>
        </FilterSelect>

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

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Từ ngày</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("dateFrom", event.target.value)}
            type="date"
            value={filters.dateFrom}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-ink-muted">
          <span>Đến ngày</span>
          <input
            className={inputClassName}
            onChange={(event) => updateFilter("dateTo", event.target.value)}
            type="date"
            value={filters.dateTo}
          />
        </label>
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
