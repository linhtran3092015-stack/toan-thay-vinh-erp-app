# BÀN GIAO DỰ ÁN ERP TRUNG TÂM TOÁN THẦY VINH CHO ANTIGRAVITY

**Ngày bàn giao:** 26/07/2026  
**Agent tiếp quản:** Antigravity sử dụng Claude Opus 4.6  
**Ngôn ngữ làm việc:** Tiếng Việt  
**Repository local:** `/Users/linhtran/Documents/ERP-Toan-Thay-Vinh/toan-thay-vinh-erp-app`

---

# 1. Vai trò của agent tiếp quản

Bạn là lead engineer tiếp quản dự án **ERP Quản Lý Trung Tâm Toán Thầy Vinh**.

Mục tiêu là tiếp tục đúng kế hoạch đã chốt, không tự thay đổi nghiệp vụ, không làm lại phần đã hoàn thành và không suy đoán trạng thái repository.

Trước khi sửa bất kỳ file nào:

1. Kiểm tra Git, worktree, branch, commit và remote thực tế.
2. Kiểm tra migration local/Cloud thực tế.
3. Đọc migration đã áp dụng và code hiện tại trước khi đọc tài liệu prototype cũ.
4. Chỉ thực hiện một phạm vi nhỏ mỗi lần.
5. Nêu rõ file sẽ tạo/sửa, giả định, quality gate và kết quả mong đợi.
6. Khi nghiệp vụ chưa đủ dữ liệu, ghi `OPEN_DECISION`; không tự đoán.

---

# 2. Mục tiêu hệ thống

Hệ thống thay dần Google Sheets và dữ liệu phân tán, chuẩn hóa:

- Học viên, phụ huynh.
- Lớp, lịch cố định, buổi học.
- Điểm danh, học thêm, kết quả cuối buổi.
- Học phí, số buổi, công nợ, hoàn phí.
- CRM, học thử, nhập học.
- Nhân sự, chấm công, lương, hoa hồng.
- Coaching, báo cáo, thông báo, audit.

Quy mô hiện tại:

- Một cơ sở.
- Online và offline.
- Khối 1–12.
- Khoảng 1.000 học viên, dự kiến mở rộng.
- Khoảng 20 nhân sự.
- Không đặt giới hạn sĩ số cứng.

Ưu tiên sử dụng:

- Nhân sự không chuyên công nghệ vẫn thao tác được.
- Điểm danh trên mobile phải nhanh và dùng tốt bằng một tay.
- Mọi nghiệp vụ quan trọng có permission, lịch sử và audit.

---

# 3. Stack hiện hành

- Next.js App Router 16.2.10.
- TypeScript strict.
- Tailwind CSS.
- Bộ component UI hiện hành trong repository; không giả định toàn bộ shadcn đã được cài.
- Supabase PostgreSQL, Auth, RLS.
- `@supabase/ssr`.
- Google OAuth.
- Node.js 24.x.
- GitHub; Vercel staging ở giai đoạn hardening.

Auth/server:

- Dùng Supabase browser client và server client hiện có.
- Server authorization không dựa vào `getSession()`.
- Permission lấy từ database.
- Nghiệp vụ ghi dữ liệu quan trọng đi qua Server Action/Route Handler và PostgreSQL RPC.

---

# 4. Thứ tự nguồn sự thật

Khi có xung đột, ưu tiên theo thứ tự:

1. Migration đã áp dụng trên Supabase Cloud.
2. Code hiện tại trong repository.
3. Quyết định nghiệp vụ mới nhất của người dùng.
4. Tài liệu bàn giao này.
5. `IMPLEMENTATION_FOUNDATION.md`, `CODEX_MASTER_PROMPT.md`, `DESIGN.md`, schema/prototype cũ.

Các tài liệu cũ chỉ dùng để hiểu định hướng. Không được đưa mù quáng các phần sau vào implementation hiện tại:

