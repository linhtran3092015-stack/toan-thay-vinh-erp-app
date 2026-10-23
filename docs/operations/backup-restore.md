# Sao lưu, PITR và diễn tập khôi phục

Áp dụng cho dự án Supabase production `ptkbpkdosjrfpfkpmlwn` (vùng đã chọn khi tạo dự án) và mã nguồn trên GitHub `linhtran3092015-stack/toan-thay-vinh-erp-app`.

## 1. Những gì đã có sẵn

| Lớp dữ liệu | Cơ chế | Giữ bao lâu | Ai thao tác |
|---|---|---|---|
| Cơ sở dữ liệu Postgres | Supabase daily backup (gói Pro) | 7 ngày (Pro) / 14 ngày (Team) | Supabase Dashboard → Database → Backups |
| Point-in-time recovery (PITR) | Add-on PITR của Supabase (WAL liên tục) | 7–28 ngày tùy cấu hình | Bật tại Database → Backups → PITR |
| Schema | Toàn bộ migration trong `supabase/migrations` (git) | Vĩnh viễn | Ai cũng clone được |
| Mã nguồn & build | GitHub + Vercel (mỗi deploy giữ lại, rollback 1 click) | Vĩnh viễn | Vercel → Deployments → Promote |
| Secrets | Vercel Environment Variables, Supabase Dashboard | — | Chủ dự án |

**Quyết định cần chủ trung tâm chốt:** bật PITR (phí theo dung lượng WAL, thường vài USD/tháng cho dự án cỡ này). Không có PITR thì điểm khôi phục gần nhất là bản sao lưu lúc ~00:00 UTC, tức có thể mất tới một ngày phân bổ học phí và chấm công.

## 2. Sao lưu thủ công trước thay đổi lớn

Chạy trước mỗi lần áp migration có `alter table` phá hủy hoặc sửa dữ liệu hàng loạt:

```bash
npx supabase db dump --linked --data-only -f backups/data-$(date +%Y%m%d-%H%M).sql
```

```bash
npx supabase db dump --linked -f backups/schema-$(date +%Y%m%d-%H%M).sql
```

Thư mục `backups/` không được commit (chứa dữ liệu cá nhân). Lưu vào ổ mã hóa của chủ trung tâm, xóa sau 30 ngày.

## 3. Khôi phục

### 3a. Khôi phục toàn bộ (mất dữ liệu / lỗi migration nghiêm trọng)

1. Supabase Dashboard → Database → Backups → chọn bản sao lưu hoặc mốc PITR → **Restore**. Supabase khôi phục tại chỗ; ứng dụng gián đoạn vài phút.
2. Sau khi khôi phục, kiểm tra migration đã áp: `npx supabase migration list --linked`. Nếu bản sao lưu cũ hơn migration mới nhất, chạy `npx supabase db push --linked` để áp phần còn thiếu.
3. Tạo lại types nếu cần: `npm run typecheck` phải xanh với `src/types/database.generated.ts` hiện tại.
4. Thông báo cho kế toán kiểm tra lại giao dịch SePay từ mốc khôi phục: Giao dịch SePay → **Đồng bộ lịch sử** cho khoảng ngày bị mất để webhook đã đến trong lúc gián đoạn được ghi nhận lại.
5. Chấm công trong khoảng bị mất: quản lý nhập bù qua "Thêm công bù" trong bảng công tháng (quyền quản trị chấm công) với lý do. Tháng có kỳ lương đã gửi duyệt hoặc đã duyệt bị khóa công (lỗi `TIME_ENTRY_LOCKED_BY_PAYROLL`): mở lại kỳ lương về nháp trước khi nhập; kỳ đã chi trả không mở lại được.

### 3b. Khôi phục một bảng / một nhóm dòng

Không khôi phục đè. Dùng bản dump data (mục 2) hoặc Supabase "Restore to a new project" rồi `pg_dump --table` bảng cần thiết, kiểm tra trên local (`supabase start`) và chèn lại bằng câu lệnh có `on conflict do nothing`.

## 4. Diễn tập khôi phục (mỗi quý)

Mục tiêu: chứng minh có thể dựng lại hệ thống trong ≤ 2 giờ từ sao lưu, không chạm production.

1. Supabase → Backups → **Restore to new project** (hoặc tải bản sao lưu về).
2. Trỏ bản local tới dự án mới: tạo `.env.local` tạm với URL/anon key của dự án mới, chạy `npm run dev`, đăng nhập bằng tài khoản thử.
3. Kiểm tra 5 màn hình: Dashboard, Giao dịch SePay, Phiếu thu, Buổi học hôm nay, Bảng lương tháng gần nhất. So số liệu với production (tổng thu tháng, số học sinh đang học).
4. Chạy `npx supabase test db` trên dự án mới nếu có Docker; tối thiểu chạy `npm run typecheck`.
5. Ghi biên bản vào `docs/operations/drills/YYYY-MM-DD.md`: thời gian từng bước, sai lệch số liệu, việc cần sửa. Xóa dự án tạm sau khi xong.

## 5. Checklist khi có sự cố

- [ ] Xác định mốc thời gian dữ liệu còn đúng (hỏi kế toán, xem nhật ký hệ thống `/settings/audit-logs`).
- [ ] Tạm dừng webhook SePay (Vercel → Env → đổi `SEPAY_WEBHOOK_SECRET`) để tránh ghi đè trong lúc khôi phục; SePay sẽ retry, và Đồng bộ lịch sử bù phần thiếu.
- [ ] Khôi phục theo mục 3a.
- [ ] Bật lại webhook, đồng bộ lịch sử SePay cho khoảng gián đoạn.
- [ ] Thông báo nội bộ: kỳ lương/kỳ thu nào cần "Tính lại".
