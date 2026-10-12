"use client";

import { useEffect, useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BulkActionBar } from "@/components/patterns/bulk-action-bar";
import { FilterInput } from "@/components/patterns/filter-bar";
import { TableState } from "@/components/patterns/data-table-frame";
import { Pagination } from "@/components/patterns/pagination";
import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Button } from "@/components/ui/button";
import { BulkStatusTransitionDialog } from "./components/bulk-status-transition-dialog";
import { StudentFilters } from "./components/student-filters";
import { StudentListEmptyState } from "./components/student-list-empty-state";
import { StudentListToolbar } from "./components/student-list-toolbar";
import { StudentMobileCard } from "./components/student-mobile-card";
import { StudentTable } from "./components/student-table";
import type {
  StudentDirectoryFiltersState,
  StudentDirectoryItem,
} from "./read-models";
import {
  createStudentSearchIndex,
  filterIndexedStudents,
  hasActiveStudentFilters,
  countActiveStudentFilters,
  paginateStudents,
  studentStatusMeta,
} from "./student-filters";
import {
  getStudentDirectoryHref,
  getStudentDirectoryQuery,
  parseStudentDirectoryViewState,
  resetStudentDirectoryViewState,
  serializeStudentDirectoryViewState,
} from "./student-directory-url-state";
import type { StudentLifecycleStatus } from "@/types/domain";

interface StudentListPageProps {
  canCreateStudent?: boolean;
  canImportStudents?: boolean;
  canManageStatus?: boolean;
  students: StudentDirectoryItem[];
}

/** Quick chips map straight onto the lifecycle status filter. */
const quickStatusValues = ["all", "active", "reserved", "waiting_class", "withdrawn"] as const;
type QuickStatusValue = (typeof quickStatusValues)[number];

