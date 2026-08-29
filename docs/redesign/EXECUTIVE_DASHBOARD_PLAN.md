<!-- /autoplan restore point: /Users/linhtran/.gstack/projects/linhtran3092015-stack-toan-thay-vinh-erp-app/main-autoplan-restore-20260829-234259.md -->
# Executive Dashboard Redesign Plan

Date: 2026-08-29
Target route: `/`
Primary audience: chủ trung tâm và quản lý cấp cao có quyền nghiệp vụ tương ứng

## Outcome

Thay trang Tổng quan dạng danh sách card hiện tại bằng dashboard điều hành giúp người có thẩm quyền trả lời nhanh năm câu hỏi: quy mô học sinh, thu và chi trong kỳ, dòng tiền ròng, tình hình tuyển sinh, và vấn đề cần xử lý ngay.

Dashboard chỉ hiển thị dữ liệu thật mà session hiện tại được phép đọc. Không suy luận quyền từ tên role, không bypass RLS, không dùng service role trong ứng dụng và không tạo số liệu minh họa.

## Confirmed business definitions

- Doanh thu trên dashboard là tổng `receipt` đã ghi nhận trong `finance_cashflow_records` theo thời điểm ghi nhận.
- Chi phí là tổng `disbursement` đã ghi nhận trong cùng kỳ.
- Dòng tiền ròng là `receipt - disbursement - refund`; không gọi là lợi nhuận kế toán.
- Công nợ là phần còn thiếu của yêu cầu thanh toán gắn với khoản thu học phí còn hiệu lực; aging dùng `tuition_collection_periods.due_on` khi có.
- Pipeline tuyển sinh dùng trạng thái CRM thật: `interested`, `trial_booked`, `trial_completed`, `pending_enrollment_confirmation`, `converted`; `dropped` được trình bày riêng và không nằm trong conversion denominator cuối cùng.
- Tổng học sinh dùng `students`; phân loại chính dùng lifecycle hiện có. Không tái dựng snapshot lịch sử khi database không có lịch sử trạng thái đáng tin cậy.
- Quỹ lương dùng Payroll Engine và kỳ hiện tại qua read contract owner dashboard hiện có; chỉ người có `payroll.dashboard.view` được xem số tiền.

## What already exists

| Need | Existing source | Decision |
| --- | --- | --- |
| Route guard | `src/app/(app)/page.tsx` + `getCachedDatabasePermissions()` | Reuse exact permission guard |
| Current dashboard composition | `src/features/dashboard/data.ts` | Replace list-reader aggregation with period-aware domain summaries |
| Shared states | `LoadingState`, `EmptyState`, `ErrorState`, `PermissionDeniedState` | Reuse visual language; add dashboard-shaped skeleton locally |
| Finance source | `finance_cashflow_records`, `student_payment_requests`, `tuition_collection_*` | Aggregate in database for selected month |
| Admissions source | `crm_cases` | Aggregate by real pipeline status in database |
| Academic source | `students`, `classes`, `class_sessions`, `session_results` | Aggregate counts in database |
| Payroll source | `get_owner_payroll_dashboard(date,text)` | Reuse only when `payroll.dashboard.view` is present |
| Chart pattern | Payroll dashboard SVG/CSS charts | Reuse accessible SVG/CSS approach; no new chart dependency |
| Shell/navigation | `AppShell`, `Sidebar`, `navigationDomains` | Preserve routes and permission visibility |

## Data architecture

Use a small set of database aggregation functions, separated by permission boundary so one failed domain does not blank the page.

```text
URL month=YYYY-MM
       |
       v
Next.js server route
  |-- permissions + authenticated user
  |-- finance summary RPC -------- finance/cashflow/tuition permission
  |-- admissions summary RPC ----- crm.view
  |-- operations summary RPC ----- students/classes/sessions/results/staff permissions
  `-- payroll dashboard RPC ------- payroll.dashboard.view
       |
       v
Promise.allSettled + schema validation
       |
       v
Role-aware read model
       |
       v
