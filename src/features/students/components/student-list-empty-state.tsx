import { EmptyState } from "@/components/shared/empty-state";

export function StudentListEmptyState() {
  return (
    <EmptyState
      description="Không có học viên nào khớp với từ khóa hoặc bộ lọc hiện tại. Hãy thử nới rộng điều kiện lọc."
      title="Không tìm thấy học viên"
    />
  );
}
