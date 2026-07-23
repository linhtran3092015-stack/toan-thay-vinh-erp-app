# ERP QUẢN LÝ TRUNG TÂM TOÁN THẦY VINH
## Tài liệu bàn giao kỹ thuật cho Codex tài khoản mới

**Cập nhật:** 23/07/2026  
**Trạng thái:** đang phát triển trên nhánh Task 4  
**Ngôn ngữ làm việc:** Tiếng Việt

---

# 1. Mục đích

Tài liệu này giúp một phiên Codex mới tiếp tục dự án mà không phải suy đoán lại kiến trúc, nghiệp vụ và tiến độ.

Codex mới phải:

1. Đọc tài liệu này trước khi sửa code.
2. Kiểm tra Git thực tế, không tin hoàn toàn vào trạng thái dự kiến.
3. Xem migration đã áp dụng trên Supabase Cloud là nguồn sự thật.
4. Không sửa migration cũ đã áp dụng.
5. Không đưa giả định từ prototype/schema v0.1 cũ vào code hiện tại.
6. Làm từng bước nhỏ, chạy quality gate và chờ người dùng xác nhận.

---

# 2. Tóm tắt hệ thống

Tên: **ERP Quản Lý Trung Tâm Toán Thầy Vinh**.

Mục tiêu:

- Thay dần Google Sheets và dữ liệu phân tán.
- Chuẩn hóa học viên, phụ huynh, lớp, lịch, điểm danh, kết quả, học phí, số buổi, CRM, nhân sự, lương, hoa hồng và báo cáo.
- Mọi nghiệp vụ quan trọng phải có permission, lịch sử và audit.
- Giảm sai học phí, công nợ, lương, hoa hồng và số buổi.
- Dễ dùng với nhân sự không chuyên công nghệ.

Quy mô dự kiến:

- Một cơ sở ở giai đoạn hiện tại.
- Online và offline.
- Khối 1–12.
- Khoảng 1.000 học viên.
- Khoảng 20 nhân sự.
- Không đặt giới hạn sĩ số cứng.

---

# 3. Stack và môi trường

- Next.js App Router 16.2.10.
- TypeScript strict.
- Tailwind CSS.
- shadcn/ui.
- Supabase PostgreSQL/Auth/RLS.
- `@supabase/ssr`.
- Google OAuth.
- GitHub, dự kiến Vercel.
- Node.js 24.x.
- Responsive web/PWA.

Supabase Cloud:

```text
Project name: ttv-erp-dev
Project ref: tsihernwjunagrmvdqyb
Region: Singapore
```

Không đưa vào chat/commit:

- `.env.local`
- access token/refresh token
- service-role key
- private key
- webhook secret

---

# 4. Quy tắc kiến trúc bắt buộc

## 4.1 Database và migration

- Migration là nguồn sự thật.
- Migration đã áp dụng lên Cloud là bất biến.
- Thay đổi schema phải tạo migration timestamp mới.
- Không dùng `supabase db reset`.
- Không dùng migration repair.
- Không thay migration bằng sửa trực tiếp Table Editor.
- Không hard delete dữ liệu nghiệp vụ quan trọng.
- Audit append-only.
- UUID primary key, `snake_case`, `created_at`, `updated_at`, `timestamptz`.
- Tiền về sau lưu `bigint` VND; số buổi lưu integer.

## 4.2 Bảo mật

Permission phải kiểm tra tại:

1. UI.
2. Server Component/Server Action/Route Handler.
3. RLS hoặc PostgreSQL function.

Không được:

- Dùng service-role key trên browser.
- Suy quyền từ email, role name hoặc metadata.
- Bypass RLS.
- Ghi nhiều bảng nghiệp vụ trực tiếp từ browser.
- Trả lỗi database thô ra UI.
- Cho browser ghi audit log.

## 4.3 Trách nhiệm

Browser:

- Hiển thị, nhập liệu, validation trải nghiệm, gọi server workflow.

Next.js server:

- Auth, permission, validation, gọi RPC, chuẩn hóa lỗi, revalidate.

PostgreSQL:

- Nguồn sự thật cuối cùng của quyền, lịch sử, học phí, số buổi, giao dịch, lương, hoa hồng và audit.
- Nghiệp vụ nhiều bảng phải transaction trong database function.

## 4.4 UI

