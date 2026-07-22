import { ErrorState } from "@/components/shared/error-state";

export function StudentDetailErrorState() {
  return (
    <ErrorState
      description="Đây là trạng thái lỗi demo của Task 2B. Chưa có kết nối dữ liệu thật."
      title="Không thể tải hồ sơ học viên"
    />
  );
}
