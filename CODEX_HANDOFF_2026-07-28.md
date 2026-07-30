# CODEX HANDOFF — ERP TOÁN THẦY VINH
## Ngày tạo: 2026-07-28 | Commit HEAD: `f2a6ea1` | Nhánh: `main`

---

## 1. TỔNG QUAN DỰ ÁN

ERP quản lý trung tâm toán Thầy Vinh — hệ thống nội bộ quản lý học viên, lớp học, buổi học, điểm danh, tài chính, CRM tuyển sinh, và nhân sự.

### Trạng thái hiện tại
- **Tasks 1-7**: ĐÃ HOÀN THÀNH và merge vào `main`
- **22 migrations**: Đã sync trên Supabase Cloud
- **Codebase**: ~170+ TypeScript/React files trong `src/`
- **Task 8+ (Nhân sự/Chấm công/Lương/Hoa hồng)**: CHƯA BẮT ĐẦU

---

## 2. TECHNOLOGY STACK

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Next.js | 16.2.10 | App Router, dùng `src/proxy.ts` thay `middleware.ts` |
| React | 19.2.4 | |
| TypeScript | ^5 | `strict: true` |
| Tailwind CSS | v4 | `@theme inline` trong `globals.css` |
| Supabase JS | ^2.110.8 | `@supabase/ssr` ^0.12.3 |
| React Hook Form | ^7.82.0 | + `@hookform/resolvers` ^5.4.0 |
| Zod | ^4.4.3 | |
| Node.js | 24.x | |

### NPM Scripts quan trọng
```bash
npm run dev              # Khởi chạy dev server (webpack mode)
npm run build            # Build production
npm run lint             # ESLint src --max-warnings=0
npm run typecheck        # tsc --noEmit
npm run supabase:db:push # Push migration lên Cloud
npm run supabase:types   # Gen TypeScript types từ Cloud schema
```

---

## 3. CẤU TRÚC THƯ MỤC

```
toan-thay-vinh-erp-app/
├── docs/
│   ├── CODEX_MASTER_PROMPT.md          # Prompt gốc
│   ├── IMPLEMENTATION_FOUNDATION.md    # Thiết kế nền tảng chi tiết (775 dòng)
│   ├── ANTIGRAVITY_REVIEW_PROMPT.md    # QA review prompt
│   ├── task-5-class-management-ui-design.md
│   └── backend/
│       ├── AUTH_SETUP.md               # Google Auth setup
│       ├── DATABASE_CONVENTIONS.md     # Quy ước database
│       ├── OWNER_BOOTSTRAP.md          # Bootstrap owner role
│       ├── RBAC_MODEL.md               # Mô hình RBAC
│       └── SUPABASE_SETUP.md           # Supabase client/server setup
├── supabase/
│   ├── config.toml                     # project_id = "toan-thay-vinh-erp-app"
│   └── migrations/                     # 22 migration files (xem Section 7)
├── src/
│   ├── proxy.ts                        # Auth proxy (thay middleware.ts)
│   ├── app/                            # Next.js App Router pages
│   ├── components/                     # Shared UI components
│   ├── config/                         # Navigation config
│   ├── features/                       # Feature modules (8 modules)
│   ├── lib/                            # Shared libraries
│   └── types/                          # TypeScript types
├── package.json
├── tsconfig.json
├── next.config.ts
├── AGENTS.md
├── CLAUDE.md
└── .env.local                          # KHÔNG commit (có .env.example)
```

---

## 4. KIẾN TRÚC ỨNG DỤNG

### 4.1 Authentication Flow
```
Browser → Google OAuth → Supabase Auth → /auth/callback
    → exchangeCodeForSession → getUser() → Email Allowlist check
    → proxy.ts (mỗi request) → getClaims() → Route protection
```

- **Email Allowlist**: `AUTH_ALLOWED_EMAILS` env var (server-only), phân tách bằng dấu phẩy
- **Public routes**: `/login`, `/auth/callback`, `/api/health/supabase`
- **File chính**: `src/proxy.ts`, `src/features/auth/allowed-emails.ts`
- **KHÔNG dùng** `middleware.ts` — Next.js 16 dùng `proxy.ts`

### 4.2 Permission System (3 lớp bảo mật)

**Lớp 1 — UI**: Ẩn menu/nút theo permission (navigation.ts)
**Lớp 2 — Server Action**: Kiểm tra permission trước khi gọi RPC
**Lớp 3 — Database**: RLS + `has_permission()` + Security Definer functions