- Tiếng Việt.
- Desktop 1440px, tablet 1024px, mobile 390px.
- Không landing page, không animation trang trí.
- Không nhồi toàn màn hình vào một file.
- Có loading/empty/error/permission-denied/not-found.
- Không trộn dữ liệu mock với dữ liệu thật.
- Không giả lập số dư, học phí, nguồn, sale hoặc điểm khi bảng thật chưa có.

---

# 5. Tài liệu cũ và thứ tự ưu tiên nguồn sự thật

Các file lịch sử như `DESIGN.md`, `IMPLEMENTATION_FOUNDATION.md`, `CODEX_MASTER_PROMPT.md`, `supabase_schema_v0_1.sql` và prototype HTML giúp hiểu định hướng nhưng không còn là schema hiện hành.

Sai lệch quan trọng:

- Schema v0.1 có `organization_id`; implementation hiện tại chưa dùng `organization_id`.
- Bản cũ có membership/invitation/MFA; hiện tại mới triển khai Google Auth, profiles, roles và assignments.
- Bản cũ có nhiều permission/fee policy chưa được xác nhận trong code thật.
- Schema thật đã tách theo migration Task 3–4.

Khi xung đột, ưu tiên:

1. Migration đã áp dụng trên Cloud.
2. Code hiện tại.
3. Quyết định nghiệp vụ mới nhất của người dùng.
4. Tài liệu prototype cũ.

---

# 6. Git và trạng thái repository

Nhánh hiện tại:

```text
feat/task-4-student-class-foundation
```

`main` hiện dừng tại:

```text
d3c1d15 feat: add staff role management interface
```

Commit quan trọng, mới đến cũ:

```text
7a6cb43 feat: connect student detail to Supabase
a08d2bb feat: connect student directory to Supabase
94adf4c feat: add student enrollment workflows
9e9f79f feat: add student enrollment database foundation
7a7ebb7 feat: add class and schedule database foundation
432943b feat: add student and guardian database foundation
d3c1d15 feat: add staff role management interface
0757e7d feat: add audited role assignment functions
e1f0292 feat: add read-only staff directory
6ad7dac feat: enforce database-backed permissions
9bc8f28 feat: add identity and RBAC foundation
ad736b0 feat: establish ERP frontend and Supabase authentication foundation
```

## Trạng thái đang dở lúc bàn giao

Người dùng xác nhận đã làm xong **Task 4E.2C — class directory**, nhưng chưa xác nhận commit mới.

File dự kiến đang thay đổi/untracked:

```text
src/features/classes/read-models.ts
src/features/classes/data.ts
src/features/classes/class-list-page.tsx
src/app/classes/layout.tsx
src/app/classes/page.tsx
src/config/navigation.ts
```

Codex mới phải kiểm tra:

```bash
git branch --show-current
git status --short
git log --oneline -15
find src/app/classes -maxdepth 4 -type f | sort
find src/features/classes -maxdepth 4 -type f | sort
```

Không giả định working tree sạch.

---

# 7. Migration đã áp dụng — không được sửa

```text
supabase/migrations/20260722082513_identity_rbac_foundation.sql
supabase/migrations/20260722113559_role_assignment_management.sql
supabase/migrations/20260722130437_student_guardian_foundation.sql
supabase/migrations/20260722133125_class_schedule_foundation.sql
supabase/migrations/20260723084300_student_enrollment_foundation.sql
supabase/migrations/20260723085911_student_enrollment_workflows.sql
```

## 7.1 Identity/RBAC

Bảng:

- `profiles`
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`
- `audit_logs`

Role seed:

```text
owner
accountant
operations_manager
assistant_manager
teaching_assistant
admissions_specialist
admissions_leader
admissions_manager
collaborator
```

Function/trigger chính:

- `set_updated_at`
- `handle_auth_user_created`
- `protect_role_code_after_use`
- `protect_user_role_assignment_history`
- `prevent_audit_log_mutation`
- `audit_role_permission_change`
- `audit_user_role_assignment_change`
- `has_permission`
- `get_my_permissions`

Đặc điểm:

- Một user có nhiều role.
- Không xóa assignment lịch sử.
- Thu hồi bằng `revoked_at`, người thu hồi và lý do.
- Unique active `(user_id, role_id)`.
- Thay đổi role/permission phải audit.
- Audit không update/delete.

RPC role:

```text
assign_user_role(uuid,text,text)
revoke_user_role_assignment(uuid,text)
```

UI `/staff` đã dùng Server Actions, Zod, permission và RPC; không ghi trực tiếp bảng.

## 7.2 Guardian/Student

Bảng:

- `guardians`
- `students`
- `student_guardians`

Có:

- `normalize_vietnam_phone`
- sequence/function cấp mã học viên
- phụ huynh chính
- một phụ huynh nhiều con
- lịch sử liên kết
- read-only RLS cho browser

## 7.3 Class/Schedule

Bảng:

- `academic_years`
- `classes`
- `class_schedule_templates`

Constraint:

- Năm học code dạng `YYYY-YYYY`.
- Class code viết hoa, regex `^[A-Z0-9._-]+$`.
- Grade 1–12.
- Level `A`, `B`, `CLC`.
- Mode `online`, `offline`, `hybrid`.
- Status `draft`, `active`, `closed`, `archived`.
- Một lớp có nhiều lịch cố định và lịch sử supersession.
- Browser chỉ đọc.

## 7.4 Enrollment

Bảng:

- `student_enrollments`

Nguyên tắc:

- Một học viên chỉ có một enrollment active.
- Không ghi đè/xóa lịch sử.
- Chuyển lớp/quay lại tạo successor.
- Nối lịch sử bằng `supersedes_enrollment_id`.
- Có `transition_kind`, `effective_from/to`, `start_reason/end_reason`.

RPC:

```text
enroll_student_in_class(uuid,uuid,text,date,text)
transfer_student_class(uuid,uuid,text,date,text)
reserve_student_enrollment(uuid,date,text)
resume_student_enrollment(uuid,uuid,text,date,text)
```

Permission:

```text
enroll: students.manage_status
transfer: students.transfer_class
reserve/resume: students.reserve
```

Quy tắc ngày:

- Transfer phải hiệu lực hôm nay theo `Asia/Ho_Chi_Minh`.
- Reserve phải hiệu lực hôm nay.
- Resume thực hiện trong ngày.
- Initial enrollment có thể dùng ngày đã qua.

Đã test permission, duplicate, future date denial, transfer, reserve, resume, history chain, one-active, state update, audit và forced rollback.

Kết quả:

```text
all_workflows_passed_and_rolled_back = true
```

---

# 8. Permission hiện hành

Nguồn type hiện hành:

```text
src/lib/permissions/types.ts
```

Permission đã seed/được dùng:

```text
app.access
classes.view
classes.create
classes.manage_schedule
guardians.view
students.view
students.create
students.update
students.manage_status
students.reserve
students.transfer_class
coaching.view
session_ledger.view
audit.view
staff.view
staff.roles.view
staff.roles.manage
```

Lưu ý:

- `src/types/domain.ts` còn permission legacy/roadmap.
- Database và `src/lib/permissions/types.ts` là nguồn hiện hành.
- Thêm permission phải có migration, không chỉ sửa TypeScript.
- Owner có toàn bộ permission hiện hành.
- Role khác ban đầu chủ yếu chỉ có `app.access` nếu chưa cấp thêm.

---

# 9. UI/route đã hoàn thành

## 9.1 Auth/shell

- `/login`
- `/auth/callback`
- Google login/logout
- Supabase browser/server clients
- cookie refresh proxy
- Authenticated AppShell
- Sidebar theo permission
- Topbar
- Shared loading/error/empty/permission denied
- Permission từ `get_my_permissions()`

## 9.2 Staff

- `/staff`
- profiles thật
- role thật
- cấp/thu hồi role
- lý do bắt buộc
- audit
- permission guard

## 9.3 Students

Đã database-backed:

- `/students`
- `/students/[studentId]`
- filter tên/mã/SĐT, khối, lớp, status, level, mode
- desktop/mobile
- guardian thật
- active class/schedule thật
- enrollment history thật
- not-found
- không hiển thị finance/result mock trên trang thật

Data layer:

```text
src/features/students/data.ts
src/features/students/read-models.ts
```

Chưa database-backed:

- `/students/new`
- `/students/[studentId]/edit`
- duplicate check/form mutation
- enrollment action UI

File mock cũ vẫn tồn tại; không được đưa lại vào route database-backed.

## 9.4 Classes

Task 4E.2C đã tạo dự kiến:

- `/classes`
- classes AppShell layout
- Supabase read model/data layer
- desktop/mobile list
- filter năm học, khối, level, mode, status
- active schedule count
- active student count khi có `students.view`
- navigation bật theo `classes.view`

Chưa có:

- `/classes/[classId]`
- quản lý schedule
- create/edit class
- mutation class/schedule

---

# 10. Ma trận tiến độ

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Task 1 Bootstrap | Hoàn thành | Next.js, Supabase clients, shell, shared states |
| Task 2 Student mock UI | Hoàn thành | list/detail/form mock, responsive |
| Task 3.1 Supabase foundation | Hoàn thành | |
| Task 3.2 Google Auth | Hoàn thành | |
| Task 3.3A Identity/RBAC | Hoàn thành | commit `9bc8f28` |
| Task 3.3B Cloud/Owner bootstrap | Hoàn thành | |
| Task 3.4 DB permissions | Hoàn thành | `6ad7dac` |
| Task 3.5A Staff directory | Hoàn thành | `e1f0292` |
| Task 3.5B Role RPC | Hoàn thành | `0757e7d` |
| Task 3.5C Staff role UI | Hoàn thành | `d3c1d15` |
| Task 4B Guardian/Student DB | Hoàn thành | `432943b` |
| Task 4C Class/Schedule DB | Hoàn thành | `7a7ebb7` |
| Task 4D.1 Enrollment DB | Hoàn thành | `9e9f79f` |
| Task 4D.2 Enrollment RPC | Hoàn thành | `94adf4c` |
| Task 4D.3 Rollback test | Hoàn thành | test true |
| Task 4E.1 Student real UI | Hoàn thành | `a08d2bb`, `7a6cb43` |
| Task 4E.2A Inventory | Hoàn thành | |
| Task 4E.2B Class data layer | Hoàn thành | chưa xác nhận commit riêng |
| Task 4E.2C Class directory | Người dùng xác nhận xong | cần kiểm tra Git/browser/commit |
| Task 4E.2D Class detail | Chưa làm | `/classes/[classId]` |
| Task 4E.2E Class tests | Chưa làm | permission, responsive, not-found |
| Task 4E.3 Student/Guardian create-edit | Chưa làm | cần safe RPC/server workflow |
| Task 4E.4 Enrollment action UI | Chưa làm | gọi 4 RPC |
| Task 4E.5 Regression/merge | Chưa làm | test rồi merge Task 4 |

---

# 11. Nghiệp vụ đã chốt

## 11.1 Học viên/phụ huynh

Student lưu:

- Họ tên, tên thường gọi, năm sinh.
- Tỉnh/thành phố, khối, A/B/CLC.
- Hình thức đăng ký, mục tiêu, ghi chú.
- Ngày học chính thức, lifecycle.

Không cần:

- giới tính, ảnh, trường, quận/huyện, địa chỉ chi tiết.

Guardian:

- Một phụ huynh nhiều con, thực tế tối đa khoảng 5.
- Nhiều con dùng chung phone.
- Có phụ huynh chính.
- Họ tên, phone, Zalo, email, notes.
- Không hard delete lịch sử.

Lifecycle:

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

Không dùng “đã nghỉ”.

## 11.2 Trial/CRM

- Trial 1 buổi miễn phí.
- Trial không vào attendance/result chính thức.
- Không đăng ký thì giữ “đang quan tâm”.
- Quay lại dùng hồ sơ cũ.
- Sale nhập lead trước.
- Chỉ official khi đủ checklist và đã nhận học phí.
- Một phụ huynh có nhiều case con.
- Chốt lớp trong ngày trial.
- Nguồn MMA/Sandbox và kênh.
- Round-robin/lead transfer làm ở module CRM sau.

## 11.3 Lớp

- Khối 1–12, A/B/CLC.
- Không max capacity cứng.
- Một lớp nhiều lịch cố định.
- CLC1/CLC2 có thể cùng level nhưng khác lịch.
- Có lớp 1 hoặc 2 buổi/tuần.
- Online/offline có thể học chung nhưng fee khác.
- Hủy buổi có thể không tính phí.
- Có ClassIn URL.

## 11.4 Enrollment

- Một lớp chính active/học viên.
- Chuyển lớp giữ mã và lịch sử.
- Bảo lưu từ ngày trợ lý xác nhận, không giới hạn thời gian.
- Resume vào lớp cũ hoặc mới.
- Lên lớp giữ mã, chưa chọn lớp thì `waiting_class`.
- Registered mode phục vụ học phí; actual mode sẽ nằm ở attendance.

## 11.5 Session/attendance/results — chưa triển khai

Attendance status:

```text
present
excused_absence
unexcused_absence
additional_study
```

Quy tắc:

- Present lớp chính: trừ buổi.
- Vắng CP/KP lớp chính: vẫn trừ buổi.
- Additional: không trừ.
- Trial không vào attendance chính thức.
- Update muộn phải đánh dấu.
- Khóa sau khi đủ attendance/result.

Result:

- Điểm cuối buổi, điểm vở, “chưa nộp”, nhận xét.
- Không áp dụng trial.
- Sửa trước khi session khóa.

Session status:

```text
scheduled
in_progress
attendance_completed
locked
cancelled
rescheduled
interrupted
```

Lock phải idempotent; không trừ lần hai. Hủy sau lock tạo reversal, không xóa charge.

## 11.6 Học phí/số buổi — chưa triển khai

- Quy đổi tiền thành số buổi theo đơn giá thực tế.
- Chuyển thừa thành thêm buổi, thiếu thành số buổi thực tế.
- Cho học âm nhưng cảnh báo.
- Buổi tặng integer.
- Ưu đãi giảm %, tặng buổi hoặc kết hợp.
- Tách tuyển mới/tái phí.
- Không dùng cột số dư sửa tay; dùng immutable ledger.
- Hoàn: buổi chưa dùng × đơn giá thực tế.
- Không hoàn bonus.
- Refund không tính doanh thu/hoa hồng, có clawback.
- Chuyển buổi không tạo doanh thu.

SePay:

- Hai tài khoản tuyển mới/tái phí.
- Nội dung: SĐT PH + tên học viên.
- Một transaction có thể chia nhiều con.
- Webhook idempotent.
- Tổng allocation phải khớp.
- Browser không tự ghi nhiều bảng.

## 11.7 Nhân sự/lương — mới xong identity/role

Vai trò nghiệp vụ:

- Owner, kế toán, trợ lý QL, trợ giảng, sale, CTV và các cấp tuyển sinh.

Timekeeping dự kiến:

- Web + Wi-Fi + GPS.
- Online start/end.
- Tính phút, offline mode.
- TA auto end 23:30.
- Rate riêng; online dự kiến 50% offline theo policy/version.
- Điều chỉnh không ghi đè lịch sử.

Payroll:

- Lương giờ, phụ cấp, KPI, thưởng doanh thu, thưởng chấm bài, hoa hồng, tạm ứng, khấu trừ.
- Chốt ngày 15 tháng sau, trả ngày 28 tháng sau.
- Tạm ứng giữa tháng tối đa 50%.
- Nhân sự chỉ xem thu nhập mình; owner xem tất cả theo permission.

## 11.8 Hoa hồng — chưa triển khai

- Sale: %, cố định/HV mới hoặc kết hợp; trên thực thu sau ưu đãi.
- Ghi nhận khi PH chuyển tiền.
- Sandbox có policy mới/tái riêng và clawback khi refund.
- Kỳ: 1–10, 11–20, 21–cuối tháng.

## 11.9 Coaching — chưa triển khai

- Mỗi đợt là một phiếu, không ghi đè lịch sử.
- Có status, priority, owner, review date, outcome.
- Permission hạn chế; TA không mặc định được xem.

---

# 12. Roadmap sau Task 4

## Task 5 — Session/Attendance/Results/Ledger

- Sessions, generation, attendance, additional study.
- Result entry.
- Lock/cancel/reversal RPC.
- Session ledger và alerts.
- Mobile-first attendance.

## Task 6 — CRM/Trial/Enrollment checklist

- CRM case, guardian reuse, source/channel.
- Round robin, transfer lead.
- Trial, follow-up.
- Enrollment checklist.
- Transaction convert lead thành official.

## Task 7 — Finance/SePay

- Payment request/QR.
- Webhook idempotency.
- Split allocation.
- Credit lot, ledger credit.
- New/renewal.
- Refund/cashflow/commission clawback.

## Task 8 — Staff/Timekeeping/Payroll/Commission

- Staff expansion, shifts, check-in/out.
- Rate version, adjustment.
- Payroll draft/approval, advance.
- Grading credit, sale/Sandbox commission.

## Task 9 — Coaching/Dashboard/Reports/Notification/Import

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
- Chạy song song Sheets 2 tuần.
- Không release khi còn S1/S2.

---

# 13. Quality gate

Tối thiểu mỗi bước:

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

Ngoài ra:

- Browser test, console sạch.
- Responsive.
- Permission denied.
- Empty/error/not-found.
- Secret scan.
- Không `any` không giải thích.
- Không direct browser write.
- Review data integrity/audit.
- Git diff đúng phạm vi.

---

# 14. Việc Codex mới phải làm ngay

## Bước 1 — chỉ kiểm tra

```bash
{
  echo "===== BRANCH / WORKTREE ====="
  git branch --show-current
  git status --short
  git log --oneline -15

  echo
  echo "===== CLASS FILES ====="
  find src/app/classes -maxdepth 4 -type f | sort
  find src/features/classes -maxdepth 4 -type f | sort

  echo
  echo "===== CLASS ROUTE ====="
  sed -n '1,240p' src/app/classes/page.tsx 2>/dev/null || true

  echo
  echo "===== CLASS DATA ====="
  sed -n '1,680p' src/features/classes/data.ts 2>/dev/null || true

  echo
  echo "===== CLASS READ MODELS ====="
  sed -n '1,300p' src/features/classes/read-models.ts 2>/dev/null || true

  echo
  echo "===== CLASS LIST UI ====="
  sed -n '1,760p' src/features/classes/class-list-page.tsx 2>/dev/null || true

  echo
  echo "===== NAVIGATION ====="
  grep -n -A8 -B3 'href: "/classes"' src/config/navigation.ts || true

  echo
  echo "===== QUALITY ====="
  npm run lint
  npm run typecheck
  npm run build
  git diff --check
} > /tmp/codex-account-handoff-check.txt 2>&1

