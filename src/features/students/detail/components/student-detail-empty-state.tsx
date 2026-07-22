import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

interface StudentDetailEmptyStateProps {
  title?: string;
}

export function StudentDetailEmptyState({
  title = "Không tìm thấy hồ sơ học viên",
}: StudentDetailEmptyStateProps) {
  return (
    <div className="grid gap-4">
      <EmptyState
        description="Mã nội bộ trong URL không khớp với dữ liệu mock của Task 2B."
        title={title}
      />
      <div>
        <Link href="/students">
          <Button variant="secondary">Quay lại danh sách học viên</Button>
        </Link>
      </div>
    </div>
  );
}
