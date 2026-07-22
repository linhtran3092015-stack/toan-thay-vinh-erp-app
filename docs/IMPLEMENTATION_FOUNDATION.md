# TOÁN THẦY VINH ERP — IMPLEMENTATION FOUNDATION v0.1

Tài liệu này là cầu nối giữa giao diện demo HTML hiện có và hệ thống thật bằng Next.js + Supabase.

## 1. Trạng thái hiện tại

Giao diện demo đã đủ để dùng làm visual contract, nhưng chưa phải code production vì:

- HTML, CSS và JavaScript đang nằm trong một file lớn.
- Chưa có Next.js routing.
- Chưa có Supabase Auth.
- Chưa có RLS.
- Chưa có database transaction.
- Chưa có sổ cái số buổi.
- Chưa có permission theo tài khoản.
- Chưa có audit log thật.
- Dữ liệu đang hard-code.

Không nối Supabase trực tiếp vào `public/index.html`. Phải dựng lại thành component.

---

## 2. Kiến trúc chính thức

```text
Browser
  │
  ├── Next.js Server Components
  ├── Next.js Client Components
  ├── Server Actions / Route Handlers
  │
  ▼
Supabase
  ├── Google Auth + MFA
  ├── PostgreSQL
  ├── Row Level Security
  ├── Realtime
  └── Database Functions
  ▲
  │
SePay Webhook
```

### Trách nhiệm browser

- Hiển thị giao diện.
- Thu thập dữ liệu.
- Validation trải nghiệm.
- Realtime subscription.
- Gọi hành động phía server.

Browser không được:

- Tự quyết định số dư buổi.
- Tự ghi nhiều bảng trong một nghiệp vụ tài chính.
- Sử dụng service-role key.
- Tự chốt lương hoặc hoa hồng.

### Trách nhiệm Next.js server

- Xác thực người dùng.
- Kiểm tra permission.
- Validation dữ liệu.
- Gọi PostgreSQL function.
- Nhận webhook.
- Sinh Excel/PDF.
- Chuẩn hóa lỗi.

### Trách nhiệm PostgreSQL

Là nguồn sự thật đối với:

- Học phí.
- Số dư buổi.
- Giao dịch.
- Hoàn phí.
- Hoa hồng.
- Bảng công.
- Lương.
- Audit.
- Quyền truy cập cuối cùng.

---

## 3. Cấu trúc project

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── auth/callback/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
├── features/
│   ├── students/
│   ├── classes/
│   ├── attendance/
│   ├── results/
│   ├── finance/
│   ├── crm/
│   ├── staff/
│   ├── payroll/
│   └── coaching/
├── lib/
│   ├── supabase/
│   ├── permissions/
│   ├── validation/
│   └── formatting/
├── config/
└── types/