```typescript
// Server-side permission check pattern
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

const result = await getCachedDatabasePermissions();
if (!result.ok || !result.permissions.includes("students.view")) {
  return { error: "PERMISSION_DENIED" };
}
```

### 4.3 Supabase Client Pattern

**Server Client** (`src/lib/supabase/server.ts`): Tạo mới per-request, dùng trong Server Components & Server Actions
**Browser Client** (`src/lib/supabase/client.ts`): Singleton, dùng trong Client Components

```typescript
// Server — ĐÚNG
const supabase = await createSupabaseServerClient();

// Browser — ĐÚNG
const supabase = createSupabaseBrowserClient();
```

### 4.4 Server Action Pattern

Mọi mutation đều đi qua Server Action → RPC (không ghi trực tiếp từ browser):

```
Client Component (form submit)
  → Server Action (src/features/xxx/actions/xxx-actions.ts)
    → Permission check
    → Zod validation
    → supabase.rpc("rpc_function_name", params)
    → revalidatePath()
    → Return ActionResult
```

### 4.5 Data Flow Pattern

```
Page (Server Component)
  → createSupabaseServerClient()
  → Permission check
  → supabase.from("table").select() hoặc supabase.rpc()
  → Pass data as props to Client Component
```

---

## 5. FEATURE MODULES — CHI TIẾT TỪNG MODULE

### 5.1 Auth (`src/features/auth/`) — 11 files

| File | Chức năng |
|---|---|
| `allowed-emails.ts` | Email allowlist config từ env |
| `auth-actions.ts` | signOut server action |
| `auth-redirect.ts` | Safe redirect URL validation |
| `current-user.ts` | Get current user profile + permissions |
| `types.ts` | AuthErrorCode type |
| `components/google-sign-in-button.tsx` | OAuth button |
| `components/login-error-display.tsx` | Error messages |
| `components/login-screen.tsx` | Full login page |
| `components/sign-out-button.tsx` | Sign out UI |
| `components/topbar-user-display.tsx` | Avatar + name |
| `components/user-menu.tsx` | Dropdown menu |

### 5.2 Students (`src/features/students/`) — ~65 files (module lớn nhất)

**Listing**: `student-table.tsx`, `student-filters.tsx`, `student-table-columns.tsx`
**Detail Page**: `detail/student-detail-page.tsx` với 6 tabs:
  - `detail/tabs/overview/` — Tổng quan
  - `detail/tabs/attendance/` — Điểm danh
  - `detail/tabs/results/` — Kết quả
  - `detail/tabs/finance/` — Học phí/Số buổi (kết nối ledger thật)
  - `detail/tabs/coaching/` — Coaching
  - `detail/tabs/audit/` — Audit log

**Form**: Multi-step enrollment form với:
  - `form/student-basic-info-section.tsx`
  - `form/guardian-info-section.tsx`
  - `form/acquisition-info-section.tsx`
  - `form/duplicate-check.ts` — Dò trùng phụ huynh/học viên

**Enrollment**: `enrollment/student-enrollment-management.tsx`, `student-enrollment-actions.ts`

**Actions**: `actions/student-actions.ts` — CRUD qua RPC

### 5.3 Classes (`src/features/classes/`) — 19 files

**Pages**: List → Detail → Edit → New + Academic Years management
**Actions**:
  - `actions/class-actions.ts` — createClass, updateClass, changeClassStatus
  - `actions/academic-year-actions.ts` — create, activate, changeStatus
  - `actions/class-schedule-actions.ts` — create, replace, end schedule

**Schedule Management**: `management/class-schedule-create-form.tsx`, `class-schedule-replace-dialog.tsx`

### 5.4 Sessions (`src/features/sessions/`) — 25 files

**Lifecycle**: scheduled → in_progress → completed → locked
**Actions**:
  - `actions/session-lifecycle-actions.ts` — create, start, complete, cancel
  - `actions/session-attendance-actions.ts` — mark attendance
  - `actions/session-result-actions.ts` — record/update results, lock session

**UI Components**:
  - `session-attendance-management.tsx` — Điểm danh
  - `session-result-entry.tsx` — Nhập điểm
  - `session-lock-panel.tsx` — Khóa buổi (tích hợp trừ buổi tự động)
  - `session-reversal-panel.tsx` — Hoàn buổi đã trừ

