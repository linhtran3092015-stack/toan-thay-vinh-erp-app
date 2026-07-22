"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { mockStudents, studentClassNames, studentSaleOwners } from "./mock-data";
import {
  defaultStudentFilters,
  filterStudents,
  paginateStudents,
} from "./student-filters";
import { StudentFilters } from "./components/student-filters";
import { StudentListEmptyState } from "./components/student-list-empty-state";
import { StudentListErrorState } from "./components/student-list-error-state";
import { StudentListToolbar } from "./components/student-list-toolbar";
import { StudentMobileCard } from "./components/student-mobile-card";
import { StudentTable } from "./components/student-table";
import { StudentTableSkeleton } from "./components/student-table-skeleton";
import type { StudentFiltersState, StudentListDemoState } from "./types";

interface StudentListPageProps {
  canCreateStudent?: boolean;
  demoState?: Exclude<StudentListDemoState, "denied">;
}

export function StudentListPage({
  canCreateStudent = true,
  demoState = "default",
}: StudentListPageProps) {
  const [filters, setFilters] =
    useState<StudentFiltersState>(defaultStudentFilters);
  const [page, setPage] = useState(1);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const students = useMemo(
    () => (demoState === "empty" ? [] : mockStudents),
    [demoState],
  );
  const filteredStudents = useMemo(
    () => filterStudents(students, filters),
    [filters, students],
  );
  const pagination = useMemo(
    () => paginateStudents(filteredStudents, page),
    [filteredStudents, page],
  );

  const handleFiltersChange = (nextFilters: StudentFiltersState) => {
    setPage(1);
    setFilters(nextFilters);
  };

  const isLoading = demoState === "loading";
  const isError = demoState === "error";

  return (
    <div className="grid gap-4">
      <StudentListToolbar
        canCreateStudent={canCreateStudent}
        onOpenFilters={() => setIsMobileFiltersOpen(true)}
        resultCount={isLoading ? students.length : filteredStudents.length}
        totalCount={mockStudents.length}
      />

      <StudentFilters
        classNames={studentClassNames}
        filters={filters}
        isMobileOpen={isMobileFiltersOpen}
        onChange={handleFiltersChange}
        onCloseMobile={() => setIsMobileFiltersOpen(false)}
        saleOwners={studentSaleOwners}
      />

      {isLoading ? (
        <StudentTableSkeleton />
      ) : isError ? (
        <StudentListErrorState />
      ) : filteredStudents.length === 0 ? (
        <StudentListEmptyState />
      ) : (
        <>
          <StudentTable students={pagination.rows} />
          <div className="grid gap-3 lg:hidden">
            {pagination.rows.map((student) => (
              <StudentMobileCard key={student.id} student={student} />
            ))}
          </div>
          <StudentPagination
            end={pagination.end}
            page={pagination.page}
            pageCount={pagination.pageCount}
            setPage={setPage}
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
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  start: number;
  total: number;
}

function StudentPagination({
  end,
  page,
  pageCount,
  setPage,
  start,
  total,
}: StudentPaginationProps) {
  const pages = Array.from({ length: pageCount }).map((_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm shadow-card md:flex-row md:items-center md:justify-between">
      <p className="text-ink-muted">
        Hiển thị {start}-{end} của {total} học viên · Trang {page}/{pageCount}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          variant="outline"
        >
          Previous
        </Button>
        {pages.map((pageNumber) => (
          <Button
            className="min-h-11 min-w-11"
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            variant={pageNumber === page ? "secondary" : "ghost"}
          >
            {pageNumber}
          </Button>
        ))}
        <Button
          className="min-h-11"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
