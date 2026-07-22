import { ErrorState } from "@/components/shared/error-state";

export function StudentListErrorState() {
  return (
    <ErrorState
      description="Đây là trạng thái lỗi demo của Task 2A. Chưa có kết nối dữ liệu thật."
      title="Không thể tải danh sách học viên"
    />
  );
}