export function StudentListPage({
  canCreateStudent = false,
  canImportStudents = false,
  canManageStatus = false,
  students,
}: StudentListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isBulkTransitionOpen, setIsBulkTransitionOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const classNames = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => student.activeEnrollment?.classInfo?.name)
            .filter(
              (value): value is string =>
                typeof value === "string" && value.length > 0,
            ),
        ),
      ).sort((left, right) => left.localeCompare(right, "vi")),
    [students],
  );

  const [filters, setFilters] = useState<StudentDirectoryFiltersState>(() => {
    return parseStudentDirectoryViewState(searchParams, classNames).filters;
  });
  const [page, setPage] = useState<number>(() => {
    return parseStudentDirectoryViewState(searchParams, classNames).page;
  });

  const debouncedUrlSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Sync URL in address bar without triggering Next.js server component revalidation
  const syncUrlState = (
    nextFilters: StudentDirectoryFiltersState,
    nextPage: number,
    immediate = false,
  ) => {
    if (debouncedUrlSyncRef.current) {
      clearTimeout(debouncedUrlSyncRef.current);
      debouncedUrlSyncRef.current = null;
    }

    const apply = () => {
      if (typeof window === "undefined") return;
      const currentParams = new URLSearchParams(window.location.search);
      const nextHref = getStudentDirectoryHref(currentParams, {
        filters: nextFilters,
        page: nextPage,
      });
      window.history.replaceState(null, "", nextHref);
    };

    if (immediate) {
      apply();
    } else {
      debouncedUrlSyncRef.current = setTimeout(apply, 300);
    }
  };

  // Support browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const currentParams = new URLSearchParams(window.location.search);
      const parsed = parseStudentDirectoryViewState(currentParams, classNames);
      setFilters(parsed.filters);
      setPage(parsed.page);
      setSelectedIds(new Set());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (debouncedUrlSyncRef.current) {
        clearTimeout(debouncedUrlSyncRef.current);
      }
    };
  }, [classNames]);

  const indexedStudents = useMemo(
    () => createStudentSearchIndex(students),
    [students],
  );

  const deferredFilters = useDeferredValue(filters);

  const filteredStudents = useMemo(
    () => filterIndexedStudents(indexedStudents, deferredFilters),
    [indexedStudents, deferredFilters],
  );

  // Chip counts respect every other filter so the numbers match what a click shows.
  const statusCounts = useMemo(() => {
    const base = filterIndexedStudents(indexedStudents, { ...deferredFilters, status: "all" });
    const counts = new Map<string, number>();
    for (const student of base) {
      counts.set(student.lifecycleStatus, (counts.get(student.lifecycleStatus) ?? 0) + 1);
    }
    return { counts, total: base.length };
  }, [indexedStudents, deferredFilters]);

  const quickChips: QuickFilterChip<QuickStatusValue>[] = quickStatusValues.map((value) => ({
    value,
    label: value === "all" ? "Tất cả" : studentStatusMeta[value as StudentLifecycleStatus].label,
    count: value === "all" ? statusCounts.total : (statusCounts.counts.get(value) ?? 0),
  }));

  const lifecycleSummary = useMemo(() => {
    const count = (status: StudentLifecycleStatus) =>
      students.filter((student) => student.lifecycleStatus === status).length;
    return `${count("active")} đang học · ${count("reserved")} bảo lưu · ${count("withdrawn")} đã nghỉ`;
  }, [students]);

  const pagination = useMemo(
    () => paginateStudents(filteredStudents, page),
    [filteredStudents, page],
  );

  // Bulk selection only covers rows the user can see; any view change drops it.
  const clearSelection = () => setSelectedIds(new Set());

  const updateFilter = (
    key: keyof StudentDirectoryFiltersState,
    value: string,
  ) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
    clearSelection();
    syncUrlState(nextFilters, 1, true);
  };

  const handleSearchChange = (value: string) => {
    const nextFilters = { ...filters, search: value };
    setFilters(nextFilters);
    setPage(1);
    clearSelection();
    syncUrlState(nextFilters, 1, false);
  };

  const handleSearchSubmit = () => {
    syncUrlState(filters, page, true);
  };

  const resetFilters = () => {
    if (debouncedUrlSyncRef.current) {
      clearTimeout(debouncedUrlSyncRef.current);
      debouncedUrlSyncRef.current = null;
    }
    const nextViewState = resetStudentDirectoryViewState();
    setFilters(nextViewState.filters);
    setPage(1);
    clearSelection();
    syncUrlState(nextViewState.filters, 1, true);
  };

  const updatePage = (newPage: number) => {
    setPage(newPage);
    clearSelection();
    if (typeof window !== "undefined") {
      const currentParams = new URLSearchParams(window.location.search);
      const nextHref = getStudentDirectoryHref(currentParams, {
        filters,
        page: newPage,
      });
      window.history.pushState(null, "", nextHref);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const directoryQuery = useMemo(() => {
    const params = serializeStudentDirectoryViewState(new URLSearchParams(), {
      filters,
      page,
    });
    return getStudentDirectoryQuery(params);
  }, [filters, page]);

  const activeFilterCount = countActiveStudentFilters(filters);
  const hasActiveFilters = hasActiveStudentFilters(filters);
  const createHref = directoryQuery
    ? `/students/new?${directoryQuery}`
    : "/students/new";
  const isEmptyByFilter = filteredStudents.length === 0 && hasActiveFilters;
  const summarySuffix =
    filters.className !== "all" ? `lọc theo lớp ${filters.className}` : undefined;

  const emptyByFilterState = (
    <TableState>
      <p className="text-body font-semibold text-text-strong">Không có học sinh khớp bộ lọc</p>
      <p className="text-secondary text-text-muted">Nới rộng điều kiện hoặc xóa bộ lọc để xem lại danh sách.</p>
      <Button className="mt-2" onClick={resetFilters} size="sm" variant="secondary">
        Xóa lọc
      </Button>
    </TableState>
  );

  return (
    <div className="students-directory grid gap-5">
      <StudentListToolbar
        activeFilterCount={activeFilterCount}
        canCreateStudent={canCreateStudent}
        canImportStudents={canImportStudents}
        canManageStatus={canManageStatus}
        createHref={createHref}
        filterButtonRef={filterTriggerRef}
        onOpenBulkTransition={() => setIsBulkTransitionOpen(true)}
        onOpenFilters={() => setIsMobileFiltersOpen(true)}
        resultCount={filteredStudents.length}
        summary={lifecycleSummary}
        totalCount={students.length}
      />

      {/* Narrow layouts search inline (design 06c); the other fields live in the sheet. */}
      <div className="students-mobile-search">
        <FilterInput
          active={filters.search.trim().length > 0}
          aria-label="Tìm học sinh"
          autoComplete="off"
          className="h-11"
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Tên, mã, SĐT phụ huynh"
          type="search"
          value={filters.search}
        />
      </div>

      <StudentFilters
        activeFilterCount={activeFilterCount}
        classNames={classNames}
        filters={filters}
        isMobileOpen={isMobileFiltersOpen}
        onCloseMobile={() => setIsMobileFiltersOpen(false)}
        onFilterChange={updateFilter}
        onReset={resetFilters}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        resultCount={filteredStudents.length}
        returnFocusRef={filterTriggerRef}
        searchValue={filters.search}
      />

      {/* A lifecycle status outside the quick chips (e.g. completed) leaves every chip unpressed. */}
      <QuickFilterChips<QuickStatusValue | "">
        chips={quickChips}
        label="Lọc nhanh theo trạng thái"
        onChange={(value) => updateFilter("status", value)}
        value={(quickStatusValues as readonly string[]).includes(filters.status) ? (filters.status as QuickStatusValue) : ""}
      />

      {canManageStatus ? (
        <BulkActionBar onClear={clearSelection} returnFocusRefs={[selectAllRef, filterTriggerRef]} selectedCount={selectedIds.size} subject="học sinh">
          <Button onClick={() => setIsBulkTransitionOpen(true)} size="sm" variant="secondary">
            Chuyển trạng thái…
          </Button>
        </BulkActionBar>
      ) : null}

      {filteredStudents.length === 0 && !hasActiveFilters ? (
        <StudentListEmptyState />
      ) : (
        <div className="students-directory-results grid gap-3">
          <p aria-live="polite" className="sr-only">
            Hiển thị {pagination.start}-{pagination.end} của {filteredStudents.length} học sinh
          </p>
          <StudentTable
            directoryQuery={directoryQuery}
            selectAllRef={selectAllRef}
            empty={emptyByFilterState}
            footer={
              <Pagination
                itemLabel="học sinh"
                label="Phân trang học sinh"
                onPageChange={updatePage}
                page={pagination.page}
                pageCount={pagination.pageCount}
                rangeEnd={pagination.end}
                rangeStart={pagination.start}
                summarySuffix={summarySuffix}
                total={filteredStudents.length}
                variant="frame"
              />
            }
            onToggleAll={toggleAll}
            onToggleStudent={toggleStudent}
            selectable={canManageStatus}
            selectedIds={selectedIds}
            status={isEmptyByFilter ? "empty" : "ready"}
            students={pagination.rows}
          />

          <div className="students-directory-record-list grid gap-2">
            <p className="flex items-center justify-between text-secondary text-text-muted">
              <span>
                {filteredStudents.length} học sinh{summarySuffix ? ` · ${filters.className}` : ""}
              </span>
              {hasActiveFilters ? (
                <button
                  className="-my-3 min-h-11 rounded-md px-2 font-semibold text-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  onClick={resetFilters}
                  type="button"
                >
                  Xóa lọc
                </button>
              ) : null}
            </p>
            {isEmptyByFilter ? (
              <div className="rounded-lg border border-border-subtle bg-surface-base">{emptyByFilterState}</div>
            ) : (
              <>
                <ResponsiveRecordList label="Danh sách học sinh">
                  {pagination.rows.map((student) => (
                    <StudentMobileCard
                      directoryQuery={directoryQuery}
                      key={student.id}
                      student={student}
                    />
                  ))}
                </ResponsiveRecordList>
                <Pagination
                  itemLabel="học sinh"
                  label="Phân trang học sinh (danh sách gọn)"
                  onPageChange={updatePage}
                  page={pagination.page}
                  pageCount={pagination.pageCount}
                  rangeEnd={pagination.end}
                  rangeStart={pagination.start}
                  total={filteredStudents.length}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Mounted only while open so each opening reads the current chip as its source and starts with no stale preview. */}
      {isBulkTransitionOpen ? (
        <BulkStatusTransitionDialog
          initialSourceStatus={
            filters.status !== "all"
              ? (filters.status as StudentLifecycleStatus)
              : "interested"
          }
          isOpen
          onClose={() => setIsBulkTransitionOpen(false)}
          onSuccess={() => {
            clearSelection();
            router.refresh();
          }}
          selectedStudentIds={Array.from(selectedIds)}
        />
      ) : null}
    </div>
  );
}
