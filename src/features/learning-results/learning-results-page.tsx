"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

import { TableState } from "@/components/patterns/data-table-frame";
import { FilterInput, FilterTrigger } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import {
  QuickFilterChips,
  type QuickFilterChip,
} from "@/components/patterns/quick-filter-chips";
import { Button } from "@/components/ui/button";
import { LearningResultRecordList } from "@/features/learning-results/components/learning-result-record-list";
import { LearningResultsFilters } from "@/features/learning-results/components/learning-results-filters";
import { LearningResultsTable } from "@/features/learning-results/components/learning-results-table";
import {
  applyLearningResultQuickChip,
  countActiveLearningResultFilters,
  countLearningResultQuickChips,
  defaultLearningResultFilters,
  getLearningResultClassOptions,
  getLearningResultGradeOptions,
  getLearningResultQuickChip,
  getOldestLearningResultDate,
  learningResultQuickChipLabels,
  learningResultQuickChipValues,
  matchesLearningResultFilters,
  paginateLearningResults,
  reachesBeforeLoadedWindow,
  type LearningResultFilterChange,
  type LearningResultFiltersState,
  type LearningResultQuickChip,
} from "@/features/learning-results/learning-result-models";
import {
  LEARNING_RESULTS_LIMIT,
  type LearningResultDirectoryItem,
} from "@/features/learning-results/read-models";
import { formatIsoDate } from "@/lib/datetime";

/*
 * Responsive switch: the work area, not the device, picks the table or the
 * card list. The page root is a Tailwind container (`@container`) and the
 * table/filter bar show from `@min-[1072px]` = the table's `min-w-[1060px]`
 * + the 2px frame border + 10px of slack (laptop 1366px minus the sidebar and
 * page padding leaves ~1078px). The class names are spelled out in full so the
 * Tailwind scanner sees them; change all of them together.
 */

interface LearningResultsPageProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  items: LearningResultDirectoryItem[];
}

/**
 * Learning results directory (design 16a): header with the loaded count, quick
 * chips, filters, a framed table (cards on narrow widths) and a pager. Pure
 * props-in client state; filters are not in the URL.
 */
