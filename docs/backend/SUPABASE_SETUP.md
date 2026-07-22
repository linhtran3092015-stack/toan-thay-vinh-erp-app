# Supabase Setup

## Mục tiêu Task 3.1

Task 3.1 tạo kiến trúc client/server, validation biến môi trường, route health và workflow migration. Google Auth được bổ sung ở Task 3.2 và mô tả trong `docs/backend/AUTH_SETUP.md`. Chưa có bảng, ghi dữ liệu hoặc thay mock data.

## Cấu hình biến môi trường

1. Tạo `.env.local` từ `.env.example`.
2. Điền Project URL vào `NEXT_PUBLIC_SUPABASE_URL`.
3. Điền publishable key từ màn hình Connect của project vào `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Nếu project cũ chưa có publishable key, có thể tạm dùng `NEXT_PUBLIC_SUPABASE_ANON_KEY` làm fallback.
5. Với Auth, điền allowlist phía server vào `AUTH_ALLOWED_EMAILS` theo hướng dẫn trong tài liệu Auth.
6. Khởi động lại dev server sau khi thay đổi biến môi trường.

Project URL và publishable/anon key được phép dùng ở client vì chỉ đại diện cho public project endpoint và public API key. `AUTH_ALLOWED_EMAILS` chỉ được dùng phía server. Quyền truy cập dữ liệu vẫn phải được bảo vệ bằng Auth, RLS và database function.

Tuyệt đối không đưa `service_role`, secret key, database password, personal access token hoặc JWT signing key vào biến `NEXT_PUBLIC_*`, source code, log hay browser bundle.

Khi env thiếu hoặc không hợp lệ, route health trả `configured: false`; từ Task 3.2, route ứng dụng bị khóa và chuyển về Login theo nguyên tắc fail-closed.

## Kiểm tra kết nối

Chạy app và mở:

```text
GET /api/health/supabase
```

Route chỉ kiểm tra Auth health endpoint, không truy vấn bảng nghiệp vụ. Response chỉ gồm `service`, `configured`, `connected` và `message`; không trả URL, key, stack trace hay thông tin database.

- Chưa có env: HTTP 503, `configured: false`.
- Có env nhưng dịch vụ không truy cập được: HTTP 503, `configured: true`, `connected: false`.
- Kết nối thành công: HTTP 200, `configured: true`, `connected: true`.

## Supabase CLI

CLI được cài trong dev dependencies, không cài global. Các script sẵn có:

```bash
npm run supabase:status
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:db:pull
npm run supabase:db:push
npm run supabase:migration:new -- <migration_name>
npm run supabase:types
```

`supabase:status` và local database cần Docker, nhưng Task 3.1 không chạy `supabase start`. `db:pull`, `db:push` và `supabase:types` chỉ chạy sau khi link project và có quyền phù hợp.

Project ref nằm trong URL Dashboard (`https://supabase.com/dashboard/project/<project-ref>`) hoặc màn hình Project Settings. Ở bước sau, đăng nhập CLI bằng personal access token an toàn, sau đó chạy `npm run supabase:link -- --project-ref <project-ref>`. Không commit token hoặc file trong `supabase/.temp`.

## Quy tắc migration

- `supabase/migrations` là nguồn sự thật duy nhất cho thay đổi schema.
- Tạo migration mới bằng script `supabase:migration:new`; tên file có timestamp do CLI sinh.
- Review SQL, RLS, quyền và rollback plan trước khi push.
- Không thay đổi database dùng chung trực tiếp bằng Table Editor hoặc SQL Editor.
- Migration đã chạy trên môi trường dùng chung là bất biến; sửa lỗi bằng migration mới.
- Không chạy `db:push` khi chưa review và chưa xác định đúng project.
- `seed.sql` chỉ dành cho dữ liệu seed đã được phê duyệt, không chứa dữ liệu thật hoặc secret.