### 5.5 CRM (`src/features/crm/`) — 11 files

**Table**: `components/crm-table.tsx` — Danh sách lead
**Actions**: `actions/crm-actions.ts`:
  - `createCrmCaseAction` — Tạo lead + auto round-robin
  - `transferCrmCaseLeadAction` — Chuyển giao lead
  - `bookCrmTrialSessionAction` — Đặt học thử
  - `convertCrmCaseAction` — Chuyển lead → học viên chính thức (10 tiêu chí checklist)

**Dialogs**:
  - `crm-trial-booking-dialog.tsx`
  - `crm-lead-transfer-dialog.tsx`
  - `crm-convert-dialog.tsx`

### 5.6 Finance (`src/features/finance/`) — 7 files

**Actions**: `actions/finance-actions.ts`:
  - `createPaymentRequestAction` — Tạo yêu cầu nạp tiền + mã chuyển khoản
  - `processRefundAction` — Xử lý hoàn phí

**Components**:
  - `create-payment-request-dialog.tsx`
  - `process-refund-dialog.tsx`

**Pages**: Finance overview, SePay transactions, Session ledger

### 5.7 Staff (`src/features/staff/`) — 6 files

**Read-only**: Staff directory + Role management
**Actions**: `role-actions.ts` — assignRole, revokeRole (qua RPC)
**Components**: `staff-role-management.tsx`

### 5.8 Dashboard (`src/features/dashboard/`) — 2 files

**Mock data**: `dashboard-page.tsx`, `mock-data.ts`
*(Chưa kết nối dữ liệu thật)*

---

## 6. APP ROUTES

| Route | Page File | Permission | Trạng thái |
|---|---|---|---|
| `/` | `app/page.tsx` | `app.access` | ✅ Live |
| `/login` | `app/login/page.tsx` | Public | ✅ Live |
| `/auth/callback` | `app/auth/callback/route.ts` | Public | ✅ Live |
| `/api/health/supabase` | `app/api/health/supabase/route.ts` | Public | ✅ Live |
| `/api/webhooks/sepay` | `app/api/webhooks/sepay/route.ts` | Webhook | ✅ Live |
| `/students` | `app/students/page.tsx` | `students.view` | ✅ Live |
| `/students/new` | `app/students/new/page.tsx` | `students.create` | ✅ Live |
| `/students/[studentId]` | `app/students/[studentId]/page.tsx` | `students.view` | ✅ Live |
| `/students/[studentId]/edit` | `app/students/[studentId]/edit/page.tsx` | `students.update` | ✅ Live |
| `/classes` | `app/classes/page.tsx` | `classes.view` | ✅ Live |
| `/classes/new` | `app/classes/new/page.tsx` | `classes.create` | ✅ Live |
| `/classes/[classId]` | `app/classes/[classId]/page.tsx` | `classes.view` | ✅ Live |
| `/classes/[classId]/edit` | `app/classes/[classId]/edit/page.tsx` | `classes.create` | ✅ Live |
| `/classes/academic-years` | `app/classes/academic-years/page.tsx` | `classes.view` | ✅ Live |
| `/sessions` | `app/sessions/page.tsx` | `sessions.view` | ✅ Live |
| `/sessions/new` | `app/sessions/new/page.tsx` | `sessions.manage` | ✅ Live |
| `/sessions/[sessionId]` | `app/sessions/[sessionId]/page.tsx` | `sessions.view` | ✅ Live |
| `/crm` | `app/crm/page.tsx` | `crm.view` | ✅ Live |
| `/crm/new` | `app/crm/new/page.tsx` | `crm.update` | ✅ Live |
| `/crm/[caseId]` | `app/crm/[caseId]/page.tsx` | `crm.view` | ✅ Live |
| `/finance` | `app/finance/page.tsx` | `finance.view` | ✅ Live |
| `/finance/sepay` | `app/finance/sepay/page.tsx` | `sepay.view` | ✅ Live |
| `/finance/session-ledger` | `app/finance/session-ledger/page.tsx` | `session_ledger.view` | ✅ Live |
| `/staff` | `app/staff/page.tsx` | `staff.view` | ✅ Live |
| `/timekeeping` | — | — | ❌ Chưa có |
| `/payroll` | — | — | ❌ Chưa có |
| `/commissions` | — | — | ❌ Chưa có |
| `/coaching` | — | — | ❌ Chưa có |
| `/reports` | — | — | ❌ Chưa có |

