# Database Conventions

Đây là quy ước nền tảng, chưa phải thiết kế schema nghiệp vụ.

## Tên và khóa

- Dùng `snake_case` cho schema, table, column, index, constraint và function PostgreSQL.
- Ưu tiên UUID cho primary key của entity nghiệp vụ.
- Bảng nghiệp vụ có `created_at` và `updated_at`; thêm `created_by` khi cần truy vết người tạo.
- Thời gian sự kiện lưu bằng `timestamptz`; ngày thuần túy có thể dùng `date`.

## Vòng đời dữ liệu

- Không hard delete dữ liệu nghiệp vụ quan trọng. Dùng trạng thái, thời điểm vô hiệu hóa hoặc bản ghi đảo ngược phù hợp với domain.
- Audit log là append-only, không ghi đè bản ghi cũ.
- Migration đã chạy trên môi trường dùng chung là bất biến; mọi thay đổi tiếp theo phải là migration mới.

## Kiểu dữ liệu và danh mục

- Tiền lưu nhất quán bằng `bigint` theo VND. Chỉ dùng `numeric` nếu một nghiệp vụ được phê duyệt cần phần lẻ; không dùng floating point cho tiền.
- Database enum chỉ dùng cho tập giá trị nhỏ, ổn định và khó thay đổi.
- Ưu tiên lookup table cho danh mục động, cần vô hiệu hóa, sắp xếp, dịch nhãn hoặc quản lý theo organization.

## Bảo mật

- RLS là bắt buộc trước khi mở bất kỳ bảng nào cho client.
- Mỗi policy phải xét organization và permission phù hợp; ẩn nút trên UI không phải là biện pháp bảo mật.
- Không dùng service role key trên browser và không đặt secret trong biến `NEXT_PUBLIC_*`.
- Nghiệp vụ nhiều bảng hoặc liên quan tài chính phải dùng database function/transaction đã được review và ghi audit.