supabase/
├── migrations/
├── functions/
└── seed.sql
```

Không đặt toàn bộ màn hình trong một `page.tsx`.

---

## 4. Route map

### Auth và dashboard

| Route | Màn hình | Permission |
|---|---|---|
| `/login` | Google login | Công khai |
| `/` | Dashboard theo vai trò | `dashboard.view` |
| `/notifications` | Thông báo | `notifications.view` |
| `/settings` | Cài đặt | `settings.view` |

### Học viên

| Route | Màn hình | Permission |
|---|---|---|
| `/students` | Danh sách | `students.view` |
| `/students/new` | Tạo hồ sơ | `students.create` |
| `/students/[id]` | Chi tiết | `students.view` |
| `/students/[id]/edit` | Chỉnh sửa | `students.update` |
| `/students/[id]/transfer` | Chuyển lớp | `students.transfer_class` |
| `/students/[id]/reserve` | Bảo lưu | `students.reserve` |
| `/guardians/[id]` | Phụ huynh | `guardians.view` |

### Lớp và buổi học

| Route | Màn hình | Permission |
|---|---|---|
| `/classes` | Danh sách lớp | `classes.view` |
| `/classes/[id]` | Chi tiết lớp | `classes.view` |
| `/classes/[id]/schedule` | Lịch cố định | `classes.manage_schedule` |
| `/sessions` | Danh sách buổi | `sessions.view` |
| `/sessions/[id]/attendance` | Điểm danh | `attendance.mark` |
| `/sessions/[id]/results` | Nhập điểm | `results.enter` |
| `/sessions/[id]/lock` | Khóa buổi | `sessions.lock` |

### Tài chính

| Route | Màn hình | Permission |
|---|---|---|
| `/finance` | Dashboard tài chính | `finance.view` |
| `/finance/payment-requests` | Yêu cầu thanh toán | `payments.view` |
| `/finance/payment-requests/new` | Tạo QR | `payments.create_request` |
| `/finance/sepay` | Giao dịch SePay | `sepay.view` |
| `/finance/sepay/[id]` | Phân bổ giao dịch | `sepay.allocate` |
| `/finance/refunds` | Hoàn phí | `refunds.view` |
| `/finance/session-ledger` | Sổ cái số buổi | `session_ledger.view` |
| `/finance/cashflow` | Dòng tiền | `cashflow.view` |

### CRM

| Route | Màn hình | Permission |
|---|---|---|
| `/crm` | Kanban/Table | `crm.view` |
| `/crm/new` | Tạo lead | `crm.create` |
| `/crm/[id]` | Chi tiết lead | `crm.view` |
| `/crm/[id]/trial` | Học thử | `crm.book_trial` |
| `/crm/enrollment-queue` | Chờ nhập học | `enrollment.confirm` |

### Nhân sự

| Route | Màn hình | Permission |
|---|---|---|
| `/staff` | Nhân sự | `staff.view` |
| `/staff/[id]` | Hồ sơ nhân sự | `staff.view` |
| `/timekeeping` | Chấm công | `timekeeping.view` |
| `/payroll` | Bảng lương | `payroll.view` |
| `/advances` | Tạm ứng | `advances.view` |
| `/commissions` | Hoa hồng | `commissions.view` |

### Học tập

| Route | Màn hình | Permission |
|---|---|---|
| `/learning-results` | Tổng hợp kết quả | `results.view` |
| `/coaching` | Danh sách coaching | `coaching.view` |
| `/coaching/[id]` | Phiếu coaching | `coaching.view` |

### Quản trị

| Route | Màn hình | Permission |
|---|---|---|
| `/reports` | Báo cáo | `reports.view` |
| `/settings/users` | Tài khoản | `users.manage` |
| `/settings/permissions` | Ma trận quyền | `permissions.manage` |
| `/settings/audit-logs` | Nhật ký | `audit.view` |
| `/imports/students` | Import học viên | `imports.students` |

---

## 5. Domain model

### Organization

- Trung tâm.
- Cơ sở.
- Năm học.
- Múi giờ `Asia/Ho_Chi_Minh`.

### User và permission

- Supabase `auth.users`.
- `profiles`.
- `organization_memberships`.
- `roles`.
- `permissions`.
- `role_permissions`.
- `membership_permission_overrides`.

Quyền truy cập và vai trò công việc phải tách riêng.

### Guardian

Một phụ huynh có nhiều hồ sơ con.

### Student

Dùng từ giai đoạn quan tâm đến chính thức.

Trạng thái:

- `interested`
- `trial_booked`
- `trial_completed`
- `pending_enrollment_confirmation`
- `active`
- `reserved`
- `resumed`
- `waiting_class`
- `completed`

Không dùng `Đã nghỉ`.

Mã học viên chỉ cấp khi thành học viên chính thức.

### CRM Case

Mỗi người con có một case tuyển sinh riêng, nhưng cùng liên kết một phụ huynh.

Nhật ký chăm sóc chỉ cần:

- Trạng thái.
- Ghi chú ngắn.
- Ngày liên hệ lại.

### Class

- Khối 1–12.
- A/B/CLC.
- Không giới hạn sĩ số bắt buộc.
- Có ClassIn URL.
- Một lớp có thể có nhiều lịch cố định.

### Enrollment

- Một học sinh chỉ có một lớp chính hiệu lực.
- Hình thức đăng ký dùng để tính học phí.
- Hình thức thực tế từng buổi lưu ở attendance.

### Class Session

Trạng thái:

- `scheduled`
- `in_progress`
- `attendance_completed`
- `locked`
- `cancelled`
- `rescheduled`
- `interrupted`

### Attendance

Loại:

- `main`
- `additional`

Trạng thái:

- `present`
- `excused_absence`
- `unexcused_absence`
- `additional_study`

Vắng CP/KP của lớp chính đều trừ buổi. Học thêm không trừ.

### Result

Điểm kiểm tra cuối buổi và điểm vở.

Mỗi điểm có trạng thái:

- `scored`
- `not_submitted`
- `exempt`
- `not_applicable_absent`

### Fee Policy

- Online tỉnh: 70.000đ/buổi.
- Online Hà Nội/TP.HCM: 100.000đ/buổi.
- Offline: 140.000đ/buổi.

### Payment Allocation

Một giao dịch có thể chia cho nhiều con.

Mỗi dòng phân bổ lưu:

- Số tiền.
- Số buổi trả phí.
- Số buổi tặng.
- Giá thực tế.
- Sale chốt.
- Nguồn.
- Người xác nhận.

### Session Ledger

Không lưu một cột số dư có thể sửa tay.

Số dư được tính từ các phát sinh:

- `payment_credit`
- `bonus_credit`
- `session_charge`
- `session_reversal`
- `manual_adjustment`
- `transfer_out`
- `transfer_in`
- `refund_debit`
- `annual_carryover`

### Credit Lot

Mỗi lần nạp tạo một lot để hoàn phí theo FIFO.

### Refund

- Trợ lý yêu cầu.
- Kế toán kiểm tra.
- Chủ trung tâm duyệt.
- Chủ trung tâm thanh toán.
- Buổi tặng không hoàn.
- Thu hồi hoa hồng theo tỷ lệ.

### Time Entry

- Online/offline.
- Check-in/check-out.
- GPS/Wi-Fi evidence.
- Điều chỉnh qua yêu cầu.
- Trợ giảng có auto end 23:30.

### Payroll

Các thành phần:

- Lương giờ.
- Phụ cấp.
- KPI.
- Thưởng doanh thu.
- Thưởng chấm bài.
- Hoa hồng.
- Tạm ứng.
- Khấu trừ.
- Điều chỉnh.

### Coaching

- Mỗi đợt là một phiếu riêng.
- Không ghi đè lịch sử.
- Chỉ owner và trợ lý có quyền.
- Trợ giảng không được xem.

---

## 6. Permission codes

### Học viên

- `students.view`
- `students.create`
- `students.update`
- `students.transfer_class`
- `students.reserve`
- `students.confirm_official`
- `students.export`

### Lớp và học tập

- `classes.view`
- `classes.create`
- `classes.manage_schedule`
- `sessions.view`
- `sessions.cancel`
- `sessions.reschedule`
- `sessions.lock`
- `attendance.view`
- `attendance.mark`
- `attendance.approve_correction`
- `results.view`
- `results.enter`
- `results.approve_correction`

### Tài chính

- `finance.view`
- `payments.view`
- `payments.create_request`
- `sepay.view`
- `sepay.allocate`
- `sepay.accountant_confirm`
- `session_ledger.view`
- `session_ledger.adjust`
- `session_ledger.transfer`
- `refunds.view`
- `refunds.request`
- `refunds.accountant_check`
- `refunds.owner_approve`
- `cashflow.view`
- `cashflow.manage`
- `finance.export`

### CRM

- `crm.view`
- `crm.view_unassigned`
- `crm.create`
- `crm.update`
- `crm.take_unassigned`
- `crm.transfer`
- `crm.book_trial`
- `crm.view_kpi`
- `enrollment.confirm`

### Nhân sự

- `staff.view`
- `staff.manage`
- `staff.manage_rates`
- `timekeeping.view`
- `timekeeping.check`
- `timekeeping.approve_adjustment`
- `payroll.view`
- `payroll.manage`
- `payroll.accountant_reconcile`
- `payroll.owner_approve`
- `advances.request`
- `advances.review`
- `advances.owner_approve`
- `commissions.view`
- `commissions.manage`
- `commissions.owner_adjust`

### Quản trị

- `coaching.view`
- `coaching.manage`
- `reports.view`
- `reports.export`
- `users.manage`
- `permissions.manage`
- `audit.view`
- `settings.view`
- `imports.students`

Permission phải được kiểm tra ở:

1. UI.
2. Server Action/Route Handler.
3. RLS/database function.

Ẩn nút ở UI không được xem là bảo mật.

---

## 7. Transaction quan trọng

### Xác nhận phân bổ SePay

Trong một database transaction:

1. Khóa transaction.
2. Kiểm tra idempotency.
3. Kiểm tra tổng allocation bằng số tiền.
4. Tạo credit lot.
5. Cộng buổi trả phí.
6. Cộng buổi tặng.
7. Tạo commission provisional.
8. Cập nhật checklist nhập học.
9. Ghi audit.
10. Commit.

### Khóa buổi học

1. Kiểm tra điểm danh.
2. Kiểm tra kết quả.
3. Trừ 1 buổi cho present/CP/KP lớp chính.
4. Không trừ additional.
5. Ghi giá khi học âm.
6. Tạo grading credit.
7. Cập nhật cảnh báo.
8. Khóa session.
9. Ghi audit.

Chạy lại cùng session không được trừ lần hai.

### Hủy buổi đã khóa

- Không xóa charge.
- Tạo reversal `+1`.
- Ghi audit.

### Chuyển buổi

- Tạo một entry âm và một entry dương.
- Dùng cùng `transfer_group_id`.
- Không tạo doanh thu.
- Không tạo hoa hồng.

### Hoàn phí

- FIFO theo credit lot.
- Không hoàn bonus.
- Trừ số buổi bằng ledger.
- Tạo commission clawback.
- Tạo cashflow outflow.
- Không sửa giao dịch gốc.

### Chuyển CRM thành học viên

- Đủ checklist.
- Cấp mã học viên.
- Tạo enrollment.
- Chốt nguồn và sale.
- Đóng task.
- Ghi audit.

### Sửa sau khóa

- Tạo correction request.
- Trợ lý duyệt.
- Nếu ảnh hưởng số buổi, tạo reversal và entry mới.
- Không sửa ledger cũ.

---

## 8. Kế hoạch Alpha 7 ngày

### Ngày 1

- Repo.
- Next.js.
- Supabase staging.
- Vercel staging.
- Auth.
- Invitation.
- Permission.
- App shell.
- Audit.
- Seed.

### Ngày 2

- Guardian.
- Student.
- Danh sách.
- Hồ sơ.
- Class.
- Schedule.
- Enrollment.
- Chuyển lớp.
- Bảo lưu.

### Ngày 3

- Session.
- Attendance.
- Additional student.
- Result entry.
- Lock session.
- Session ledger.
- Alert.
- A/B/CLC theo 4 buổi.

### Ngày 4

- CRM.
- Round robin.
- Trial.
- Payment request.
- QR.
- SePay webhook.
- Split transaction.
- Enrollment checklist.

### Ngày 5

- Staff.
- Timekeeping.
- Rate.
- Payroll draft.
- Advance.
- Grading credit.
- Sale commission.
- Sandbox commission.

### Ngày 6

- Coaching.
- Dashboard.
- Báo cáo.
- Export.
- Notification.
- Import dry-run.

### Ngày 7

- E2E.
- Permission test.
- Finance idempotency.
- Mobile attendance.
- Deploy staging.
- Hướng dẫn chạy thử.

Sau đó chạy song song với Google Sheets 2 tuần.

---

## 9. Acceptance tests bắt buộc

### Auth

- Tài khoản được mời mới đăng nhập được.
- Tài khoản bị khóa mất quyền.
- API trực tiếp vẫn bị RLS chặn.
- Export bị chặn khi thiếu quyền.

### Học viên

- Một phụ huynh có nhiều con.
- Dò trùng chỉ cảnh báo.
- Bảo lưu giữ số dư.
- Chuyển lớp giữ lịch sử.
- Mã học viên cấp một lần.

### Điểm danh

- Present trừ 1.
- Vắng CP trừ 1.
- Vắng KP trừ 1.
- Additional không trừ.
- Trial không vào attendance chính thức.
- Thiếu điểm không khóa.
- Lock lại không trừ lần hai.
- Hủy buổi tạo reversal.

### Tài chính

- Webhook trùng không tạo dòng trùng.
- Một transaction chia nhiều con.
- Tổng allocation phải khớp.
- Allocation tạo lot và ledger.
- Học âm không bị chặn.
- Chuyển buổi không tạo doanh thu.
- Hoàn phí không hoàn bonus.
- Refund tạo clawback.

### CRM

- Lead tự chia vòng.
- Sale tự nhận lead chưa có người.
- Chuyển sale lưu lịch sử.
- Sale chốt tiền hưởng hoa hồng.
- Học thử tạo task trong ngày.
- Chỉ đủ checklist mới thành official.

### Nhân sự

- Online rate bằng 50% offline theo version.
- Điều chỉnh công không ghi đè lịch sử.
- Một bài chỉ có một grader.
- Advance trừ vào payroll.
- Payroll duyệt xong không sửa trực tiếp.
- Nhân sự chỉ xem thu nhập của mình.

---

## 10. Chuyển demo sang component

### Tái sử dụng

- Màu.
- Typography.
- Spacing.
- Sidebar.
- Topbar.
- Card.
- Badge.
- Bảng.
- Nội dung mẫu.
- Luồng modal.

### Dựng lại

- Routing.
- Auth.
- Permission.
- Form.
- Validation.
- Data fetching.
- Realtime.
- Responsive.
- Type.
- Transaction.
- Audit.

### Sai lệch phải sửa

- Khối 1–12.
- Bỏ giới tính.
- Bỏ “Đã nghỉ”.
- Bỏ max capacity bắt buộc.
- Học phí theo buổi.
- Dùng CLC.
- Nguồn cấu hình động.
- Tách registered mode và actual mode.
- Thêm ledger.
- Thêm credit lot.
- Thêm refund.
- Thêm permission.
- Thêm audit.
- Thêm coaching.
- Thêm clawback.

### Definition of Done một màn hình

- Đúng visual.
- Không hard-code nghiệp vụ.
- Có type.
- Có validation.
- Có permission.
- Có loading.
- Có empty.
- Có error.
- Responsive.
- Có test luồng chính.
- Lint và typecheck đạt.