---

## 7. DATABASE SCHEMA — 22 MIGRATIONS

### 7.1 Danh sách migration theo thứ tự

| # | Filename | Kích thước | Mô tả |
|---|---|---|---|
| 1 | `20260722082513_identity_rbac_foundation.sql` | 20KB | profiles, roles, permissions, assignments, audit_logs |
| 2 | `20260722113559_role_assignment_management.sql` | 9KB | assign_user_role(), revoke_user_role_assignment() RPCs |
| 3 | `20260722130437_student_guardian_foundation.sql` | 16KB | students, guardians, student_guardians + audit |
| 4 | `20260722133125_class_schedule_foundation.sql` | 18KB | academic_years, classes, class_schedule_templates, student_enrollments |
| 5 | `20260723084300_student_enrollment_foundation.sql` | 14KB | Enrollment schema refinement |
| 6 | `20260723085911_student_enrollment_workflows.sql` | 15KB | create/update/transfer enrollment RPCs |
| 7 | `20260723155910_student_guardian_write_workflows.sql` | 25KB | create_student_with_guardian(), update_student(), find_student_form_duplicates() |
| 8 | `20260723180746_fix_student_duplicate_lookup_ambiguity.sql` | 2KB | Fix parameter ambiguity in duplicate lookup |
| 9 | `20260724150000_class_year_write_workflows.sql` | 29KB | create/activate/change academic year, create/update/change class RPCs |
| 10 | `20260724163000_class_schedule_write_workflows.sql` | 18KB | create/replace/end schedule template RPCs |
| 11 | `20260725034500_session_attendance_permissions.sql` | 5KB | sessions.*, attendance.*, results.* permissions seed |
| 12 | `20260725050000_session_attendance_schema_foundation.sql` | 40KB | class_sessions, session_attendance, session_results tables |
| 13 | `20260725120000_session_lifecycle_workflows.sql` | 16KB | create/start/complete/cancel session RPCs |
| 14 | `20260725133000_session_attendance_workflows.sql` | 12KB | mark_session_attendance(), add_additional_student() RPCs |
| 15 | `20260725150000_session_result_lock_workflows.sql` | 15KB | record/update result, lock_class_session RPCs |
| 16 | `20260726121832_session_ledger_foundation.sql` | 17KB | student_session_ledger_entries + 3 views |
| 17 | `20260726145700_session_lock_charge_reversal.sql` | 8KB | Upgraded lock (auto -1 charge) + reverse_session_charge() |
| 18 | `20260726151000_crm_foundation.sql` | 10KB | crm_lead_sources, crm_cases, trial_bookings, enrollment_checklists |
| 19 | `20260726153000_crm_workflows.sql` | 15KB | create_crm_case(), transfer, book_trial, convert_to_official RPCs |
| 20 | `20260726160000_finance_sepay_foundation.sql` | 13KB | fee_policies, sepay_webhooks, payment_requests, transactions, credit_lots |
| 21 | `20260726163000_finance_sepay_workflows.sql` | 17KB | create_payment_request(), process_sepay_webhook(), allocate, refund RPCs |
| 22 | *(tổng ~310KB SQL)* | | |

### 7.2 Bảng dữ liệu (Tables)

| Module | Tables |
|---|---|
| Identity/RBAC | `profiles`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `audit_logs` |
| Students | `students`, `guardians`, `student_guardians` |
| Classes | `academic_years`, `classes`, `class_schedule_templates`, `student_enrollments` |
| Sessions | `class_sessions`, `session_attendance`, `session_results` |
| Session Ledger | `student_session_ledger_entries` |
| CRM | `crm_lead_sources`, `crm_cases`, `crm_lead_assignment_history`, `crm_trial_bookings`, `student_enrollment_checklists` |
| Finance | `finance_fee_policies`, `sepay_webhooks`, `student_payment_requests`, `sepay_transactions`, `student_credit_lots`, `payment_split_allocations`, `finance_cashflow_records` |

### 7.3 Views

| View | Mô tả |
|---|---|
| `student_session_ledger_running_balances` | Số dư running qua window function |
| `student_session_balances` | Tổng hợp số dư per-student |
| `student_session_balance_alerts` | Cảnh báo hết buổi / âm buổi |

### 7.4 RPC Functions chính