- `organization_id` chưa được triển khai trong schema hiện hành.
- Membership/invitation/MFA đầy đủ chưa phải trạng thái hiện hành.
- Permission code cũ có thể khác permission code database hiện tại.
- State machine cũ có thể khác constraint migration hiện tại.

Không thay đổi kiến trúc hiện hành để “khớp tài liệu cũ” nếu chưa có task và migration riêng.

---

# 5. Quy định kỹ thuật bắt buộc

## 5.1 Migration và database

- Migration là nguồn sự thật.
- Migration đã apply Cloud là bất biến.
- Mọi thay đổi schema/function tạo migration timestamp mới.
- Không sửa migration cũ đã apply.
- Không dùng `supabase db reset`.
- Không dùng migration repair.
- Không chỉnh production bằng Table Editor để thay migration.
- Không hard-delete dữ liệu nghiệp vụ quan trọng.
- Audit và ledger là append-only.
- Tiền lưu bằng `bigint` VND.
- Số buổi lưu bằng integer.
- Thời gian lưu bằng `timestamptz`.
- Nghiệp vụ nhiều bảng phải chạy trong một PostgreSQL transaction/function.

## 5.2 Bảo mật

Permission phải được kiểm tra tại cả ba tầng:

1. UI/Server Component.
2. Server Action/Route Handler.
3. RLS hoặc PostgreSQL function.

Không được:

- Đưa service-role key ra browser.
- Yêu cầu người dùng gửi token, secret, private key hoặc file `.env.local`.
- Suy quyền từ email, tên role hoặc metadata phía client.
- Bypass RLS.
- Cho browser ghi trực tiếp nhiều bảng nghiệp vụ.
- Cho browser ghi audit log.
- Trả lỗi database thô cho người dùng.

## 5.3 Git

- Một task nhỏ, một phạm vi rõ ràng.
- Không trộn refactor không liên quan.
- Không commit file `.env`, cache, output tạm, secret.
- Trước commit: `git diff --check` và kiểm tra đúng file.
- Chỉ merge/push sau khi quality gate đạt.
- Ưu tiên fast-forward merge khi lịch sử cho phép.

## 5.4 UI

- Tiếng Việt.
- Giữ phong cách visual hiện tại.
- Desktop 1440px, tablet 1024px, mobile 390px.
- Không landing page.
- Không animation trang trí.
- Không nhồi toàn bộ màn hình vào một file.
- Có loading, empty, error, permission-denied và not-found.
- Không trộn dữ liệu mock vào route database-backed.
- Không hiển thị UUID kỹ thuật cho người dùng.

## 5.5 Quality gate tối thiểu

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

Ngoài ra phải review:

- Browser smoke test.
- Console không có lỗi ứng dụng.
- Responsive desktop/mobile.
- Permission denied.
- Empty/error/not-found.
- RLS và permission.
- Data integrity, idempotency, audit.
- Không direct browser write.
- Không secret.
- Không dùng `any` nếu không giải thích.

Cảnh báo hydration có `bis_skin_checked` là do extension trình duyệt; không sửa ứng dụng để xử lý thuộc tính này.

---

# 6. Trạng thái Git/Supabase gần nhất

## 6.1 Trạng thái đã xác nhận trước Task 5.5

`main` và `origin/main` từng đồng bộ tại:

```text
9e70305 feat: add session result and locking UI
```

Các commit Session UI chính:

```text
864ec1c feat: add read-only session management UI
e8e4275 feat: add session lifecycle management UI
0274a7e feat: add session attendance management UI
9e70305 feat: add session result and locking UI
```

## 6.2 Trạng thái Task 5.5 hiện tại

Branch được tạo:

```text
feat/task-5-5-session-ledger
```

Migration foundation đã tạo:

```text
supabase/migrations/20260726121832_session_ledger_foundation.sql
```