export function LearningResultsPage({
  canViewSessions,
  canViewStudents,
  items,
}: LearningResultsPageProps) {
  const [filters, setFilters] = useState<LearningResultFiltersState>(
    defaultLearningResultFilters,
  );
  const [page, setPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

  const isCapped = items.length === LEARNING_RESULTS_LIMIT;
  // Only a capped load can be missing older rows; find where it stops once.
  const oldestLoadedDate = useMemo(
    () => (isCapped ? getOldestLearningResultDate(items) : null),
    [isCapped, items],
  );

  const classOptions = useMemo(
    () => getLearningResultClassOptions(items),
    [items],
  );
  const gradeOptions = useMemo(
    () => getLearningResultGradeOptions(items),
    [items],
  );
  const filteredItems = useMemo(
    () => items.filter((item) => matchesLearningResultFilters(item, filters)),
    [filters, items],
  );
  const chipCounts = useMemo(
    () => countLearningResultQuickChips(items, filters),
    [filters, items],
  );
  const pagination = useMemo(
    () => paginateLearningResults(filteredItems, page),
    [filteredItems, page],
  );

  const activeFilterCount = countActiveLearningResultFilters(filters);
  const hasFilters = activeFilterCount > 0;
  const isEmptyByFilter = filteredItems.length === 0 && items.length > 0;
  const isBeforeLoadedWindow =
    oldestLoadedDate !== null &&
    reachesBeforeLoadedWindow(filters, oldestLoadedDate);

  const changeFilter: LearningResultFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(defaultLearningResultFilters);
    setPage(1);
  };
  const pressChip = (chip: LearningResultQuickChip) => {
    setFilters((current) => applyLearningResultQuickChip(current, chip));
    setPage(1);
  };

  // Counts come from the loaded rows only; while the range may reach past them
  // they would read as exact, so the chips go without numbers.
  const chips: QuickFilterChip<LearningResultQuickChip>[] =
    learningResultQuickChipValues.map((value) => ({
      count: isBeforeLoadedWindow ? undefined : chipCounts[value],
      countTone: value === "below_five" ? "danger" : "default",
      label: learningResultQuickChipLabels[value],
      value,
    }));

  const emptyState: ReactNode = isEmptyByFilter ? (
    <TableState>
      <p className="text-body font-semibold text-text-strong">
        {isBeforeLoadedWindow
          ? "Không có kết quả trong phần đã tải"
          : "Không có kết quả khớp bộ lọc"}
      </p>
      <p className="text-secondary text-text-muted">
        {isBeforeLoadedWindow
          ? `Khoảng ngày đang chọn vượt quá ${LEARNING_RESULTS_LIMIT} kết quả mới nhất; kết quả cũ hơn chưa được tải.`
          : "Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách."}
      </p>
      <Button className="mt-2" onClick={resetFilters} size="sm" variant="secondary">
        Xóa lọc
      </Button>
    </TableState>
  ) : (
    <TableState>
      <p className="text-body font-semibold text-text-strong">
        Chưa có kết quả học tập
      </p>
      <p className="text-secondary text-text-muted">
        Kết quả xuất hiện khi giáo viên nhập điểm và nhận xét ở từng buổi học.
      </p>
    </TableState>
  );

  const pager = (variant: "frame" | "standalone") => (
    <Pagination
      itemLabel="kết quả"
      label={
        variant === "frame"
          ? "Phân trang kết quả học tập"
          : "Phân trang kết quả học tập (danh sách gọn)"
      }
      onPageChange={setPage}
      page={pagination.page}
      pageCount={pagination.pageCount}
      rangeEnd={pagination.rangeEnd}
      rangeStart={pagination.rangeStart}
      total={pagination.total}
      variant={variant}
    />
  );

  return (
    <div className="learning-results-directory @container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        actions={
          <FilterTrigger
            activeCount={activeFilterCount}
            className="@min-[1072px]:hidden"
            onClick={() => setIsFilterOpen(true)}
            ref={filterTriggerRef}
          />
        }
        title="Kết quả học tập"
      >
        <p className="mt-1 text-secondary tabular-nums text-text-muted">
          {isCapped
            ? `${LEARNING_RESULTS_LIMIT} kết quả mới nhất (giới hạn tải)`
            : `${items.length} kết quả`}
          {filteredItems.length !== items.length
            ? ` · ${filteredItems.length} khớp bộ lọc`
            : ""}
        </p>
      </PageHeader>

      <div className="flex @min-[1072px]:hidden">
        <FilterInput
          active={filters.search.trim().length > 0}
          aria-label="Tìm kết quả học tập"
          autoComplete="off"
          className="h-11"
          onChange={(event) => changeFilter("search", event.target.value)}
          placeholder="Học sinh, mã hoặc lớp"
          type="search"
          value={filters.search}
        />
      </div>

      <LearningResultsFilters
        activeFilterCount={activeFilterCount}
        barWrapperClassName="hidden @min-[1072px]:block"
        classOptions={classOptions}
        filters={filters}
        gradeOptions={gradeOptions}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onFilterChange={changeFilter}
        onReset={resetFilters}
        resultCount={filteredItems.length}
        returnFocusRef={filterTriggerRef}
      />

      <QuickFilterChips
        chips={chips}
        className="max-md:[&_button]:h-11"
        label="Lọc nhanh kết quả"
        onChange={pressChip}
        value={getLearningResultQuickChip(filters)}
      />

      {isBeforeLoadedWindow && oldestLoadedDate ? (
        <div
          className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5"
          role="status"
        >
          <p className="text-secondary text-warning-ink">
            Khoảng ngày đang chọn vượt quá {LEARNING_RESULTS_LIMIT} kết quả mới
            nhất đã tải; từ {formatIsoDate(oldestLoadedDate)} trở về trước có
            thể thiếu kết quả.
          </p>
        </div>
      ) : null}

      <div className="learning-results-directory-results grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <p aria-live="polite" className="sr-only">
          {pagination.total === 0
            ? "Không có kết quả"
            : `Hiển thị ${pagination.rangeStart}-${pagination.rangeEnd} của ${pagination.total} kết quả`}
        </p>

        <div className="hidden @min-[1072px]:block">
          <LearningResultsTable
            canViewSessions={canViewSessions}
            canViewStudents={canViewStudents}
            empty={emptyState}
            footer={pagination.total > 0 ? pager("frame") : undefined}
            items={pagination.rows}
            status={filteredItems.length === 0 ? "empty" : "ready"}
          />
        </div>

        <div className="grid gap-2 @min-[1072px]:hidden">
          <p className="flex items-center justify-between text-secondary text-text-muted">
            <span className="tabular-nums">{filteredItems.length} kết quả</span>
            {hasFilters ? (
              <button
                className="-my-3 min-h-11 rounded-md px-2 font-semibold text-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                onClick={resetFilters}
                type="button"
              >
                Xóa lọc
              </button>
            ) : null}
          </p>
          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-base">
              {emptyState}
            </div>
          ) : (
            <>
              <LearningResultRecordList
                canViewSessions={canViewSessions}
                canViewStudents={canViewStudents}
                items={pagination.rows}
              />
              {pager("standalone")}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