| Function | Module | Mô tả |
|---|---|---|
| `has_permission(text)` | RBAC | Kiểm tra 1 permission |
| `get_my_permissions()` | RBAC | Lấy tất cả permission của user hiện tại |
| `assign_user_role()` | RBAC | Gán role cho user |
| `revoke_user_role_assignment()` | RBAC | Thu hồi role |
| `create_student_with_guardian()` | Students | Tạo học viên + phụ huynh atomically |
| `update_student_profile()` | Students | Cập nhật hồ sơ |
| `find_student_form_duplicates()` | Students | Dò trùng theo SĐT + tên |
| `create_academic_year()` | Classes | Tạo năm học draft |
| `activate_academic_year()` | Classes | Kích hoạt năm học |
| `create_class()` | Classes | Tạo lớp |
| `update_class()` | Classes | Cập nhật lớp |
| `change_class_status()` | Classes | Chuyển trạng thái lớp |
| `create_class_schedule_template()` | Schedule | Tạo lịch cố định |
| `replace_class_schedule_template()` | Schedule | Thay lịch |
| `end_class_schedule_template()` | Schedule | Kết thúc lịch |
| `create_class_session()` | Sessions | Tạo buổi học |
| `start_class_session()` | Sessions | Bắt đầu buổi |
| `complete_class_session()` | Sessions | Hoàn thành buổi |
| `cancel_class_session()` | Sessions | Hủy buổi |
| `mark_session_attendance()` | Attendance | Điểm danh |
| `add_additional_student_to_session()` | Attendance | Thêm HS học bổ sung |
| `record_session_result()` | Results | Nhập điểm |
| `update_session_result()` | Results | Sửa điểm |
| `lock_class_session()` | Sessions | Khóa buổi + auto trừ buổi |
| `reverse_session_charge()` | Ledger | Hoàn buổi đã trừ |
| `create_crm_case()` | CRM | Tạo lead + auto round-robin |
| `transfer_crm_case_lead()` | CRM | Chuyển giao lead |
| `book_crm_trial_session()` | CRM | Đặt học thử |
| `convert_crm_case_to_official_student()` | CRM | Chuyển lead → HV chính thức |
| `create_payment_request()` | Finance | Tạo yêu cầu nạp tiền |
| `process_sepay_webhook()` | Finance | Xử lý webhook SePay |
| `allocate_sepay_transaction()` | Finance | Phân bổ giao dịch |
| `process_refund()` | Finance | Hoàn phí |

---

## 8. PERMISSION CODES ĐÃ ĐĂNG KÝ

```typescript
const DATABASE_PERMISSION_CODES = [
  // App
  "app.access",
  // Classes
  "classes.view", "classes.create", "classes.manage_schedule",
  // Students
  "guardians.view",
  "students.view", "students.create", "students.update",
  "students.manage_status", "students.reserve", "students.transfer_class",
  "students.confirm_official",
  // Sessions
  "sessions.view", "sessions.manage", "sessions.lock",
  "attendance.view", "attendance.mark",
  "results.view", "results.manage",
  // Session Ledger
  "session_ledger.view", "session_ledger.reverse",
  // CRM
  "crm.view", "crm.update", "crm.transfer",
  // Finance
  "finance.view", "payments.manage",
  "sepay.view", "sepay.webhook_manage", "sepay.accountant_confirm",
  "refunds.manage", "cashflow.view",
  // Staff & Audit
  "coaching.view", "audit.view",
  "staff.view", "staff.roles.view", "staff.roles.manage",
] as const;
```

### Roles hệ thống

| Code | Tên | Ghi chú |
|---|---|---|
| `owner` | Chủ trung tâm | Nhận TẤT CẢ permissions |
| `accountant` | Kế toán | + sepay.accountant_confirm |
| `operations_manager` | Quản lý vận hành | + session/attendance/result/ledger |
| `assistant_manager` | Quản lý trợ lý | + session/attendance/result/ledger |
| `teaching_assistant` | Trợ giảng | + attendance.mark, results.manage |
| `admissions_specialist` | Chuyên viên tuyển sinh | + crm.* |
| `admissions_leader` | Trưởng nhóm tuyển sinh | + crm.* |
| `admissions_manager` | Quản lý tuyển sinh | + crm.* |
| `collaborator` | Cộng tác viên | app.access only |

---

## 9. QUY TẮC BẤT BIẾN