Người dùng xác nhận **Task 5.5B-3 đã hoàn tất**, gồm apply Cloud/generate types/quality/commit/push theo kế hoạch. Tuy nhiên transcript bàn giao không có toàn bộ output cuối, nên agent mới **không được giả định commit hash, worktree sạch hay branch đã push**.

Việc đầu tiên phải kiểm tra Git và Cloud thực tế.

---

# 7. Lệnh kiểm tra đầu tiên bắt buộc

Chỉ kiểm tra, chưa sửa code:

```bash
cd /Users/linhtran/Documents/ERP-Toan-Thay-Vinh/toan-thay-vinh-erp-app

{
  echo "===== BRANCH / WORKTREE ====="
  git fetch origin
  git branch --show-current
  git status --short
  git log --oneline -15 --decorate

  echo
  echo "===== REMOTE BRANCHES ====="
  git branch -vv

  echo
  echo "===== LEDGER MIGRATION ====="
  test -f supabase/migrations/20260726121832_session_ledger_foundation.sql \
    && shasum -a 256 supabase/migrations/20260726121832_session_ledger_foundation.sql \
    || echo "MISSING LEDGER MIGRATION"

  echo
  echo "===== CLOUD MIGRATIONS ====="
  npx --yes supabase migration list | tail -n 25

  echo
  echo "===== GENERATED LEDGER TYPES ====="
  grep -nE \
    'student_session_ledger_entries|student_session_ledger_running_balances|student_session_balances|student_session_balance_alerts' \
    src/types/database.generated.ts || true

  echo
  echo "===== QUALITY ====="
  rm -rf .next
  npm run lint
  npm run typecheck
  npm run build
  git diff --check
} > /tmp/antigravity-handoff-check.txt 2>&1

wc -l /tmp/antigravity-handoff-check.txt
cat /tmp/antigravity-handoff-check.txt
```

Agent phải kết luận rõ:

- Branch hiện tại.
- Worktree sạch hay không.
- Commit cuối.
- Feature branch đã đồng bộ remote hay chưa.
- Migration `20260726121832` có cả Local và Remote hay chưa.
- Generated types có đủ bảng/views ledger hay chưa.
- Lint/typecheck/build đạt hay không.

Không sửa code trong phản hồi đầu tiên.

---

# 8. Migration Cloud đã áp dụng — tuyệt đối không sửa

Danh sách đã biết:

```text
20260722082513_identity_rbac_foundation.sql
20260722113559_role_assignment_management.sql
20260722130437_student_guardian_foundation.sql
20260722133125_class_schedule_foundation.sql
20260723084300_student_enrollment_foundation.sql
20260723085911_student_enrollment_workflows.sql
20260723155910_student_guardian_write_workflows.sql
20260723180746_fix_student_duplicate_lookup_ambiguity.sql
20260724150000_class_year_write_workflows.sql
20260724163000_class_schedule_write_workflows.sql
20260725034500_session_attendance_permissions.sql
20260725050000_session_attendance_schema_foundation.sql
20260725120000_session_lifecycle_workflows.sql
20260725133000_session_attendance_workflows.sql
20260725150000_session_result_lock_workflows.sql
20260726121832_session_ledger_foundation.sql
```

Mọi điều chỉnh sau bàn giao phải là migration mới.

---

# 9. Những phần đã hoàn thành

## Task 1 — Bootstrap

Đã hoàn thành:

- Next.js App Router.
- Supabase browser/server clients.
- Google Auth callback/login/logout.
- Authenticated AppShell, Sidebar, Topbar.
- Shared loading/error/empty/permission-denied states.
- Navigation theo permission.

## Task 2 — UI prototype/component foundation

Đã hoàn thành visual/component nền cho học viên và các module chính; route thật về sau phải dùng dữ liệu database, không đưa mock trở lại.

## Task 3 — Identity, Auth, RBAC, Staff

Đã hoàn thành:

- Profiles, roles, permissions, role_permissions, user_role_assignments.
- Audit logs append-only.
- Google Auth.
- Database-backed permissions.
- Staff directory.
- RPC cấp/thu hồi role.
- UI cấp/thu hồi role.

