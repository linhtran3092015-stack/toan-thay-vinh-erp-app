"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { LearningResultsFilters } from "@/features/learning-results/components/learning-results-filters";
import { LearningResultsTable } from "@/features/learning-results/components/learning-results-table";
import type {
  LearningResultDirectoryItem,
  LearningResultFiltersState,
} from "@/features/learning-results/read-models";

const PAGE_SIZE = 20;

const defaultFilters: LearningResultFiltersState = {
  classId: "",
  dateFrom: "",
  dateTo: "",
  grade: "",
  notebookStatus: "",
  search: "",
  scoreStatus: "",
};

interface LearningResultsPageProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  items: LearningResultDirectoryItem[];
}

export function LearningResultsPage({
  canViewSessions,
  canViewStudents,
  items,
}: LearningResultsPageProps) {
  const [filters, setFilters] =
    useState<LearningResultFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items.map((item) => [
            item.classId,
            { id: item.classId, label: item.className },
          ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label, "vi")),
    [items],
  );

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.classGrade))).sort(
        (left, right) => left - right,
      ),
    [items],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilters(item, filters)),
    [filters, items],
  );

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);
  const pageNumbers = getVisiblePageNumbers(currentPage, pageCount);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const summary = useMemo(() => summarizeResults(filteredItems), [filteredItems]);

  const updateFilters = (nextFilters: LearningResultFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ink-muted">
            Học vụ
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Kết quả học tập
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Theo dõi điểm kiểm tra, tình trạng vở và nhận xét theo từng buổi học.
          </p>
        </div>
        <p className="text-sm font-semibold text-ink-muted">
          {filteredItems.length}/{items.length} kết quả
        </p>
      </header>

      <section
        aria-label="Tổng quan kết quả"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <SummaryItem label="Kết quả đang xem" value={String(summary.total)} />
        <SummaryItem label="Điểm kiểm tra TB" value={formatAverage(summary.testAverage)} />
        <SummaryItem label="Điểm vở TB" value={formatAverage(summary.notebookAverage)} />
        <SummaryItem
          emphasis={summary.attentionCount > 0}
          label="Cần chú ý"
          value={String(summary.attentionCount)}
        />
      </section>

      <LearningResultsFilters
        classOptions={classOptions}
        filters={filters}
        gradeOptions={gradeOptions}
        hasActiveFilters={hasActiveFilters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          actionLabel={hasActiveFilters ? "Xóa bộ lọc" : undefined}
          description={
            hasActiveFilters
              ? "Không có kết quả nào phù hợp với điều kiện đang chọn."
              : "Chưa có kết quả học tập nào được ghi nhận."
          }
          onAction={hasActiveFilters ? resetFilters : undefined}
          title={hasActiveFilters ? "Không tìm thấy kết quả" : "Chưa có kết quả học tập"}
        />
      ) : (
        <>
          <LearningResultsTable
            canViewSessions={canViewSessions}
            canViewStudents={canViewStudents}
            items={pageItems}
          />

          <nav
            aria-label="Phân trang kết quả học tập"
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm shadow-card md:flex-row md:items-center md:justify-between"
          >
            <p className="text-ink-muted">
              Hiển thị {pageStart + 1}-
              {Math.min(pageStart + PAGE_SIZE, filteredItems.length)} của {filteredItems.length}
              {" "}kết quả · Trang {currentPage}/{pageCount}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                type="button"
                variant="outline"
              >
                Trước
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  className="min-h-11 min-w-11"
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                  variant={pageNumber === currentPage ? "secondary" : "ghost"}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                className="min-h-11"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
                type="button"
                variant="outline"
              >
                Sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function SummaryItem({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p
        className={`mt-2 text-xl font-bold ${emphasis ? "text-danger" : "text-ink"}`}
      >
        {value}
      </p>
    </article>
  );
}

function matchesFilters(
  item: LearningResultDirectoryItem,
  filters: LearningResultFiltersState,
): boolean {
  const search = normalizeSearch(filters.search);
  const searchableText = normalizeSearch(
    `${item.studentName} ${item.studentCode} ${item.className} ${item.classCode}`,
  );

  return (
    (!search || searchableText.includes(search)) &&
    (!filters.grade || item.classGrade === Number(filters.grade)) &&
    (!filters.classId || item.classId === filters.classId) &&
    (!filters.notebookStatus || item.notebookStatus === filters.notebookStatus) &&
    (!filters.scoreStatus || matchesScoreStatus(item, filters.scoreStatus)) &&
    (!filters.dateFrom || item.sessionDate >= filters.dateFrom) &&
    (!filters.dateTo || item.sessionDate <= filters.dateTo)
  );
}

function matchesScoreStatus(
  item: LearningResultDirectoryItem,
  status: string,
): boolean {
  if (status === "attention") {
    return needsAttention(item);
  }

  const complete =
    item.testScore !== null &&
    (item.notebookStatus === "not_required" ||
      (item.notebookStatus === "submitted" && item.notebookScore !== null));

  return status === "complete" ? complete : !complete;
}

function needsAttention(item: LearningResultDirectoryItem): boolean {
  return (
    item.notebookStatus === "not_submitted" ||
    (item.testScore !== null && item.testScore < 5) ||
    (item.notebookScore !== null && item.notebookScore < 5)
  );
}

function summarizeResults(items: readonly LearningResultDirectoryItem[]) {
  const testScores = items.flatMap((item) =>
    item.testScore === null ? [] : [item.testScore],
  );
  const notebookScores = items.flatMap((item) =>
    item.notebookScore === null ? [] : [item.notebookScore],
  );

  return {
    attentionCount: items.filter(needsAttention).length,
    notebookAverage: average(notebookScores),
    testAverage: average(testScores),
    total: items.length,
  };
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatAverage(value: number | null): string {
  return value === null ? "Chưa có" : `${value.toFixed(1)}/10`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function getVisiblePageNumbers(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.min(Math.max(1, currentPage - 2), pageCount - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}
