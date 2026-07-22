# Identity and RBAC Model

## Phạm vi

Task 3.3A tạo nền tảng identity, profile, role, permission, assignment và audit. Migration chưa được push lên Supabase Cloud và giao diện hiện tại vẫn dùng mock permission.

Mô hình ban đầu là global cho một trung tâm. Organization membership và permission override trong `docs/supabase_schema_v0_1.sql` được hoãn để tránh đưa thiết kế đa tổ chức chưa được duyệt vào migration đầu tiên.

## Authentication và authorization

Authentication trả lời người dùng là ai. Supabase Auth và `auth.users` chịu trách nhiệm đăng nhập Google, session và định danh.

Authorization trả lời người dùng được làm gì. Các bảng `public.profiles`, `public.roles`, `public.permissions`, `public.role_permissions` và `public.user_role_assignments` chịu trách nhiệm này.

Không suy luận quyền từ email, display name, tên role hoặc Google metadata. Tên role chỉ là nhãn công việc; quyền cuối cùng luôn được tính bằng permission code chính xác.

## Mô hình dữ liệu

- `auth.users`: danh tính và thông tin Auth do Supabase quản lý.
- `public.profiles`: hồ sơ nhân sự gắn 1-1 với Auth user.
- `public.roles`: danh mục vai trò công việc.
- `public.permissions`: danh mục quyền theo exact code.
- `public.role_permissions`: quan hệ nhiều-nhiều giữa role và permission.
- `public.user_role_assignments`: lịch sử gán nhiều role cho một nhân sự.
- `public.audit_logs`: nhật ký append-only cho thay đổi RBAC.

Một user có thể có nhiều role, một role có thể có nhiều permission. Không tồn tại khái niệm “highest role” được suy luận từ tên; quyền hiệu lực là hợp của các permission thuộc mọi assignment còn hiệu lực, với điều kiện profile, role và permission đều active.

Assignment không bị xóa khi thu hồi. Hệ thống đặt `revoked_at`, `revoked_by` và `revocation_reason`; cấp lại role tạo assignment mới. Partial unique index ngăn hai assignment còn hiệu lực cho cùng một cặp user-role.

## Đồng bộ Auth profile

Trigger `public.handle_auth_user_created()` tạo profile khi Auth user được tạo:

- Email lấy từ `auth.users.email`, normalize bằng trim và lowercase.
- Tên ban đầu lấy từ `full_name`, fallback sang `name`.
- Avatar ban đầu lấy từ `avatar_url`.
- Trạng thái mặc định là `active`.
- Không đọc hoặc gán role từ metadata.

Migration cũng backfill idempotent profile cho Auth user có email đã tồn tại trước Task 3.3A. Backfill không tạo assignment và không cấp permission.

Migration không tạo trigger update metadata. Tên và avatar có thể trở thành dữ liệu nhân sự được chỉnh thủ công nên không được ghi đè tự động khi Google metadata thay đổi. `last_login_at` giữ nullable và sẽ được cập nhật bằng application flow hoặc Auth hook đã được duyệt sau này.

## Permission evaluation

`public.has_permission(required_permission text)` kiểm tra exact permission code và chỉ trả true khi:

- `auth.uid()` có profile active.
- Assignment chưa bị thu hồi.
- Role đang active.
- Permission đang active.
- Permission code khớp chính xác.

`public.get_my_permissions()` trả danh sách permission code hiệu lực theo cùng quy tắc. Hai hàm dùng `SECURITY DEFINER` để tránh RLS recursion, có `search_path` rỗng, dùng tên schema đầy đủ, thu hồi execute khỏi `PUBLIC` và chỉ grant cho `authenticated`.

Không dùng wildcard, `LIKE`, contains, email hay metadata để xác định quyền.

## Seed ban đầu

Các role hệ thống:

- `owner`
- `accountant`
- `operations_manager`
- `assistant_manager`
- `teaching_assistant`
- `admissions_specialist`
- `admissions_leader`
- `admissions_manager`
- `collaborator`

Các permission ban đầu:

- `app.access`
- `students.view`
- `students.create`
- `students.update`
- `students.manage_status`
- `coaching.view`
- `session_ledger.view`
- `audit.view`
- `staff.view`
- `staff.roles.view`
- `staff.roles.manage`

`owner` nhận toàn bộ permission hiện có. Các role còn lại chỉ nhận `app.access`. Mapping Students, coaching, staff và session ledger cho từng role chưa đủ chắc chắn để seed; cần được người dùng duyệt trong migration riêng.

Migration không gán role cho bất kỳ user nào và không chứa email hoặc UUID user thật.

## RLS và grants

RLS được bật trên cả sáu bảng public. Không có policy cho `anon` và không có policy ghi trực tiếp từ browser.

- Profile: user đọc profile của mình; `staff.view` đọc profile khác.
- Role và permission: cần `app.access` hoặc `staff.roles.view`.
- Role-permission: cần `staff.roles.view`.
- Assignment: user đọc assignment active của mình; `staff.roles.view` đọc toàn bộ.
- Audit: cần `audit.view`.

Role `authenticated` chỉ được grant `SELECT` trên các bảng. `INSERT`, `UPDATE` và `DELETE` chưa được cấp. RLS và application guard phải cùng tồn tại: RLS là lớp bảo vệ database, còn server/UI guard bảo vệ workflow và trải nghiệm. Không lớp nào thay thế lớp kia.

## Audit và lịch sử

Audit log là append-only. Trigger chặn update/delete audit row. Thay đổi `role_permissions` và thao tác cấp/thu hồi assignment tạo audit row tự động; thao tác database không có `auth.uid()` dùng actor null và metadata nguồn `database`.

Không lưu token, cookie, mật khẩu, secret hoặc toàn bộ Auth metadata trong audit. Assignment đã thu hồi và audit row không được xóa để “làm lại” lịch sử.

## Vì sao chưa dùng custom JWT claims

Permission được đọc trực tiếp từ database để thay đổi role/permission có hiệu lực ngay mà không chờ refresh token. Custom Access Token Hook và cache permission chỉ được cân nhắc khi có số liệu hiệu năng thực tế và quy tắc invalidation rõ ràng.

## Vì sao UI vẫn dùng mock permission

Task 3.3A chỉ chuẩn bị schema và server helper. Migration chưa áp dụng lên Cloud và chưa có owner assignment, nên thay UI sang database permission lúc này sẽ khóa người dùng hiện tại. `mock-current-user` tiếp tục là nguồn quyền của giao diện cho đến Task 3.4.

## Mở rộng role và permission

Mọi role hoặc permission mới phải được thêm bằng migration mới:

1. Thêm role/permission bằng code ổn định và seed idempotent.
2. Review module, exact permission code và phạm vi nghiệp vụ.
3. Thêm hoặc thu hồi role-permission trong migration; audit trigger giữ dữ liệu trước/sau.
4. Cập nhật `src/lib/permissions/types.ts` cùng migration.
5. Kiểm tra RLS, server guard và UI guard.
6. Không sửa migration đã áp dụng và không xóa lịch sử assignment.

Role code không được đổi sau khi đã có permission hoặc assignment. Tên hiển thị và mô tả có thể thay đổi bằng migration.