Các commit chính đã biết:

```text
9bc8f28 identity/RBAC foundation
6ad7dac database-backed permissions
e1f0292 staff directory
0757e7d role assignment RPC
d3c1d15 staff role management UI
```

## Task 4 — Students, Guardians, Classes, Schedules, Enrollment

Đã hoàn thành và được dùng trong hệ thống hiện tại:

- Guardian/student database foundation.
- Tạo/sửa học viên và phụ huynh bằng workflow an toàn.
- Duplicate lookup chỉ cảnh báo, không tự chặn sai nghiệp vụ.
- Danh sách/chi tiết học viên database-backed.
- Academic year, class, schedule foundation và workflow.
- Danh sách/chi tiết/tạo/sửa lớp và năm học theo route hiện hành.
- Enrollment foundation.
- Enroll/transfer/reserve/resume RPC.
- Enrollment management UI.
- Lịch sử enrollment không bị ghi đè.

## Task 5.0–5.3 — Session database/workflows

Đã hoàn thành:

- Permission cho sessions, attendance, results, lock, ledger view.
- `class_sessions`, `session_attendance`, `session_results`.
- Lifecycle RPC:
  - `create_class_session`
  - `start_class_session`
  - `complete_class_session`
  - `cancel_class_session`
- Attendance RPC:
  - `mark_session_attendance`
  - `update_session_attendance`
- Result/lock RPC:
  - `record_session_result`
  - `update_session_result`
  - `lock_class_session`
- RLS, immutable history và audit.

## Task 5.4 — Session UI

Đã hoàn thành, merge vào `main` tại `9e70305`:

- `/sessions`.
- `/sessions/new`.
- `/sessions/[sessionId]`.
- Danh sách, filter, pagination responsive.
- Chi tiết buổi học.
- Tạo regular/makeup/additional session.
- Start/complete/cancel.
- Điểm danh roster.
- Thêm học viên `additional_study` ngoài roster.
- Sửa điểm danh với lý do.
- Nhập/sửa kết quả cuối buổi.
- Chỉ `present` và `additional_study` được có kết quả.
- Khóa buổi khi đủ attendance/results.
- Sau khóa chỉ đọc.
- Không direct write vào ba bảng nghiệp vụ từ browser.

## Task 5.5A–5.5B — Ledger inventory và foundation

Đã hoàn thành theo xác nhận của người dùng:

- Inventory ledger/alerts.
- Xác định chưa có ledger thật trước Task 5.5.
- Tạo `student_session_ledger_entries` append-only.
- Số buổi integer.
- Không lưu cột balance sửa tay.
- Các entry type:
  - `payment_credit`
  - `bonus_credit`
  - `session_charge`
  - `session_reversal`
  - `manual_adjustment`
  - `transfer_out`
  - `transfer_in`
  - `refund_debit`
  - `annual_carryover`
- `event_key` chống ghi trùng.
- Một attendance chỉ có một `session_charge`.
- Một charge chỉ được reversal một lần.
- Append-only trigger.
- Audit khi insert ledger.
- Running-balance view.
- Per-student balance view.
- Zero/negative balance alert view.
- RLS đọc bằng `session_ledger.view`.
- Browser chỉ được SELECT.
- Generated TypeScript types đã được cập nhật theo xác nhận của người dùng.

Ledger foundation chưa đồng nghĩa toàn bộ Task 5.5 đã xong. Chưa có lock-and-charge transaction, reversal workflow và UI thật.

---

# 10. Nghiệp vụ đã chốt

## 10.1 Học viên/phụ huynh

Student lưu:

- Họ tên.
- Tên thường gọi.
- Năm sinh.
- Tỉnh/thành phố.
- Khối 1–12.
- A/B/CLC.
- Hình thức đăng ký.
- Mục tiêu học tập.
- Ghi chú nội bộ.
- Ngày học chính thức.
- Lifecycle.

