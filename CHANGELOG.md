# Changelog

All notable changes to Toan Thay Vinh ERP will be documented in this file.

## [0.4.0.2] - 2026-09-07

### Fixed
- Auto-end stale open time entries across all staff roles (including assistant manager) at the 23:30 VN daily cutoff.
- Update personal timekeeping read model to include any open entries across dates so active attendance is never hidden.
- Automatically clean up historical unclosed time entries.

## [0.4.0.1] - 2026-09-07

### Fixed
- Acknowledge SePay test webhook pings (`id: 0`) immediately with HTTP 200 without attempting database transaction processing.
- Make SePay webhook payload schema resilient by accepting string coercion for `id`, `accountNumber`, and `transferAmount`, defaulting missing transfer amount to 0, mapping credit/debit aliases, and falling back to description when content is absent.
- Support both Vietnam standard timestamp (`YYYY-MM-DD HH:mm:ss`) and ISO 8601 strings with timezone offsets in webhook date parser.
- Return explicit validation failure details in HTTP 400 responses to aid diagnostics from the SePay webhook dashboard.

## [0.4.0.0] - 2026-09-07

### Added
- Configure separate SePay API account identities for new enrollment and renewal in Finance → Receiving accounts, with owner-only changes and an audit trail.
- Preview and import up to 31 days of SePay history from Finance → SePay transactions, with bounded pages, saved progress, retry support, and recent sync logs.
- Reconcile historical receipts explicitly: match a compatible payment request, mark previously accounted, or ignore with a reason. Importing alone never creates tuition credit or cashflow.

### Fixed
- Keep API UUIDs separate from numeric webhook IDs and link duplicate deliveries without recording tuition twice, including delayed webhooks and reference drift.
- Reject history pages outside the selected account/date window or with incomplete totals; preserve retry sessions after connection loss and show configuration-loading failures.
- Attribute historical tuition receipts and downstream payroll/commission source facts to the actual bank transfer date while retaining the operator action time in audit records.

## [0.3.0.7] - 2026-09-04

### Added
- **Owner-Managed Attendance Verification**:
  - Center owners can now configure attendance geofence (coordinates, radius 20–2,000m, max GPS accuracy 20–200m) directly on the Timekeeping page.
  - Configurable Wi-Fi check-in and check-out verification with up to 20 SSID/BSSID pairs.
  - Granular permission `timekeeping.manage_verification` defaulted to owner role with full audit logging.
  - Persist Wi-Fi check-out metadata and align "My Timekeeping" block with Vietnam timezone today filter.

## [0.3.0.6] - 2026-08-31

### Improved
- Keep the authenticated navigation visible and interactive while modules load; show a separate shell placeholder during initial authentication.
- Add navigation feedback and consistent, visible loading messages with responsive skeletons, dark-mode support, and reduced-motion support.
- Load independent timekeeping, notification, and center-name requests concurrently after access checks.

### Fixed
- Restore missing skeleton surface colors and prevent loading placeholders from overflowing narrow mobile screens.
- Keep mobile navigation feedback mounted until navigation commits, and prevent menus from reopening on browser Back.
- Make the Coaching dialog focus-restoration test wait for effect cleanup, avoiding the existing CI timing failure without changing application behavior.

## [0.3.0.3] - 2026-08-28

### Added
- **Staff Payslip Web View & PDF**: Added standalone payslip view at `/payroll/[periodId]/statements/[statementId]/payslip` and printable PDF export with Navy blue brand identity, full breakdown tables, masked bank accounts, and Vietnamese currency words.

## [0.3.0.2] - 2026-08-28

### Fixed
- **Dynamic Payroll Grade Assignment Resolution**: Updated `generate_payroll_calculation_run` and `sync_payroll_order_facts` to resolve staff dynamically from `staff_grade_assignments` as of the order's `event_date` for renewal orders, eliminating false `missing_grade_assignment` blocking issues on recalculations.
- **Operations Lead Source Mapping & Policy**: Added system mapping for `referral_teacher` to `teacher_vinh_zalo_direct_referral` and updated `operations_new_enrollment` policy parameters to include all fixed source bonus codes (`teacher_vinh_zalo_direct_referral`, `self_sourced`), eliminating `missing_source_mapping` blocking issues.
- **Contextual Payroll Issue Presentation**: Enriched `details` payload in `payroll_calculation_issues` and upgraded `PayrollPage` to render key context details (grade, event date, source code, order value, order ID) directly under each issue.

