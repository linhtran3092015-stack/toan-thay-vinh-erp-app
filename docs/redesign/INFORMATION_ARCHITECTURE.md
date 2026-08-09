# Information architecture contract

## Navigation principle

The redesigned shell clarifies grouping without changing route URLs or permission codes. Navigation visibility continues to use the current feature permissions; route guards continue to be enforced by the existing route/auth/RBAC implementation.

## Approved hierarchy

| Group | Item | Route | Existing visibility capability |
| --- | --- | --- | --- |
| Tổng quan | Dashboard | `/` | `dashboard.view` |
| Học vụ | Học viên | `/students` | `students.view` |
| Học vụ | Lớp học | `/classes` | `classes.view` |
| Học vụ | Buổi học | `/sessions` | `sessions.view` |
| Học vụ | Kết quả học tập | `/learning-results` | `results.view` |
| Học vụ | Coaching | `/coaching` | `coaching.view` |
| Tuyển sinh | CRM | `/crm` | `crm.view` |
| Tài chính | Finance | `/finance` | `finance.view` |
| Tài chính | Payment requests | `/finance/payment-requests` | `payments.view` |
| Tài chính | SePay | `/finance/sepay` | `sepay.view` |
| Tài chính | Session ledger | `/finance/session-ledger` | `session_ledger.view` |
| Nhân sự | Staff | `/staff` | `staff.view` |
| Nhân sự | Timekeeping | `/timekeeping` | `timekeeping.view` |
| Nhân sự | Payroll | `/payroll` | `payroll.view` |
| Nhân sự | Advances | `/advances` | `advances.view` |
| Nhân sự | Grading credits | `/grading-credits` | `grading_credits.view` |
| Nhân sự | Commissions | `/commissions` | `commissions.view` |
| Quản trị | Imports: students, session balances, classes, enrollments | `/imports/students`, `/imports/session-balances`, `/imports/classes`, `/imports/enrollments` | `imports.students`, `imports.session_balances`, `imports.classes`, `imports.enrollments` |
| Quản trị | Reports | `/reports` | `reports.view` |
| Quản trị | Settings / users / permissions | `/settings`, `/settings/users`, `/settings/permissions` | Current settings entry uses `staff.roles.view`; retain each route's existing guard. |
| Quản trị | Audit logs | `/audit` and `/settings/audit-logs` | `audit.view` |

## Route-owned hierarchy

- `/classes/academic-years` is a contextual class-domain route, not a global application switcher.
- Student detail owns enrollment, transfer, reserve, and resume actions.
- Class detail owns class status and schedule operations.
- Session detail owns attendance, results, and lock operations.
- Attendance remains inside Sessions. No new `/attendance` route is introduced; the currently unavailable navigation entry is not revived as a new information architecture destination.

## Global utilities

- Notifications remain a top-bar utility and retain their current route/data behavior.
- The current decorative/fake search and calendar affordances are removed from the redesigned shell unless separately approved as real features. This program does not add global search or calendar behavior.
- The hard-coded global academic-year label is removed from the shell. Academic-year context appears only where the current route/read model provides trustworthy, feature-owned data.

## Page hierarchy conventions

- A page title and primary page action area may clarify an existing page’s purpose; they must not alter action availability.
- Breadcrumbs are used only where they clarify real route ancestry (for example a detail/edit route), not as duplicate navigation.
- Table/list filters use URL-backed client view state while preserving current full-directory reads, client filtering, and pagination semantics.
- Responsive navigation changes presentation only; it must preserve navigation visibility and route access parity.

## Information architecture non-goals

- No route renames, redirects, permission-code changes, or new global filtering semantics.
- No claims that an academic-year selection affects every module.
- No new attendance, search, calendar, or notification workflow.
