# Giám sát, cảnh báo và deploy theo CI

## 1. Cảnh báo vận hành trong ứng dụng (đã bật)

Mọi tài khoản có quyền `settings.manage` (chủ trung tâm, quản trị) nhận thông báo in-app khi:

| Sự cố | Nguồn phát hiện | Mã | Chu kỳ |
|---|---|---|---|
| Webhook SePay xử lý lỗi (DB từ chối, mất kết nối) | Route `/api/webhooks/sepay` gọi `raiseOpsAlert` ngay lúc lỗi | `ops.sepay_webhook_processing_failed` | tức thì, 1 lần / webhook |
| Webhook SePay ghi trạng thái `failed` | `run_ops_health_check` | `ops.sepay_webhook_failed` | mỗi 15 phút, gộp theo cửa sổ 30 phút |
| Tác vụ pg_cron thất bại (chăm sóc học viên, tự khóa buổi, nhắc theo dõi, chấm công) | `cron.job_run_details` | `ops.cron_job_failed` | 1 lần / lần chạy lỗi |
| Tác vụ pg_cron không chạy quá 3 giờ | `cron.job` + `job_run_details` | `ops.cron_job_stale` | 1 lần / ngày / job |

Mỗi cảnh báo được ghi vào Nhật ký hệ thống (`module = ops`). Hàm `raise_ops_alert` chỉ service role gọi được; người dùng không tự tạo cảnh báo.

## 2. Kênh ngoài (tùy chọn): Zalo / Slack / Discord

Đặt biến môi trường `ALERT_WEBHOOK_URL` (https) trên Vercel. Ứng dụng POST JSON `{ code, title, message, text, href, raisedAt }` tới địa chỉ đó cho:

- mọi cảnh báo vận hành ở mục 1 phát từ ứng dụng (`lib/ops-alerts`);
- mọi lỗi máy chủ chưa bắt được trong route/server action/render (`src/instrumentation.ts`, `onRequestError`).

Ví dụ: Discord webhook nhận `content`? Không — Discord cần trường `content`; dùng một Zapier/Make hoặc Cloudflare Worker nhỏ chuyển `text` sang định dạng kênh đích. Slack Incoming Webhook đọc trực tiếp trường `text`.

## 3. Log drain / Sentry

- **Vercel Log Drain** (Team plan): Project → Settings → Log Drains → trỏ tới Axiom/Better Stack/Datadog. Mọi dòng `console.error` kể cả JSON của `onRequestError` được giữ lại và tìm kiếm được. Gói Hobby chỉ giữ log 1 giờ.
- **Sentry**: chưa cài để tránh thêm SDK nặng và chi phí. Khi cần, chạy `npx @sentry/wizard@latest -i nextjs`, giữ nguyên `src/instrumentation.ts` (Sentry sẽ bọc `onRequestError`). Mục 2 đã bao phủ nhu cầu "có người biết khi lỗi" cho quy mô hiện tại.
- **Supabase**: Dashboard → Logs → Postgres để xem lỗi RPC; Database → Extensions → pg_cron → `cron.job_run_details` để xem lịch sử tác vụ nền.

## 4. Deploy chỉ sau khi CI xanh

Hiện trạng: Vercel Git integration deploy production ngay khi push `main`, bất kể workflow **Quality** đạt hay không.

Workflow `.github/workflows/deploy.yml` deploy production **sau khi Quality thành công** trên `main`. Để nó có hiệu lực:

1. Vercel → Project `ttp-erp` → Settings → General → lấy **Project ID**; Settings → chung của team/cá nhân → **Team ID** (= `VERCEL_ORG_ID`).
2. Vercel → Account → Tokens → tạo token (scope: team chứa dự án) → `VERCEL_TOKEN`.
3. GitHub → repo → Settings → Secrets and variables → Actions → thêm `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Tạo environment `production` (có thể yêu cầu người duyệt).
4. Tắt auto-deploy của Git integration: Vercel → Settings → Git → **Ignored Build Step** → Custom → `exit 0` (bỏ qua mọi build từ Git). Preview deploy cho PR cũng dừng; nếu vẫn muốn preview, dùng `[ "$VERCEL_ENV" = "production" ] && exit 0 || exit 1`.
5. Kiểm tra: push một commit, xem tab Actions: Quality → (xanh) → Deploy (after Quality).

Khi chưa cấu hình secrets, job Deploy tự bỏ qua (không đỏ) và Git integration vẫn deploy như cũ.

**Vùng chạy function:** `vercel.json` ghim `"regions": ["sin1"]` (Singapore), cùng vùng với Supabase (`ap-southeast-1`); trước đây function chạy ở `iad1` (Mỹ) và mỗi lượt truy vấn tới Supabase mất thêm khoảng 0,2 giây. Cả workflow này lẫn Git integration đều đọc `vercel.json` khi build. Sau mỗi deploy, đăng nhập, mở một trang như `/sessions`, DevTools → Network → request của trang → header `x-vercel-id` phải có `::sin1::`.

## 5. Migration và ứng dụng không lệch nhau

- Áp migration **trước** khi push code dùng RPC mới (`npx supabase db push --linked`, kiểm tra `npx supabase migration list --linked`).
- CI chạy `supabase db reset` + toàn bộ pgTAP + so sánh `database.generated.ts`; schema lệch sẽ đỏ trước khi deploy (khi mục 4 đã bật).

## 6. Rate limit

Supabase Auth đã có rate limit mặc định (đăng nhập, OTP). Route webhook SePay xác thực bằng secret và chỉ ghi nhận giao dịch có chữ ký tài khoản nhận; Vercel có DDoS mitigation ở biên. Chưa thêm rate limit ứng dụng cho server action vì mọi thao tác đều yêu cầu đăng nhập và quyền.
