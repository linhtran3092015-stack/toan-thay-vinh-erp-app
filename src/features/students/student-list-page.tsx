"use client";

import { useMemo, useState } from "react";

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
  defaultStudentFilters,
  filterStudents,
  paginateStudents,
} from "./student-filters";

interface StudentListPageProps {
  canCreateStudent?: boolean;
  students: StudentDirectoryItem[];
}

export function StudentListPage({
  canCreateStudent = false,
  students,
}: StudentListPageProps) {
  const [filters, setFilters] =
    useState<StudentDirectoryFiltersState>(
      defaultStudentFilters,
    );
  const [page, setPage] = useState(1);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] =
    useState(false);

  const classNames = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map(
              (student) =>
                student.activeEnrollment?.classInfo?.name,
            )
            .filter(
              (value): value is string =>
                typeof value === "string" &&
                value.length > 0,
            ),
        ),
      ).sort((left, right) =>
        left.localeCompare(right, "vi"),
      ),
    [students],
  );

  const filteredStudents = useMemo(
    () => filterStudents(students, filters),
    [filters, students],
  );

  const pagination = useMemo(
    () => paginateStudents(filteredStudents, page),
    [filteredStudents, page],
  );

  const handleFiltersChange = (
    nextFilters: StudentDirectoryFiltersState,
  ) => {
    setPage(1);
    setFilters(nextFilters);
  };

  return (
    <div className="grid gap-4">
      <StudentListToolbar
        canCreateStudent={canCreateStudent}
        onOpenFilters={() =>
          setIsMobileFiltersOpen(true)
        }
        resultCount={filteredStudents.length}
        totalCount={students.length}
      />

      <StudentFilters
        classNames={classNames}
        filters={filters}
        isMobileOpen={isMobileFiltersOpen}
        onChange={handleFiltersChange}
        onCloseMobile={() =>
          setIsMobileFiltersOpen(false)
        }
      />

      {filteredStudents.length === 0 ? (
        <StudentListEmptyState />
      ) : (
        <>
          <StudentTable students={pagination.rows} />

          <div className="grid gap-3 lg:hidden">
            {pagination.rows.map((student) => (
              <StudentMobileCard
                key={student.id}
                student={student}
              />
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
  const pages = Array.from({
    length: pageCount,
  }).map((_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm shadow-card md:flex-row md:items-center md:justify-between">
      <p className="text-ink-muted">
        Hiển thị {start}-{end} của {total} học viên ·
        Trang {page}/{pageCount}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          variant="outline"
        >
          Trước
        </Button>

        {pages.map((pageNumber) => (
          <Button
            className="min-h-11 min-w-11"
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            variant={
              pageNumber === page ? "secondary" : "ghost"
            }
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
          Sau
        </Button>
      </div>
    </div>
  );
}
