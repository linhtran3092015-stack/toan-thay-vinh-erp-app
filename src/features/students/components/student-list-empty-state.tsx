import { EmptyState } from "@/components/shared/empty-state";

interface StudentListEmptyStateProps {
  hasActiveFilters: boolean;
}

export function StudentListEmptyState({ hasActiveFilters }: StudentListEmptyStateProps) {
  return (
    <EmptyState
      description={hasActiveFilters
        ? "Không có học viên nào khớp với từ khóa hoặc bộ lọc hiện tại. Hãy thử nới rộng điều kiện lọc."
        : "Chưa có học viên nào trong danh sách hiện tại."}
      title={hasActiveFilters ? "Không tìm thấy học viên" : "Chưa có học viên"}
    />
  );
}