wc -l /tmp/codex-account-handoff-check.txt
open /tmp/codex-account-handoff-check.txt
```

## Bước 2 — browser test `/classes`

- Sidebar có mục lớp khi có `classes.view`.
- `/classes` đọc Supabase, không mock.
- Empty hợp lệ nếu chưa có lớp.
- Filter hoạt động.
- Desktop/mobile ổn.
- Console không lỗi đỏ.
- Link `/classes/<uuid>` hiện chưa hoàn chỉnh vì class detail chưa làm.

## Bước 3 — commit 4E.2C sau khi đạt

Dùng file thực tế từ `git status`, dự kiến:

```bash
git add \
  src/features/classes/read-models.ts \
  src/features/classes/data.ts \
  src/features/classes/class-list-page.tsx \
  src/app/classes/layout.tsx \
  src/app/classes/page.tsx \
  src/config/navigation.ts

git commit -m "feat: add database-backed class directory"
```

## Bước 4 — Task 4E.2D

Tạo `/classes/[classId]` read-only:

- `getClassDetail`.
- Năm học, mã/tên/khối/level/mode/status.
- Số buổi/tuần.
- Active student count khi có `students.view`.
- ClassIn URL.
- Active và historical schedules.
- Permission/error/not-found.
- Không làm mutation schedule trong cùng bước.
- Browser test UUID thật và UUID giả.
- Commit riêng.

---

# 15. Cách làm việc với người dùng

- Trả lời tiếng Việt.
- Một bước đánh số tại một thời điểm.
- Lệnh terminal đầy đủ, copy nguyên khối.
- Nêu kết quả mong đợi.
- Chờ output trước bước tiếp.
- Sửa đúng lỗi hiện tại, không viết lại kiến trúc không cần thiết.
- Không hỏi secret.
- Không tự tạo migration khi nghiệp vụ chưa chốt.
- Không sửa nhiều module trong một commit.
- Không merge `main` trước khi Task 4 hoàn tất và regression đạt.

---

# 16. Trước khi đổi tài khoản

Nếu 4E.2C đã test đạt:

```bash
git status --short
# commit class directory
git push -u origin feat/task-4-student-class-foundation
git status --short
git log --oneline -5
git remote -v
```

Không push `.env.local`.

Tài khoản Codex mới chỉ cần mở đúng repository/folder. Git history, working tree và Supabase Cloud không phụ thuộc tài khoản Codex.

---

# 17. Tuyệt đối không làm

- Không `db reset`.
- Không migration repair.
- Không sửa migration đã apply.
- Không paste key/token.
- Không service-role browser.
- Không direct write client cho nghiệp vụ nhạy cảm.
- Không bỏ guard server/database.
- Không xóa audit/history.
- Không đổi schema theo v0.1 cũ.
- Không đưa mock lại vào màn hình database-backed.
- Không merge khi quality gate chưa đạt.
- Không đánh dấu 4E.2 hoàn tất khi chưa có class detail và test.

---

# 18. Tóm tắt một dòng

**Dự án đã hoàn tất Auth, RBAC, Staff role management, Student/Guardian/Class/Schedule/Enrollment database foundations, enrollment RPC và Student database-backed UI; hiện ở Task 4E.2C với class directory đã dựng nhưng cần kiểm tra Git/browser/commit, sau đó làm class detail, create/edit student-guardian, enrollment action UI và regression để kết thúc Task 4.**