## [0.3.0.1] - 2026-08-28

### Fixed
- **Payroll Statement Current Revision Selection**: Restricted `get_payroll_periods_with_details()` to only return statements matching `period.current_calculation_run_id`, preventing manual line adjustment submissions from referencing stale calculation run statement IDs.
- **Payroll Manual Line Error Messaging**: Added Vietnamese user-facing error mappings for `PAYROLL_MANUAL_LINE_REQUIRES_CURRENT_OPEN_DRAFT` and `PAYROLL_MANUAL_LINE_SELF_CHANGE_FORBIDDEN`.

## [0.3.0.0] - 2026-08-28

### Added
- **Owner Payroll Dashboard**: Added a permission-gated executive dashboard at `/payroll/dashboard` with monthly and payroll-position filters, five payroll KPIs, position allocation and trend charts, payroll composition, top employees, notable month-over-month changes, deterministic insights, and a sortable position summary.
- **Payroll Analytics Read Model**: Added a single database RPC that aggregates only the current payroll calculation run, reuses payable payroll line items, resolves effective payroll positions by month, and avoids employee-level N+1 queries or calculation-revision double counting.
- **Dashboard Quality Coverage**: Added pgTAP, unit, route, and component tests for owner-only access, current-versus-previous-month calculations, new and departed employees, empty/error states, dynamic positions, and null-safe percentages.

## [0.2.0.0] - 2026-08-26

### Added
- **Complete Payroll Calculation Engine**: Integrated multi-role compensation calculation (Teaching Assistant, Operations Assistant, Admissions Manager) including base salary calculation from minute-level timekeeping, teaching allowance (40k/session), grading bonus pool distribution, admissions revenue tiers (4%-8%), operations grade renewals (2%), piecework floor offsets (85%), and salary advance single deduction.
- **Excel Import & Verification Pipeline**: Added payroll import batch workflow for timekeeping, grading, renewal orders, and new enrollment orders with duplicate detection, validation status tracking, and conflict resolution.
- **Feedback & Correction Request Workflow**: Staff can submit correction requests with item-level details and evidence URLs; resolvers can accept/reject requests; feedback window closure strictly gates review submission until recalculation is performed.
- **Staff Compensation & Profile Management**: Added immutable position versions, daily rate versions, grade assignments, payroll tasks, and bank account change request workflows.
- **PgTAP & Vitest Test Coverage**: Added comprehensive test suites verifying all 10 P0 & P1 business contracts and achieving high unit test coverage across payroll and staff schemas and read models.

### Fixed
- **Audit Trigger Contract**: Fixed `audit_payroll_period_change` to use unqualified `coalesce()` instead of non-existent `pg_catalog.coalesce()` and properly audit `payroll_calculation_revised` and `payroll_feedback_closed` events.
- **Calculation Run Uniqueness & Recalculation**: Scoped salary advance deduction uniqueness to statement level to allow immutable multi-revision recalculations without constraint conflicts.

## [0.1.1.0] - 2026-08-13

### Added
- **Universal Staff Self-Attendance**: Granted `timekeeping.check` permission across all active staff roles (Owner, Admin, Accountant, Management Assistant, Teaching Assistant, Sales) via database migration `20260813020000_grant_timekeeping_check_to_all_staff_roles.sql`.
- **Topbar Attendance Action**: Added a prominent "Chấm công" button to the right side of the topbar, positioned immediately to the left of the light/dark theme toggle, with white text and clock icon styling across light and dark themes.

### Fixed
- **Timekeeping Route Permission Model**: Fixed authorization on `/timekeeping` to allow staff accounts with `timekeeping.check` to access and operate their own attendance panel while strictly isolating administrative staff attendance lists and shift schedule tables to users with `timekeeping.view`.
