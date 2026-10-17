"use client";

import { useId, type ChangeEvent, type ReactNode, type RefObject } from "react";

import {
  FilterBar,
  FilterField,
  FilterInput,
  FilterSelect,
  FilterSheet,
} from "@/components/patterns/filter-bar";
import type {
  LearningResultClassOption,
  LearningResultFilterChange,
  LearningResultFiltersState,
  LearningResultNotebookFilter,
  LearningResultScoreFilter,
} from "@/features/learning-results/learning-result-models";

interface LearningResultsFiltersProps {
  activeFilterCount: number;
  classOptions: readonly LearningResultClassOption[];
  filters: LearningResultFiltersState;
  gradeOptions: readonly number[];
  isOpen: boolean;
  onClose: () => void;
  onFilterChange: LearningResultFilterChange;
  onReset: () => void;
  /** Rows the current filters match; labels the sheet's apply button. */
  resultCount?: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  /**
   * Classes of the wrapper around the desktop bar (the page owns the
   * container-query breakpoint that hides it on narrow widths). The sheet
   * stays outside the wrapper so it can still open when the bar is hidden.
   */
  barWrapperClassName?: string;
}

/**
 * Desktop bar tracks, one per field in order: Tìm kiếm, Lớp, Khối, Từ ngày,
 * Đến ngày, Vở, Tình trạng điểm. The date tracks have a 148px floor so a full
 * `dd/mm/yyyy` plus the picker icon is never clipped; the selects share what is
 * left. The floors sum to 844px: the bar at the 1072px container threshold has
 * about 1038px inside its border and padding, less 7 gaps of 12px and the
 * "Xóa lọc (n)" button (~105px), which leaves ~849px.
 */
const DESKTOP_FILTER_COLUMNS = [
  "minmax(180px, 1.6fr)",
  "minmax(96px, 1.2fr)",
  "minmax(88px, 0.8fr)",
  "minmax(148px, 1fr)",
  "minmax(148px, 1fr)",
  "minmax(88px, 0.9fr)",
  "minmax(96px, 1.1fr)",
].join(" ");

/**
 * Desktop filter bar plus the narrow-width sheet, both fed by the same fields
 * (design 06 pattern): search, lớp, khối, từ ngày, đến ngày, vở, tình trạng điểm.
 */
export function LearningResultsFilters({
  activeFilterCount,
  barWrapperClassName,
  classOptions,
  filters,
  gradeOptions,
  isOpen,
  onClose,
  onFilterChange,
  onReset,
  resultCount,
  returnFocusRef,
}: LearningResultsFiltersProps) {
  const titleId = useId();
  const fields = (scope: "desktop" | "mobile") => (
    <LearningResultFilterFields
      classOptions={classOptions}
      filters={filters}
      gradeOptions={gradeOptions}
      onFilterChange={onFilterChange}
      scope={scope}
    />
  );

  return (
    <>
      <div className={barWrapperClassName}>
        <FilterBar
          activeCount={activeFilterCount}
          className="learning-results-filter-bar"
          columns={DESKTOP_FILTER_COLUMNS}
          label="Bộ lọc kết quả học tập"
          onReset={onReset}
        >
          {fields("desktop")}
        </FilterBar>
      </div>
      <FilterSheet
        activeCount={activeFilterCount}
        isOpen={isOpen}
        onClose={onClose}
        onReset={onReset}
        resetTestId="mobile-result-reset-filters"
        resultLabel={
          resultCount === undefined
            ? "Xem kết quả"
            : `Xem ${resultCount} kết quả`
        }
        returnFocusRef={returnFocusRef}
        subject="kết quả học tập"
        titleId={titleId}
      >
        {fields("mobile")}
      </FilterSheet>
    </>
  );
}

function LearningResultFilterFields({
  classOptions,
  filters,
  gradeOptions,
  onFilterChange,
  scope,
}: Pick<
  LearningResultsFiltersProps,
  "classOptions" | "filters" | "gradeOptions" | "onFilterChange"
> & { scope: "desktop" | "mobile" }) {
  const text =
    (key: "dateFrom" | "dateTo" | "search") =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onFilterChange(key, event.target.value);

  return (
    <>
      <FilterField label="Tìm kiếm">
        <FilterInput
          active={filters.search.trim().length > 0}
          autoComplete="off"
          data-testid={`${scope}-result-search`}
          onChange={text("search")}
          placeholder="Học sinh, mã hoặc lớp"
          type="search"
          value={filters.search}
        />
      </FilterField>
      <SelectField
        label="Lớp"
        onChange={(event) => onFilterChange("classId", event.target.value)}
        testId={`${scope}-result-class`}
        value={filters.classId}
      >
        <option value="">Tất cả lớp</option>
        {classOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Khối"
        onChange={(event) => onFilterChange("grade", event.target.value)}
        testId={`${scope}-result-grade`}
        value={filters.grade}
      >
        <option value="">Tất cả khối</option>
        {gradeOptions.map((grade) => (
          <option key={grade} value={grade}>
            Khối {grade}
          </option>
        ))}
      </SelectField>
      <FilterField label="Từ ngày">
        <FilterInput
          active={filters.dateFrom !== ""}
          data-testid={`${scope}-result-date-from`}
          max={filters.dateTo || undefined}
          onChange={text("dateFrom")}
          type="date"
          value={filters.dateFrom}
        />
      </FilterField>
      <FilterField label="Đến ngày">
        <FilterInput
          active={filters.dateTo !== ""}
          data-testid={`${scope}-result-date-to`}
          min={filters.dateFrom || undefined}
          onChange={text("dateTo")}
          type="date"
          value={filters.dateTo}
        />
      </FilterField>
      <SelectField
        label="Vở"
        onChange={(event) =>
          onFilterChange(
            "notebookStatus",
            event.target.value as LearningResultNotebookFilter,
          )
        }
        testId={`${scope}-result-notebook`}
        value={filters.notebookStatus}
      >
        <option value="">Tất cả</option>
        <option value="pending">Chờ chấm</option>
        <option value="submitted">Đã nộp</option>
        <option value="not_submitted">Chưa nộp</option>
        <option value="not_required">Không yêu cầu</option>
      </SelectField>
      <SelectField
        label="Tình trạng điểm"
        onChange={(event) =>
          onFilterChange(
            "scoreStatus",
            event.target.value as LearningResultScoreFilter,
          )
        }
        testId={`${scope}-result-score`}
        value={filters.scoreStatus}
      >
        <option value="">Tất cả</option>
        <option value="scored">Có điểm</option>
        <option value="unscored">Chưa có điểm</option>
        <option value="below_five">Dưới 5</option>
        <option value="attention">Cần chú ý</option>
      </SelectField>
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
      <FilterSelect
        active={value !== ""}
        data-testid={testId}
        onChange={onChange}
        value={value}
      >
        {children}
      </FilterSelect>
    </FilterField>
  );
}
