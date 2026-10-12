# Information architecture contract

## Navigation principle

The redesigned shell clarifies grouping without changing route URLs or permission codes. Navigation visibility continues to use the current feature permissions; route guards continue to be enforced by the existing route/auth/RBAC implementation.

## Approved hierarchy

Source of truth: `navigationGroups` in `src/config/navigation.ts` (Stumana redesign, v0.7.0.0). The sidebar shows three groups; a group, title included, disappears when none of its domains is visible to the viewer. Routes and permission codes are unchanged from the earlier six-domain layout; grouping and labels moved, and the existing `/notifications` route (already reachable from the top-bar bell) gained a sidebar entry under Cài đặt.

| Group | Domain | Item | Route | Existing visibility capability |
| --- | --- | --- | --- | --- |
| Việc chính | Hôm nay | Hôm nay | `/` | `dashboard.view` |
| Việc chính | Học sinh | Học sinh | `/students` | `students.view` |
| Việc chính | Lớp học | Lớp học | `/classes` | `classes.view` |
| Việc chính | Buổi học | Buổi học | `/sessions` | `sessions.view` |
| Việc chính | Kết quả học tập | Kết quả học tập | `/learning-results` | `results.view` |
| Vận hành | Tài chính | Học phí & Công nợ | `/finance` | `finance.view` |
| Vận hành | Tài chính | Yêu cầu thanh toán | `/finance/payment-requests` | `payments.view` |
| Vận hành | Tài chính | Giao dịch SePay | `/finance/sepay` | `sepay.view` |
| Vận hành | Tài chính | Đơn hàng | `/finance/orders` | `finance.view` |
| Vận hành | Tài chính | Sổ cái số buổi | `/finance/session-ledger` | `session_ledger.view` |
| Vận hành | Tài chính | Kỳ thu học phí | `/finance/tuition-periods` | `tuition_periods.view` |
| Vận hành | Tài chính | Tài khoản nhận SePay | `/finance/receiving-accounts` | `settings.sepay_receiving_accounts.manage` |
| Vận hành | Nhân sự | Nhân sự | `/staff` | `staff.view` |
| Vận hành | Nhân sự | Chấm công | `/timekeeping` | `timekeeping.view` |
| Vận hành | Nhân sự | Tổng quan lương | `/payroll/dashboard` | `payroll.dashboard.view` |
| Vận hành | Nhân sự | Bảng lương | `/payroll` | `payroll.view` |
| Vận hành | Nhân sự | Tạm ứng lương | `/advances` | `advances.view` |
| Vận hành | Nhân sự | Tín chỉ chấm bài | `/grading-credits` | `grading_credits.view` |
| Vận hành | Nhân sự | Hoa hồng | `/commissions` | `commissions.view` |
| Vận hành | Chăm sóc & Tuyển sinh | CRM | `/crm` | `crm.view` |
| Vận hành | Chăm sóc & Tuyển sinh | Chăm sóc học sinh | `/student-care` | `student_care.view` |
| Vận hành | Chăm sóc & Tuyển sinh | Coaching | `/coaching` | `coaching.view` |
| Vận hành | Chăm sóc & Tuyển sinh | Tin nhắn phụ huynh | `/parent-messages` | `attendance.view` |
| Vận hành | Báo cáo | Báo cáo & Xuất dữ liệu | `/reports` | `reports.view` |
| Footer | Nhập dữ liệu | Import học sinh | `/imports/students` | `imports.students` |
| Footer | Nhập dữ liệu | Import số dư buổi | `/imports/session-balances` | `imports.session_balances` |
| Footer | Nhập dữ liệu | Import lớp & lịch học | `/imports/classes` | `imports.classes` |
| Footer | Nhập dữ liệu | Import ghi danh | `/imports/enrollments` | `imports.enrollments` |
| Footer | Cài đặt | Cài đặt hệ thống (incl. `/settings/users`, `/settings/permissions`) | `/settings` | `staff.roles.view` for the entry; each settings route keeps its existing guard |
| Footer | Cài đặt | Thông báo | `/notifications` | `notifications.view` |
| Footer | Cài đặt | Nhật ký hệ thống | `/audit` (also active on `/settings/audit-logs`) | `audit.view` |

## Route-owned hierarchy

- `/classes/academic-years` is a contextual class-domain route, not a global application switcher.
- Student detail owns enrollment, transfer, reserve, and resume actions.
- Class detail owns class status and schedule operations.
- Session detail owns attendance, results, and lock operations.
- Attendance remains inside Sessions. No new `/attendance` route is introduced; the currently unavailable navigation entry is not revived as a new information architecture destination.

## Global utilities

- Notifications remain a top-bar utility (bell with unread count, capped at 99+) and retain their current route/data behavior; `/notifications` is also listed under Cài đặt in the sidebar footer.
- The current decorative/fake search and calendar affordances are removed from the redesigned shell unless separately approved as real features. This program does not add global search or calendar behavior.
- The hard-coded global academic-year label is removed from the shell. Academic-year context appears only where the current route/read model provides trustworthy, feature-owned data.

## Page hierarchy conventions

- A page title and primary page action area may clarify an existing page’s purpose; they must not alter action availability.
- The top bar shows a real-route breadcrumb on every route that belongs to the navigation: the domain (linked) only when that domain has a module strip, then the current module (`aria-current="page"`), built by `getNavigationBreadcrumb`. Routes outside the navigation show no breadcrumb. Record-level crumbs (a student or class name) belong to the page, not the shell; detail pages may add them.
- Table/list filters use URL-backed client view state while preserving current full-directory reads, client filtering, and pagination semantics.
- Responsive navigation changes presentation only; it must preserve navigation visibility and route access parity.

## Information architecture non-goals

- No route renames, redirects, permission-code changes, or new global filtering semantics.
- No claims that an academic-year selection affects every module.
- No new attendance, search, calendar, or notification workflow.