Không cần:

- Giới tính.
- Ảnh.
- Trường.
- Quận/huyện.
- Địa chỉ chi tiết.

Guardian:

- Một phụ huynh có nhiều con, thực tế tối đa khoảng 5.
- Nhiều con có thể dùng chung số điện thoại.
- Có phụ huynh chính.
- Không hard-delete lịch sử liên kết.

Lifecycle hiện hành:

```text
interested
trial_booked
trial_completed
pending_enrollment_confirmation
active
reserved
resumed
waiting_class
completed
```

Không dùng trạng thái “đã nghỉ”.

## 10.2 Lớp và enrollment

- Khối 1–12.
- Level A/B/CLC.
- Không giới hạn sĩ số bắt buộc.
- Một học viên chỉ có một enrollment active.
- Chuyển lớp, bảo lưu, quay lại phải giữ lịch sử.
- Chuyển lớp có hiệu lực ngay theo workflow hiện tại.
- Bảo lưu từ ngày trợ lý xác nhận; không giới hạn thời gian.
- Lên lớp giữ mã học viên, đóng lớp cũ, tạo lớp mới; nếu chưa chọn lớp thì `waiting_class`.
- Hình thức đăng ký dùng cho học phí.
- Hình thức thực tế lưu theo từng attendance.

## 10.3 Trial/CRM

- Trial miễn phí một buổi.
- Trial không vào attendance/result chính thức.
- Xếp trial vào buổi có sẵn.
- Không đăng ký sau trial thì vẫn là `interested`.
- Hồ sơ cũ được tái sử dụng khi quay lại.
- Mỗi người con có một CRM case riêng; có thể chung guardian.
- Lead tự chia vòng, sale có thể nhận lead chưa có người và chuyển lead; mọi chuyển giao giữ lịch sử.
- Sale chốt trong ngày trial.

Dữ liệu sale nhập ban đầu:

- Họ tên.
- Tên thường gọi.
- Năm sinh.
- Số điện thoại phụ huynh.
- Tỉnh/thành phố.
- Lớp dự kiến.
- Online/offline.
- Ngày dự kiến học chính.
- Mức học phí.
- Ưu đãi.
- Nguồn/kênh.
- Ghi chú.

Điều kiện thành học viên chính thức:

- Đã nhận học phí.
- Xác định nguồn.
- Xác định sale chốt.
- Chốt lớp chính.
- Chốt online/offline.
- Chốt học phí và ưu đãi.
- Trợ lý xác nhận số buổi.
- Kế toán xác nhận.
- Có ngày học chính dự kiến.
- Checklist hoàn tất.
- Tạo enrollment và audit trong transaction.

## 10.4 Buổi học/điểm danh/kết quả

Session kind:

- `regular`.
- `makeup`.
- `additional`.

Attendance:

- `present`.
- `excused_absence`.
- `unexcused_absence`.
- `additional_study`.

Quy tắc:

- Present lớp chính: trừ 1 buổi.
- Vắng có phép lớp chính: trừ 1 buổi.
- Vắng không phép lớp chính: trừ 1 buổi.
- `additional_study`: không trừ buổi.
- Additional session không trừ buổi.
- Đổi hình thức học thực tế không đổi mức học phí đã đăng ký.
- Sau khi nhập điểm cuối buổi có thể khóa attendance.
- Cập nhật muộn phải được đánh dấu.
- Trial không dùng attendance/result chính thức.

Kết quả:

- Điểm kiểm tra cuối buổi 0–10.
- Điểm vở 0–10.
- `submitted` bắt buộc có điểm vở.
- `not_submitted`/`not_required` không có điểm vở.
- Chỉ `present`/`additional_study` có kết quả.
- Sửa kết quả bắt buộc lý do.

Khóa:

- Chỉ completed session.
- Có ít nhất một attendance.
- Regular/makeup phải đủ attendance roster.
- Mọi `present`/`additional_study` phải có test score.
- Lock lại không được trừ lần hai.
- Sau khóa không sửa trực tiếp session/attendance/result.

