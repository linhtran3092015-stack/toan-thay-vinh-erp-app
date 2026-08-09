import type { RefObject } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";

interface StudentListToolbarProps {
  activeFilterCount: number;
  canCreateStudent: boolean;
  createHref: string;
  filterButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenFilters: () => void;
  resultCount: number;
  totalCount: number;
}

export function StudentListToolbar({
  activeFilterCount,
  canCreateStudent,
  createHref,
  filterButtonRef,
  onOpenFilters,
  resultCount,
  totalCount,
}: StudentListToolbarProps) {
  return (
    <PageHeader
      actions={
        <>
          <Button
            className="students-filter-trigger min-h-11"
            onClick={onOpenFilters}
            ref={filterButtonRef}
            variant="outline"
          >
            {activeFilterCount > 0 ? `Bộ lọc (${activeFilterCount})` : "Bộ lọc"}
          </Button>
          {canCreateStudent ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-action-primary bg-action-primary px-4 text-control font-semibold text-text-on-primary transition-colors hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
              href={createHref}
            >
              Thêm học viên
            </Link>
          ) : null}
        </>
      }
      context={<span className="text-secondary text-text-muted">{resultCount}/{totalCount} kết quả</span>}
      title="Học viên"
    />
  );
}