> **CRITICAL**: Đọc kỹ và tuân thủ 100%.

### 9.1 Database
1. **Migration đã apply là BẤT BIẾN** — KHÔNG SỬA file migration cũ. Mọi thay đổi phải là migration MỚI.
2. **Audit log là APPEND-ONLY** — Không UPDATE/DELETE.
3. **Ledger entry là APPEND-ONLY** — Sửa bằng entry đảo ngược, không sửa entry cũ.
4. **Tiền lưu bằng `bigint` VND** — Không dùng float.
5. **Số buổi lưu bằng `integer`** — Không dùng decimal.
6. **Không hard DELETE dữ liệu nghiệp vụ** — Dùng soft-delete/status.

### 9.2 Security
1. **3 lớp permission**: UI → Server Action → RLS/RPC. Ẩn nút ≠ bảo mật.
2. **Browser KHÔNG ghi trực tiếp** cho nghiệp vụ multi-table — Phải qua Server Action → RPC.
3. **KHÔNG dùng service-role key trên browser**.
4. **KHÔNG đặt secret trong `NEXT_PUBLIC_*`**.

### 9.3 Code
1. **KHÔNG dùng `middleware.ts`** — Next.js 16 dùng `src/proxy.ts`.
2. **Khi nghiệp vụ chưa rõ, ghi `OPEN_DECISION`** — Không tự đoán.
3. **Mỗi permission mới phải**: Thêm migration seed + cập nhật `src/lib/permissions/types.ts`.
4. **TypeScript strict** — Không có `any` không giải thích.

---

## 10. SHARED COMPONENTS & UI

### Layout Components (`src/components/layout/`)
- `app-shell.tsx` — Main layout wrapper
- `sidebar.tsx` — Navigation sidebar (permission-aware)
- `topbar.tsx` — Top bar với user menu

### Shared Components (`src/components/shared/`)
- `page-header.tsx` — Page title + breadcrumb
- `data-table.tsx` — Generic data table
- `empty-state.tsx` — Empty state placeholder
- `loading-skeleton.tsx` — Loading state
- `permission-denied.tsx` — 403 page
- `status-badge.tsx` — Status badge variants

### UI Primitives (`src/components/ui/`)
- `button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`
- `dialog.tsx`, `dropdown-menu.tsx`
- `card.tsx`, `badge.tsx`, `separator.tsx`
- `form.tsx` — React Hook Form integration
- `table.tsx` — Table primitives

### Lib Utilities (`src/lib/`)
- `supabase/server.ts` — Server client factory
- `supabase/client.ts` — Browser client singleton
- `supabase/middleware.ts` — Session update for proxy
- `permissions/database-permissions.ts` — Permission resolver
- `permissions/types.ts` — Permission code types
- `env.ts` — Environment validation
- `formatting/` — Date, currency, phone formatters
- `validation/` — Shared validation utilities

---

## 11. BIẾN MÔI TRƯỜNG

