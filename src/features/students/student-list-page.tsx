"use client";

import { useEffect, useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  canManageStatus?: boolean;
  students: StudentDirectoryItem[];
}

export function StudentListPage({
  canCreateStudent = false,
  canManageStatus = false,
  students,
}: StudentListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isBulkTransitionOpen, setIsBulkTransitionOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

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
      window.history.replaceState(window.history.state, "", nextHref);
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

  const pagination = useMemo(
    () => paginateStudents(filteredStudents, page),
    [filteredStudents, page],
  );

  const updateFilter = (
    key: keyof StudentDirectoryFiltersState,
    value: string,
  ) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
    syncUrlState(nextFilters, 1, true);
  };

  const handleSearchChange = (value: string) => {
    const nextFilters = { ...filters, search: value };
    setFilters(nextFilters);
    setPage(1);
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
    syncUrlState(nextViewState.filters, 1, true);
  };

  const updatePage = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== "undefined") {
      const currentParams = new URLSearchParams(window.location.search);
      const nextHref = getStudentDirectoryHref(currentParams, {
        filters,
        page: newPage,
      });
      window.history.pushState(window.history.state, "", nextHref);
    }
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

  return (
    <div className="students-directory grid gap-6">
      <StudentListToolbar
        activeFilterCount={activeFilterCount}
        canCreateStudent={canCreateStudent}
        canManageStatus={canManageStatus}
        createHref={createHref}
        filterButtonRef={filterTriggerRef}
        onOpenBulkTransition={() => setIsBulkTransitionOpen(true)}
        onOpenFilters={() => setIsMobileFiltersOpen(true)}
        resultCount={filteredStudents.length}
        totalCount={students.length}
      />

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
        returnFocusRef={filterTriggerRef}
        searchValue={filters.search}
      />

      {filteredStudents.length === 0 ? (
        <StudentListEmptyState
          hasActiveFilters={hasActiveFilters}
        />
      ) : (
        <>
          <div className="students-directory-results">
            <p aria-live="polite" className="mb-3 text-secondary text-text-muted">
              Hiển thị {pagination.start}-{pagination.end} của {filteredStudents.length} học viên
            </p>
            <StudentTable
              directoryQuery={directoryQuery}
              students={pagination.rows}
            />
            <ResponsiveRecordList
              className="students-directory-record-list"
              label="Danh sách học viên"
            >
              {pagination.rows.map((student) => (
                <StudentMobileCard
                  directoryQuery={directoryQuery}
                  key={student.id}
                  student={student}
                />
              ))}
            </ResponsiveRecordList>
          </div>

          <StudentPagination
            end={pagination.end}
            onPageChange={updatePage}
            page={pagination.page}
            pageCount={pagination.pageCount}
            start={pagination.start}
            total={filteredStudents.length}
          />
        </>
      )}

      <BulkStatusTransitionDialog
        initialSourceStatus={
          filters.status !== "all"
            ? (filters.status as StudentLifecycleStatus)
            : "interested"
        }
        isOpen={isBulkTransitionOpen}
        onClose={() => setIsBulkTransitionOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

interface StudentPaginationProps {
  end: number;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  start: number;
  total: number;
}

function StudentPagination({
  end,
  onPageChange,
  page,
  pageCount,
  start,
  total,
}: StudentPaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Phân trang học viên"
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-body text-text-muted md:flex-row md:items-center md:justify-between"
    >
      <p>
        Hiển thị {start}-{end} của {total} học viên · Trang {page}/{pageCount}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          variant="outline"
        >
          Trước
        </Button>

        {pages.map((pageNumber) => (
          <Button
            aria-current={pageNumber === page ? "page" : undefined}
            className="min-h-11 min-w-11"
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            variant={pageNumber === page ? "secondary" : "ghost"}
          >
            {pageNumber}
          </Button>
        ))}

        <Button
          className="min-h-11"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          variant="outline"
        >
          Sau
        </Button>
      </div>
    </nav>
  );
}
