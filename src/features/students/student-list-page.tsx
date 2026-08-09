"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Button } from "@/components/ui/button";
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
  filterStudents,
  hasActiveStudentFilters,
  countActiveStudentFilters,
  paginateStudents,
} from "./student-filters";
import {
  areStudentDirectoryFiltersEqual,
  getStudentDirectoryHref,
  getStudentDirectoryQuery,
  mergePendingStudentDirectoryFilter,
  parseStudentDirectoryViewState,
  resetStudentDirectoryViewState,
} from "./student-directory-url-state";

interface StudentListPageProps {
  canCreateStudent?: boolean;
  students: StudentDirectoryItem[];
}

export function StudentListPage({
  canCreateStudent = false,
  students,
}: StudentListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingFiltersRef = useRef<StudentDirectoryFiltersState | null>(null);

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

  const viewState = useMemo(
    () => parseStudentDirectoryViewState(searchParams, classNames),
    [classNames, searchParams],
  );

  useEffect(() => {
    if (
      pendingFiltersRef.current === null ||
      areStudentDirectoryFiltersEqual(
        pendingFiltersRef.current,
        viewState.filters,
      )
    ) {
      pendingFiltersRef.current = viewState.filters;
    }
  }, [viewState.filters]);

  const filteredStudents = useMemo(
    () => filterStudents(students, viewState.filters),
    [students, viewState.filters],
  );

  const pagination = useMemo(
    () => paginateStudents(filteredStudents, viewState.page),
    [filteredStudents, viewState.page],
  );

  const updateFilter = (
    key: keyof StudentDirectoryFiltersState,
    value: string,
  ) => {
    const filters = mergePendingStudentDirectoryFilter(
      pendingFiltersRef.current,
      viewState.filters,
      key,
      value,
    );
    pendingFiltersRef.current = filters;

    router.replace(
      getStudentDirectoryHref(searchParams, { filters, page: 1 }),
      { scroll: false },
    );
  };

  const resetFilters = () => {
    const viewState = resetStudentDirectoryViewState();
    pendingFiltersRef.current = viewState.filters;

    router.replace(getStudentDirectoryHref(searchParams, viewState), {
      scroll: false,
    });
  };

  const updatePage = (page: number) => {
    router.push(
      getStudentDirectoryHref(searchParams, {
        filters: viewState.filters,
        page,
      }),
      { scroll: false },
    );
  };

  const directoryQuery = getStudentDirectoryQuery(searchParams);
  const activeFilterCount = countActiveStudentFilters(viewState.filters);
  const createHref = directoryQuery
    ? `/students/new?${directoryQuery}`
    : "/students/new";

  return (
    <div className="students-directory grid gap-6">
      <StudentListToolbar
        activeFilterCount={activeFilterCount}
        canCreateStudent={canCreateStudent}
        createHref={createHref}
        filterButtonRef={filterTriggerRef}
        onOpenFilters={() => setIsMobileFiltersOpen(true)}
        resultCount={filteredStudents.length}
        totalCount={students.length}
      />

      <StudentFilters
        activeFilterCount={activeFilterCount}
        classNames={classNames}
        filters={viewState.filters}
        isMobileOpen={isMobileFiltersOpen}
        onFilterChange={updateFilter}
        onCloseMobile={() => setIsMobileFiltersOpen(false)}
        onReset={resetFilters}
        returnFocusRef={filterTriggerRef}
      />

      {filteredStudents.length === 0 ? (
        <StudentListEmptyState
          hasActiveFilters={hasActiveStudentFilters(viewState.filters)}
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