```bash
# .env.local (KHÔNG commit)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
AUTH_ALLOWED_EMAILS=[ALLOWED_EMAIL_1],[ALLOWED_EMAIL_2]
```

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Public key (fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `AUTH_ALLOWED_EMAILS` — Server-only email allowlist

---

## 12. GIT STATE

### Branches
```
* main (HEAD) → f2a6ea1
  feat/task-4-student-class-foundation (merged)
  feat/task-5-4-session-ui (merged)
  feat/task-5-5-session-ledger (merged)
  feat/task-5-session-attendance-foundation (merged)
  feat/task-5-session-workflows (merged)
  feat/task-6-crm-trial-checklist (merged)
  feat/task-7-finance-sepay (merged)
```

### Commit History (gần nhất)
```
f2a6ea1 feat: add Finance management UI, SePay transactions log, session ledger
270b18e feat: add SePay Webhook route handler
7e731cc feat: add Finance RPC workflows
269a361 feat: add Finance foundation schema
5c4dfa4 feat: add CRM lead directory, trial booking, conversion checklist UI
57ab8f7 feat: add CRM RPC workflows
d7bc62e feat: add CRM foundation migration, RLS
f46d658 feat: connect student detail to real session ledger views
4e1879b feat: add transactional session lock-and-charge and reversal
921a07f feat: add session ledger foundation migration
9e70305 feat: add session result and locking UI
0274a7e feat: add session attendance management UI
e8e4275 feat: add session lifecycle management UI
864ec1c feat: add read-only session management UI
8268b41 feat: add session result and lock workflows
e6045ac feat: add session attendance workflows
```

---

## 13. NGHIỆP VỤ QUAN TRỌNG ĐÃ TRIỂN KHAI

### 13.1 Session Lock + Auto Charge
Khi khóa buổi học (`lock_class_session`):
1. Kiểm tra session `status = 'completed'`
2. Lock session (set `locked_at`, `locked_by`, `lock_reason`)
3. **Tự động chèn `-1 session_charge`** cho tất cả HS có `attendance_status IN ('present', 'excused_absence', 'unexcused_absence')`
4. HS `additional_study` KHÔNG bị trừ buổi
5. Idempotent: lock lại cùng session → lỗi `ALREADY_LOCKED`

### 13.2 Session Reversal
`reverse_session_charge(p_session_attendance_id, p_reason)`:
- Tạo entry `session_reversal` (+1 buổi)
- Chỉ hoàn 1 lần per charge (unique constraint trên `reverses_entry_id`)

### 13.3 Session Ledger
- **Append-only**: Không UPDATE/DELETE
- **Entry types**: `payment_credit`, `bonus_credit`, `session_charge`, `session_reversal`, `manual_adjustment`, `transfer_out`, `transfer_in`, `refund_debit`, `annual_carryover`
- **Views tự động tính**: running balance, tổng hợp per-student, cảnh báo hết buổi/âm buổi

### 13.4 CRM → Học viên chính thức
Quy trình chuyển đổi:
1. Tạo lead (auto round-robin phân công Sale)
2. Đặt học thử (trial booking)
3. Hoàn thành 10 tiêu chí checklist
4. `convert_crm_case_to_official_student`:
   - Kiểm tra 10/10 checklist items = true
   - Tạo `students` record (mã `HV-YYMMDD-xxxx`)
   - Link guardian
   - Tạo active enrollment trong class
   - Cập nhật CRM case `status = 'converted'`

### 13.5 SePay Webhook
- **Idempotent**: `sepay_id` unique constraint → webhook trùng bị reject
- **Route**: `POST /api/webhooks/sepay` → parse body → `process_sepay_webhook` RPC
- **Flow**: Webhook → sepay_webhooks table → sepay_transactions → match payment_request → allocate → credit_lots → ledger entries

### 13.6 Payment Split (Multi-child)
- Một giao dịch có thể chia cho nhiều con
- `payment_split_allocations` lưu: allocated_amount, sessions, bonus, unit_price per child
- Mỗi allocation tạo `student_credit_lots` entry + ledger `payment_credit`

---

## 14. NAVIGATION CONFIG

```typescript
// src/config/navigation.ts — Sections hiện tại:
// ✅ = available: true, ❌ = available: false

// Học vụ
✅ Tổng quan (/)                    → app.access
✅ Học viên (/students)             → students.view
✅ Lớp học & Lịch học (/classes)    → classes.view
✅ Buổi học (/sessions)             → sessions.view
❌ Điểm danh (/attendance)
❌ Kết quả học tập (/learning-results)

// Tài chính
✅ Học phí & Công nợ (/finance)     → finance.view
✅ Giao dịch SePay (/finance/sepay) → sepay.view
✅ Sổ cái số buổi (/finance/session-ledger) → session_ledger.view

// Tuyển sinh & CRM
✅ CRM & Tuyển sinh (/crm)         → crm.view

// Nhân sự
✅ Nhân sự (/staff)                 → staff.view
❌ Chấm công (/timekeeping)
❌ Lương & Tạm ứng (/payroll)
❌ Hoa hồng (/commissions)

// Khác
❌ Coaching (/coaching)
❌ Báo cáo & Dashboard (/reports)
❌ Thông báo (/notifications)
❌ Cài đặt hệ thống (/settings)
```

---

## 15. TASK 8 — NHÂN SỰ / CHẤM CÔNG / LƯƠNG / HOA HỒNG (CHƯA BẮT ĐẦU)

Xem thiết kế chi tiết tại `docs/IMPLEMENTATION_FOUNDATION.md` Section 4 (Route map → Nhân sự) và Section 5 (Domain model → Time Entry, Payroll, Coaching).

### Phạm vi dự kiến
1. **Staff profiles mở rộng**: Hồ sơ nhân sự chi tiết, rate versions
2. **Work shifts/schedules**: Ca làm việc, lịch trình
3. **Timekeeping**: Check-in/out online/offline, GPS/Wi-Fi evidence, auto end 23:30
4. **Adjustment requests**: Yêu cầu điều chỉnh công
5. **Payroll**: Draft → review → approve, các thành phần lương
6. **Advances**: Tạm ứng lương
7. **Grading credits**: Tín chỉ chấm bài
8. **Sale commission**: Hoa hồng Sale (MMA/Sandbox)

### Permissions cần thêm (tham khảo)
```
staff.manage, staff.manage_rates,
timekeeping.view, timekeeping.check, timekeeping.approve_adjustment,
payroll.view, payroll.manage, payroll.accountant_reconcile, payroll.owner_approve,
advances.request, advances.review, advances.owner_approve,
commissions.view, commissions.manage, commissions.owner_adjust
```

### Business rules quan trọng
- Online rate = 50% offline rate (theo version)
- Điều chỉnh công không ghi đè lịch sử
- Một bài chỉ có một grader
- Advance trừ vào payroll
- Payroll duyệt xong không sửa trực tiếp
- Nhân sự chỉ xem thu nhập của mình

---

## 16. PREFLIGHT CHECKLIST CHO AGENT MỚI

Trước khi bắt đầu code, chạy các lệnh sau để xác nhận trạng thái:

```bash
# 1. Kiểm tra nhánh và commit
git log --oneline -5
# Expect: HEAD = f2a6ea1 on main

# 2. Kiểm tra working tree sạch
git status
# Expect: nothing to commit, working tree clean

# 3. Kiểm tra dependencies
npm ls --depth=0 2>&1 | tail -5

# 4. Kiểm tra TypeScript
npm run typecheck
# Expect: exit 0

# 5. Kiểm tra ESLint
npm run lint
# Expect: exit 0

# 6. Kiểm tra build
npm run build
# Expect: exit 0

# 7. Kiểm tra Supabase CLI
npx supabase migration list --linked 2>&1 | tail -5
# Expect: 22 migrations, tất cả Applied
```

### Bắt đầu Task 8

```bash
# Tạo nhánh mới
git checkout -b feat/task-8-staff-payroll

# Tạo migration mới
npm run supabase:migration:new -- staff_timekeeping_foundation

# Sau khi viết SQL migration
npm run supabase:db:push   # Push lên Cloud
npm run supabase:types     # Regenerate TypeScript types
npm run typecheck           # Verify types
```

---

## 17. QUY TRÌNH LÀM VIỆC

Mỗi task phải:

1. **Nêu phạm vi** — Files sẽ tạo/sửa
2. **Viết migration trước** — Schema → RPC → RLS → Permissions seed
3. **Push migration** — `npm run supabase:db:push`
4. **Gen types** — `npm run supabase:types`
5. **Viết Server Actions** — Theo pattern trong `src/features/*/actions/`
6. **Viết UI** — Theo pattern component hiện có
7. **Cập nhật navigation** — `src/config/navigation.ts` (set `available: true`)
8. **Cập nhật permission types** — `src/lib/permissions/types.ts`
9. **Chạy lint + typecheck** — `npm run lint && npm run typecheck`
10. **Tóm tắt thay đổi**

---

## 18. TÀI LIỆU THAM KHẢO

| Tài liệu | Đường dẫn | Mô tả |
|---|---|---|
| Master Prompt | `docs/CODEX_MASTER_PROMPT.md` | Prompt gốc, stack, quy tắc |
| Implementation Foundation | `docs/IMPLEMENTATION_FOUNDATION.md` | Domain model chi tiết, transactions, acceptance tests |
| Auth Setup | `docs/backend/AUTH_SETUP.md` | Google OAuth, email allowlist |
| Database Conventions | `docs/backend/DATABASE_CONVENTIONS.md` | Quy ước naming, types, security |
| RBAC Model | `docs/backend/RBAC_MODEL.md` | Permission evaluation, seed data |
| Owner Bootstrap | `docs/backend/OWNER_BOOTSTRAP.md` | SQL để bootstrap owner đầu tiên |
| Supabase Setup | `docs/backend/SUPABASE_SETUP.md` | Client/server setup, CLI scripts |
| QA Review Prompt | `docs/ANTIGRAVITY_REVIEW_PROMPT.md` | Checklist review theo vai trò |
