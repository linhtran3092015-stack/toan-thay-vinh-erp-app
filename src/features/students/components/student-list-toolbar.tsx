import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StudentListToolbarProps {
  canCreateStudent: boolean;
  resultCount: number;
  totalCount: number;
  onOpenFilters: () => void;
}

export function StudentListToolbar({
  canCreateStudent,
  onOpenFilters,
  resultCount,
  totalCount,
}: StudentListToolbarProps) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Học viên</h1>
          <span className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            {resultCount}/{totalCount}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {resultCount} kết quả theo bộ lọc hiện tại. Các nút thao tác đang ở
          trạng thái mock, chưa ghi dữ liệu thật.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 lg:hidden" onClick={onOpenFilters} variant="outline">
          Bộ lọc
        </Button>
        <Button disabled size="md" variant="outline">
          Import Excel
        </Button>
        <Button disabled size="md" variant="outline">
          Xuất dữ liệu
        </Button>
        {canCreateStudent ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-secondary bg-secondary px-4 text-sm font-semibold text-white transition hover:bg-secondary-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25"
            href="/students/new"
          >
            Thêm học viên
          </Link>
        ) : (
          <Button disabled size="md" variant="secondary">
            Thêm học viên
          </Button>
        )}
      </div>
    </section>
  );
}