## 10.5 Session ledger

- Ledger append-only.
- Không dùng cột số dư chỉnh sửa tay.
- Balance tính từ tổng entry.
- Cho phép học âm; không chặn khóa chỉ vì số dư âm.
- Học âm phải tạo cảnh báo.
- Zero balance tạo cảnh báo hết buổi.
- Chưa hard-code ngưỡng “sắp hết buổi” vì chưa được chốt con số.
- Hủy/điều chỉnh sau charge không xóa charge; tạo `session_reversal +1`.
- Chuyển buổi dùng hai entry âm/dương cùng `transfer_group_id`.
- Chuyển buổi không tạo doanh thu hoặc hoa hồng.
- Credit lot/payment allocation để Task 7 Finance/SePay.

## 10.6 Học phí/SePay

- Cứ tiền được xác nhận là quy đổi thành số buổi theo đơn giá thực tế.
- Chuyển thừa thành thêm buổi.
- Chuyển thiếu quy đổi theo số buổi thực tế.
- Có thể kết hợp giảm phần trăm và tặng buổi.
- Buổi tặng là số nguyên.
- Tách tuyển mới và tái phí.
- Cho học âm nhưng cảnh báo.
- Hai tài khoản nhận tiền: tuyển mới và tái phí.
- Nội dung chuyển khoản: số điện thoại phụ huynh + tên học viên.
- Một giao dịch có thể chia nhiều con.
- Webhook idempotent.
- Tổng allocation phải khớp số tiền.
- Browser không tự ghi nhiều bảng tài chính.

Hoàn phí:

- Buổi chưa dùng × đơn giá thực tế.
- Không hoàn buổi tặng.
- FIFO theo credit lot.
- Không sửa giao dịch gốc.
- Tạo ledger debit, cashflow out và commission clawback.
- Refund không tính doanh thu/hoa hồng.

## 10.7 Nhân sự/lương

Vai trò nghiệp vụ:

- Chủ trung tâm.
- Kế toán.
- Trợ lý quản lý.
- Trợ giảng.
- Sale.
- Cộng tác viên.

Chấm công:

- Web + Wi-Fi + GPS.
- Online start/end.
- Tính theo phút.
- Có offline mode.
- Muộn dưới 5 phút không trừ.
- Trợ giảng auto end 23:30.
- Đơn giá riêng; online bằng 50% offline theo policy/version.
- Điều chỉnh công không ghi đè lịch sử.

Lương:

- Lương giờ.
- Phụ cấp.
- KPI.
- Thưởng doanh thu.
- Thưởng chấm bài.
- Hoa hồng.
- Tạm ứng.
- Khấu trừ.
- Điều chỉnh.

Chu kỳ:

- Tính tháng hiện tại.
- Chốt ngày 15 tháng sau.
- Trả ngày 28 tháng sau.
- Tạm ứng giữa tháng tối đa 50%.
- Nhân sự chỉ xem thu nhập của mình.
- Owner xem toàn bộ theo permission.

KPI chấm bài:

- Quỹ 1.000.000đ/tháng.
- Chỉ bài kiểm tra cuối buổi.
- Điều kiện “đã nhập điểm”.
- Một bài chỉ một trợ giảng chấm.
- Nộp muộn vẫn tính.
- Deadline trong ngày học.

## 10.8 Hoa hồng

Sale:

- Phần trăm thực thu, cố định/học viên mới hoặc kết hợp.
- Tính trên tiền thực thu sau ưu đãi.
- Ghi nhận khi phụ huynh chuyển tiền.

Sandbox/đối tác:

- Policy mới/tái riêng.
- Trả tổng cho đối tác.
- Refund tạo clawback theo tỷ lệ.

Chu kỳ thanh toán:

- Ngày 1–10.
- Ngày 11–20.
- Ngày 21–cuối tháng.

