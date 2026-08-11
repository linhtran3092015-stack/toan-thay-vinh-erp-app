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

## pg_cron và Timekeeping auto-end

Timekeeping auto-end là một phụ thuộc bắt buộc của chuỗi migration. Cần có Docker và dùng Supabase CLI được khai báo trong repository:

```bash
npx supabase start
npx supabase db reset --local
```

`npx supabase db reset --local` **xóa và dựng lại** database local. Không chạy lệnh này trên database có dữ liệu local cần giữ lại nếu chưa có backup và chấp thuận của người vận hành.

Trong workflow local này, `supabase/roles.sql` chạy trước migrations và cài `pg_cron`. Nhờ đó migration `20260728155000_timekeeping_auto_end_cron.sql` có thể fail-fast đúng nghĩa nếu scheduler không sẵn sàng; `seed.sql` không phải cơ chế để đáp ứng tiền điều kiện này.

Sau một local reset thành công, kiểm tra trực tiếp:

```sql
select extname, extversion
from pg_extension
where extname = 'pg_cron';

select to_regclass('cron.job');

select
  jobid,
  jobname,
  schedule,
  command,
  database,
  username,
  active
from cron.job
where jobname = 'timekeeping-auto-end-teaching-assistants';

select count(*)
from cron.job
where jobname = 'timekeeping-auto-end-teaching-assistants';

select to_regprocedure(
  'public.auto_end_stale_teaching_assistant_time_entries()'
);

select version
from supabase_migrations.schema_migrations
where version in ('20260728155000', '20260729085000')
order by version;
```

Kết quả yêu cầu: `pg_cron` và `cron.job` tồn tại; có đúng một job active tên `timekeeping-auto-end-teaching-assistants`; schedule là `30 16 * * *`; command là `select public.auto_end_stale_teaching_assistant_time_entries();` (cho phép khác biệt whitespace không đáng kể); function và cả hai migration đều tồn tại. Migration history đơn thuần không đủ chứng minh extension hoặc job tồn tại.

Trước khi triển khai vào một Supabase hosted environment mới, bật `pg_cron`/Cron Postgres Module bằng cơ chế Supabase được hỗ trợ và xác nhận:

```sql
select extname, extversion
from pg_extension
where extname = 'pg_cron';
```

Nếu không có dòng kết quả, dừng deployment để bật `pg_cron`; không đánh dấu, repair, skip hoặc tự sửa migration history cho migration Timekeeping. Sau deployment, chạy lại truy vấn job và migration history ở trên để xác nhận một job active đúng lịch/command. Cần kiểm tra lại extension và job sau PostgreSQL platform upgrade hoặc hạ tầng có thể tái tạo extensions.

Nếu `20260728155000_timekeeping_auto_end_cron.sql` dừng với `PG_CRON_EXTENSION_REQUIRED_FOR_TIMEKEEPING_AUTO_END`, không mark/repair migration là applied, không skip migration, không sửa history và không tiếp tục migrations thủ công. Hãy bật/cài `pg_cron`, khôi phục hoặc dựng lại migration state nhất quán, rồi chạy lại workflow canonical.

## Kiểm thử database và CI

Với local Supabase stack đang chạy, chạy pgTAP không phá dữ liệu bằng:

```bash
npm run test:db
```

Lệnh này chỉ chạy `supabase test db` trên database local hiện có; nó không chứng minh một migration chain mới dựng được.

Để kiểm tra toàn bộ bootstrap/migration chain, chạy:

```bash
npm run test:db:fresh
```

Lệnh `test:db:fresh` **phá hủy và dựng lại** local Supabase development database: khởi động Supabase, áp dụng `roles.sql`, áp dụng toàn bộ migrations, rồi chạy pgTAP. Không dùng lệnh này nếu cần giữ dữ liệu local chưa backup.

GitHub Actions chạy trên pull request và push vào `main` với lint, typecheck, unit/component tests, production build, và `test:db:fresh`. Database gate xác nhận fresh local migration chain, `pg_cron`, Timekeeping scheduler contract, và toàn bộ pgTAP suite. Authenticated staging Playwright không thuộc CI gate này; C2B vẫn chờ tài khoản non-production, quyền thực, Google OAuth storage state có thể làm mới, fixture IDs, và staging deployment integration.

## Quy tắc migration

- `supabase/migrations` là nguồn sự thật duy nhất cho thay đổi schema.
- Tạo migration mới bằng script `supabase:migration:new`; tên file có timestamp do CLI sinh.
- Review SQL, RLS, quyền và rollback plan trước khi push.
- Không thay đổi database dùng chung trực tiếp bằng Table Editor hoặc SQL Editor.
- Migration đã chạy trên môi trường dùng chung là bất biến; sửa lỗi bằng migration mới.
- Không chạy `db:push` khi chưa review và chưa xác định đúng project.
- `seed.sql` chỉ dành cho dữ liệu seed đã được phê duyệt, không chứa dữ liệu thật hoặc secret.
