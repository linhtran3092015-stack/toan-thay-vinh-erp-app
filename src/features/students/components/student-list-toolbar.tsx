import type { RefObject } from "react";
import Link from "next/link";

import { FilterTrigger } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { Button, getButtonClassName } from "@/components/ui/button";

interface StudentListToolbarProps {
  activeFilterCount: number;
  canCreateStudent: boolean;
  canImportStudents?: boolean;
  canManageStatus?: boolean;
  createHref: string;
  filterButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenBulkTransition?: () => void;
  onOpenFilters: () => void;
  resultCount: number;
  /** Lifecycle summary for the page context line. */
  summary?: string;
  totalCount: number;
}

/**
 * Page header (design 06a): title + lifecycle summary, one primary action
 * ("Thêm học sinh"), secondary actions, mobile filter trigger.
 */
export function StudentListToolbar({
  activeFilterCount,
  canCreateStudent,
  canImportStudents = false,
  canManageStatus = false,
  createHref,
  filterButtonRef,
  onOpenBulkTransition,
  onOpenFilters,
  resultCount,
  summary,
  totalCount,
}: StudentListToolbarProps) {
  return (
    <PageHeader
      actions={
        <>
          <FilterTrigger
            activeCount={activeFilterCount}
            className="students-filter-trigger"
            onClick={onOpenFilters}
            ref={filterButtonRef}
          />
          {canImportStudents ? (
            <Link className={getButtonClassName({ variant: "secondary" })} href="/imports/students">
              Nhập từ file
            </Link>
          ) : null}
          {canManageStatus ? (
            <Button onClick={onOpenBulkTransition} variant="secondary">
              Chuyển trạng thái hàng loạt
            </Button>
          ) : null}
          {canCreateStudent ? (
            <Link className={getButtonClassName()} href={createHref}>
              Thêm học sinh
            </Link>
          ) : null}
        </>
      }
      title="Học sinh"
    >
      <p className="mt-1 text-secondary text-text-muted">
        {summary ?? `${totalCount} học sinh`}
        {resultCount !== totalCount ? ` · ${resultCount} khớp bộ lọc` : ""}
      </p>
    </PageHeader>
  );
}