---

# 11. Roadmap còn lại

## Task 5.5C — Transactional lock/charge/reversal

Chưa hoàn thành.

Mục tiêu:

1. Tạo migration mới; không sửa `20260726121832`.
2. Nâng `lock_class_session` thành transaction khóa và charge.
3. Trong cùng transaction:
   - Khóa row session.
   - Kiểm tra permission/auth/status/attendance/result.
   - Khóa session.
   - Tạo `session_charge -1` cho attendance chargeable của regular/makeup.
   - Không charge `additional_study` hoặc additional session.
   - Dùng event key deterministic.
   - Chạy lại không tạo charge lần hai.
   - Nếu bất kỳ insert lỗi, toàn transaction rollback, kể cả lock.
   - Ghi audit.
4. Tạo workflow reversal riêng cho charge đã phát sinh.
5. Không xóa charge cũ.
6. Một charge chỉ reversal một lần.

`OPEN_DECISION` cần xử lý trước khi code:

- Nguồn `unit_price_vnd` khi học viên đang học âm chưa có vì Task 7 chưa có fee policy/credit lot. Không tự hard-code giá. Có thể để nullable theo foundation hoặc đề xuất migration/policy riêng và chờ người dùng duyệt.
- Locked session hiện bất biến và `cancel_class_session` hiện không cho hủy completed/locked. Không tự sửa status của locked session. Reversal nên là workflow riêng; nếu cần state “hủy sau khóa” phải thiết kế correction/cancellation request riêng và xin duyệt.
- Permission cho reversal phải được xác nhận. Không tự cấp cho teaching assistant chỉ vì họ có `sessions.lock`.

Acceptance bắt buộc:

- Present/CP/KP regular/makeup bị charge đúng một lần.
- Additional không charge.
- Lock lại không charge lần hai.
- Số dư âm vẫn cho phép.
- Charge có liên kết student, enrollment, session, attendance.
- Reversal +1, link charge gốc, không xóa/sửa entry.
- RLS/browser không được insert ledger trực tiếp.
- Audit đầy đủ.
- Test transaction rollback.

## Task 5.5D — Ledger/alerts UI thật

Chưa hoàn thành.

- Nối Student Detail với:
  - `student_session_ledger_running_balances`.
  - `student_session_balances`.
  - `student_session_balance_alerts`.
- Thay ledger/alert mock bằng dữ liệu thật ở route database-backed.
- Chỉ tải khi có `session_ledger.view`.
- Hiển thị entry type, delta, balance after, ngày, reference, actor/note phù hợp.
- Không hiển thị ID kỹ thuật.
- Empty/error/permission-denied.
- Hiển thị zero/negative alert.
- Không hard-code low-balance threshold.
- Cập nhật Session lock UI để phản ánh kết quả charge nếu workflow trả summary.

## Task 5.5E — Nghiệm thu Task 5

- Test migration/RPC/RLS/idempotency/rollback.
- Test mobile attendance.
- Test session lock + ledger charge.
- Test reversal.
- Test ledger/alert UI.
- Lint/typecheck/build/browser.
- Commit/push feature branch.
- Fast-forward merge vào `main`.
- Push `main`.
- Xác minh local/remote/worktree sạch.

## Task 6 — CRM/Trial/Enrollment checklist

- CRM case.
- Guardian reuse.
- Source/channel động.
- Round robin.
- Nhận/chuyển lead có lịch sử.
- Trial booking/follow-up.
- Enrollment queue/checklist.
- Transaction convert CRM case thành học viên chính thức.
- Chỉ đủ checklist mới convert.

## Task 7 — Finance/SePay

- Payment request/QR.
- Webhook idempotency.
- Split allocation nhiều con.
- Credit lot.
- Ledger credit.
- Tách new/renewal.
- Refund.
- Cashflow.
- Commission provisional/clawback.

## Task 8 — Staff/Timekeeping/Payroll/Commission

