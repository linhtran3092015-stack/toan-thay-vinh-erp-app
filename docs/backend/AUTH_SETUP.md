# Supabase Google Authentication

## Phạm vi Task 3.2

Task 3.2 bổ sung đăng nhập Google qua Supabase Auth, phiên đăng nhập SSR, email allowlist và bảo vệ route. Task này không tạo bảng, migration, profile, role, permission thật hoặc kết nối dữ liệu nghiệp vụ.

Topbar hiển thị tên, email và ảnh từ Google. Nhãn vai trò dùng giá trị trung tính `Nhân sự trung tâm`; quyền menu hiện tại vẫn là mock cho đến task phân quyền riêng.

## Biến môi trường

Tạo `.env.local` và cấu hình:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
AUTH_ALLOWED_EMAILS=
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` là lựa chọn chính. `NEXT_PUBLIC_SUPABASE_ANON_KEY` chỉ là fallback tương thích tạm thời cho project cũ.

`AUTH_ALLOWED_EMAILS` là danh sách email phân tách bằng dấu phẩy, ví dụ `user1@example.com,user2@example.com`. Hệ thống trim, chuyển về chữ thường và so khớp toàn bộ email. Biến này chỉ được đọc phía server và không có tiền tố `NEXT_PUBLIC_`.

Nếu URL, public key hoặc allowlist thiếu/sai, đăng nhập bị khóa theo nguyên tắc fail-closed. Nội dung secret và danh sách email không được đưa vào log hoặc browser bundle.

## Cấu hình Supabase

1. Mở Authentication, Providers và bật Google.
2. Điền Google OAuth Client ID và Client Secret vào provider Google.
3. Trong URL Configuration, đặt Site URL đúng origin production.
4. Thêm redirect URL cho local: `http://localhost:3000/auth/callback`.
5. Thêm redirect URL production: `https://<app-domain>/auth/callback`.
6. Không dùng wildcard rộng cho production nếu có thể khai báo URL chính xác.

Ứng dụng chỉ yêu cầu scope mặc định của Google để nhận định danh cơ bản, email và hồ sơ hiển thị. Không yêu cầu Drive, Calendar hoặc scope mở rộng. Provider access token và refresh token không được lưu trong ứng dụng.

## Cấu hình Google Cloud

Trong OAuth client của Google Cloud:

1. Chọn loại Web application.
2. Thêm Supabase Auth callback do trang cấu hình provider cung cấp, thường có dạng `https://<project-ref>.supabase.co/auth/v1/callback`, vào Authorized redirect URIs.
3. Thêm origin local và production vào Authorized JavaScript origins nếu cấu hình OAuth client yêu cầu.
4. Giữ consent screen và test users phù hợp với trạng thái publish của ứng dụng Google.

Không thêm `/auth/callback` của ứng dụng vào Google OAuth client thay cho Supabase callback. Google chuyển về Supabase trước; Supabase mới chuyển về callback của ứng dụng.

Google Client Secret chỉ được nhập trong Supabase Dashboard. Không ghi secret này vào `.env.local`, tài liệu, source code hoặc Git.

## Thêm nhân sự vào allowlist

1. Xác nhận chính xác email Google của nhân sự đã được phê duyệt.
2. Thêm email vào `AUTH_ALLOWED_EMAILS`, phân tách với email trước bằng dấu phẩy.
3. Khởi động lại ứng dụng để server nhận cấu hình mới.
4. Yêu cầu nhân sự đăng nhập lại và xác nhận tên/email hiển thị đúng.

Xóa email khỏi allowlist sẽ chặn các request ứng dụng tiếp theo của tài khoản đó. Đây chưa phải hệ thống quản lý người dùng hay phân quyền nghiệp vụ.

## Luồng đăng nhập

1. Người dùng mở `/login` và chọn đăng nhập Google.
2. Browser client bắt đầu OAuth với PKCE và đặt callback là `/auth/callback`.
3. Callback đổi authorization code lấy session bằng `exchangeCodeForSession`.
4. Server gọi `getUser()` để lấy email đã xác thực và kiểm tra allowlist.
5. Proxy dùng `getClaims()` để xác thực session trên mỗi route được bảo vệ.
6. Redirect `next` chỉ chấp nhận đường dẫn nội bộ; URL ngoài domain, callback Auth và vòng lặp login bị loại bỏ.
7. Đăng xuất chạy bằng server action và xóa phiên local.

Các route công khai là `/login`, `/auth/callback` và `/api/health/supabase`. Các route ứng dụng còn lại yêu cầu session hợp lệ và email có trong allowlist.

## Kiểm tra local

Sau khi điền `.env.local`, khởi động lại dev server rồi kiểm tra:

- Email được phép đăng nhập và quay về Dashboard.
- Email không được phép quay về Login với thông báo từ chối.
- Hủy hoặc lỗi OAuth quay về Login với thông báo chung, không lộ chi tiết provider.
- Mở trực tiếp `/students` khi chưa đăng nhập sẽ chuyển về Login và giữ `next=/students`.
- Refresh Dashboard vẫn giữ phiên.
- Đăng xuất quay về Login; mở lại route được bảo vệ vẫn bị chặn.
- `next=https://example.com`, `next=//example.com` và `next=/auth/callback` không thể tạo open redirect.

## Xử lý sự cố

- `Hệ thống đăng nhập chưa được cấu hình`: kiểm tra ba biến môi trường bắt buộc và khởi động lại server.
- Google báo redirect URI mismatch: đối chiếu chính xác Supabase callback trong Google Cloud và app callback trong Supabase URL Configuration.
- Tài khoản chưa được cấp quyền: thêm đúng email Google vào `AUTH_ALLOWED_EMAILS`, sau đó khởi động lại server.
- Đăng nhập xong quay lại Login: kiểm tra cookie có bị chặn, Site URL, redirect URL và origin đang dùng.
- Phiên hết hạn: đăng nhập lại. Proxy sẽ làm mới cookie hợp lệ khi Supabase cung cấp refresh session.

Log Auth chỉ ghi nhóm lỗi và path. Không ghi authorization code, token, cookie, URL/key Supabase, email allowlist hoặc lỗi thô từ provider.

## Đưa lên production

1. Tạo OAuth Web Client dành cho production hoặc cập nhật client hiện có theo chính sách của tổ chức.
2. Khai báo origin production chính xác trong Google Cloud.
3. Khai báo Supabase callback chính xác trong Google Cloud Authorized redirect URIs.
4. Cập nhật Supabase Site URL và redirect allow list bằng HTTPS production URL.
5. Cấu hình URL, publishable key và allowlist trong secret/environment manager của nền tảng triển khai.
6. Chạy lại toàn bộ test login, callback, từ chối email, refresh, tab mới và sign-out trên domain production.
7. Kiểm tra log không chứa code, token, cookie, key hoặc email allowlist trước khi mở truy cập.