Header -> KPI -> trends -> domain analysis -> attention queue
```

Each database function:

- accepts a normalized first day of month;
- validates authentication and exact permissions;
- aggregates server-side and returns bounded JSON;
- returns only fields permitted for the caller;
- uses current schema/RLS contracts and never exposes raw financial or payroll rows;
- keeps unknown stored statuses out of known buckets.

## Dashboard hierarchy

1. Header with greeting, data timestamp and real month selector.
2. Five top metrics, permission-aware: total students, receipts, disbursements, net cashflow, receivables. Financial metrics disappear together when finance permission is absent.
3. Revenue/cost monthly trend and revenue composition.
4. Admissions funnel, student lifecycle, receivable aging, and top grades/classes by collected revenue when the join is trustworthy.
5. Payroll summary and operational highlights.
6. Attention queue built only from real pending/overdue/error states.

Desktop uses a 12-column grid. Tablet uses two columns. Mobile uses one column without horizontal page scrolling. Charts keep readable labels and expose equivalent text/accessible names.

## Permission model

| Data | Required permission |
| --- | --- |
| Enter dashboard | `dashboard.view` |
| Student totals/status | `students.view` |
| Admissions funnel | `crm.view` |
| Revenue/cost/net cashflow | `finance.view` or `cashflow.view` according to existing policy |
| Receivables | `finance.view` plus tuition visibility required by the database contract |
| Classes/sessions/results | Corresponding `classes.view`, `sessions.view`, `results.view` |
| Staff count | `staff.view` |
| Payroll amount/trend | `payroll.dashboard.view` |
| Timekeeping adjustment alert | `timekeeping.approve_adjustment` |

The UI treats permission as presentation input only. Database functions remain the final authority.

## States

- Loading: dashboard-shaped skeleton preserving final layout.
- Empty: per-section Vietnamese message for the selected month.
- Error: per-domain error panel while other domains remain usable.
- Hidden: no placeholder that leaks the existence or value of restricted data.
- Unknown stored status: excluded from known lifecycle buckets and surfaced only as an integrity note when safe.

## Performance budget

- Independent domain reads start together.
- No browser-side aggregation of raw business rows.
- No N+1 query by class, student, staff or month.
- Twelve monthly points maximum for finance charts; top-five lists are bounded in SQL.
- No new JavaScript chart package; charts are server-rendered SVG/CSS with minimal client code limited to URL navigation controls.

## Test plan

- Database contract tests for authentication, permission denial, valid month, zero data, known/unknown status handling, finance formulas, receivable aging, and payroll isolation.
- Unit/data tests for month normalization, schema validation, per-domain error isolation and permission-aware query execution.
- Component tests for finance-visible owner, non-finance staff, complete data, partial error, empty month, attention empty state and accessible chart labels.
- Route tests for invalid month fallback and user greeting.
- Browser QA at mobile, tablet and desktop widths; switch month; confirm no console/hydration errors.
- Read-only data verification for July 2026: students, staff, receipts, disbursements and payroll total compared directly with database queries.

## Planned files

- `supabase/migrations/*_executive_dashboard_read_models.sql`
- `supabase/tests/executive-dashboard.test.sql`
- `src/features/dashboard/read-models.ts`
- `src/features/dashboard/data.ts`
- `src/features/dashboard/dashboard-page.tsx`
- `src/app/(app)/page.tsx`
- `src/app/globals.css`
- existing dashboard unit/component test files as needed

## NOT in scope

- Accounting profit, accrual accounting or a general ledger redesign.
- A new student-risk scoring model.
- Historical student snapshots invented from current state.
- Export report workflow unless a safe existing export can be linked without new business logic.
- Navigation route changes or refactors to finance, payroll, admissions, HR or academic write workflows.
- Installing a chart library.

## Known verification blocker

The linked Supabase hostname currently fails DNS resolution from this environment. Schema and migrations are locally verifiable, but production data totals cannot be signed off until the read-only connection succeeds. The dashboard must not be declared data-verified while this remains unresolved.