- Hồ sơ nhân sự mở rộng.
- Ca làm/phân công.
- Check-in/out.
- Rate version.
- Adjustment request.
- Payroll draft/reconcile/approval.
- Advance.
- Grading credit.
- Sale/Sandbox commission.

## Task 9 — Coaching/Dashboard/Reports/Notifications/Import

- Coaching.
- Dashboard theo role.
- Reports/export.
- Notifications.
- Import dry-run.
- Audit viewer.

## Task 10 — Hardening/staging

- Vitest/Playwright.
- Permission/RLS tests.
- Finance idempotency.
- Backup/restore rehearsal.
- Mobile attendance review.
- Vercel staging.
- Hướng dẫn chạy thử.
- Chạy song song Google Sheets 2 tuần.
- Không release khi còn lỗi S1/S2.

---

# 12. Cách làm việc với người dùng

Người dùng không chuyên code sâu và muốn làm từng bước.

Agent phải:

- Trả lời bằng tiếng Việt.
- Không đưa quá nhiều task trong một lần.
- Mỗi lần chỉ một bước bounded.
- Lệnh Terminal phải đầy đủ, có thể copy/paste.
- Sau mỗi bước yêu cầu người dùng gửi output.
- Đọc output rồi mới chuyển bước.
- Không bảo người dùng sửa thủ công file dài khi có thể dùng script an toàn.
- Không yêu cầu secret.
- Không tự nhận task đã đạt khi chưa có evidence.
- Không hứa chạy ngầm.

Mẫu xử lý mỗi task:

1. Preflight.
2. Inventory/đọc code hiện tại.
3. Chốt thiết kế và `OPEN_DECISION`.
4. Tạo migration/code nhỏ.
5. Static review.
6. Lint/typecheck/build/test.
7. Apply Cloud nếu có schema.
8. Generate types.
9. Browser smoke test.
10. Diff review.
11. Commit/push.
12. Merge khi toàn bộ task đạt.

---

# 13. Phản hồi đầu tiên Antigravity nên gửi

Không sửa code. Chỉ nói ngắn gọn:

> Tôi đã tiếp nhận kế hoạch. Trước khi tiếp tục Task 5.5C, tôi sẽ xác minh branch, worktree, commit, remote, migration Cloud, generated types và quality gate thực tế. Tôi sẽ không sửa migration đã apply và không thay đổi code trong bước kiểm tra đầu tiên.

Sau đó yêu cầu chạy khối lệnh tại mục 7 hoặc tự chạy bằng Terminal của Antigravity.

---

# 14. Điều tuyệt đối không được làm

- Không chạy `supabase db reset`.
- Không dùng migration repair.
- Không sửa migration đã apply.
- Không đưa service-role key ra browser.
- Không yêu cầu token/secret.
- Không direct write ledger/session/attendance/result từ browser.
- Không xóa/sửa ledger entry cũ.
- Không tự thêm `organization_id` giữa chừng.
- Không dùng schema v0.1 làm schema hiện hành.
- Không tự đổi permission code.
- Không tự hard-code giá học phí hoặc ngưỡng cảnh báo chưa chốt.
- Không đưa mock finance/ledger trở lại route thật.
- Không trộn Task 6/7 vào Task 5.5C.
- Không merge khi lint/typecheck/build/test chưa đạt.

---

# 15. Điểm bắt đầu chính xác

Sau khi preflight xác nhận Task 5.5B-3 thực sự sạch và đồng bộ, bắt đầu:

```text
Task 5.5C-1 — Inventory và thiết kế transactional lock-and-charge/reversal
```

Chưa tạo UI trong cùng bước. Chưa sửa migration ledger foundation. Trước tiên đọc chính xác:

- `lock_class_session` hiện hành.
- Trigger bảo vệ locked/completed session.
- Ledger foundation và constraint.
- Server Action/UI đang gọi `lock_class_session`.
- Permission matrix hiện hành.

Sau đó mới tạo migration workflow mới.
