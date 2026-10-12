import { EmptyState } from "@/components/shared/empty-state";

export function StudentListEmptyState() {
  return (
    <EmptyState
      description="Chưa có học viên nào trong danh sách hiện tại."
      title="Chưa có học viên"
    />
  );
}
