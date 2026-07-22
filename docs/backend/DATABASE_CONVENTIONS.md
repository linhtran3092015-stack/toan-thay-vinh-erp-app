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

## Identity và RBAC

- `auth.users` chỉ là nguồn định danh; hồ sơ nhân sự nằm ở `public.profiles`.
- Không suy luận permission từ email, display name, tên role hoặc Auth metadata.
- Permission code dùng exact match và được thêm bằng migration.
- Một user có thể có nhiều role; assignment được thu hồi bằng thời điểm và lý do, không hard delete.
- Role code bất biến sau khi đã có permission hoặc assignment; tên hiển thị có thể thay đổi.
- Thay đổi role-permission và user-role phải có audit giữ dữ liệu trước/sau.

## Functions và RLS

- Chỉ dùng `SECURITY DEFINER` khi cần tránh RLS recursion hoặc bảo đảm trigger audit.
- Hàm `SECURITY DEFINER` phải đặt `search_path` rỗng hoặc tối thiểu, dùng tên schema đầy đủ, revoke execute khỏi `PUBLIC` và chỉ grant đúng database role cần thiết.
- Không tạo policy cho `anon` trên bảng nghiệp vụ hoặc RBAC.
- Grants chỉ mở thao tác tối thiểu; RLS không thay thế application guard và application guard không thay thế RLS.
- Không grant ghi trực tiếp cho browser khi workflow server/database chưa được duyệt.

## Audit

- Audit log là append-only; client không được update hoặc delete.
- Không ghi access token, refresh token, authorization code, cookie, mật khẩu, secret hoặc raw Auth metadata không cần thiết.
- Khi thao tác database không có `auth.uid()`, actor có thể null nhưng metadata phải ghi nguồn phù hợp.
