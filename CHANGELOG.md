# Changelog

All notable changes to Toan Thay Vinh ERP will be documented in this file.

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
