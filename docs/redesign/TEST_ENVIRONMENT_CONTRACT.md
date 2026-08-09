# Test environment contract: A–E redesign

## Purpose

The redesign safety net must test the real authentication, route permission guards, RBAC, RLS, Server Actions, RPCs, validation/conflicts, and audit paths without placing production data or production credentials at risk.

This is a planning contract only. Wave 0 does not create accounts, credentials, fixtures, Supabase projects, test code, or configuration.

## Tool responsibilities

| Tool | Use | Do not use for |
| --- | --- | --- |
| Vitest | Deterministic pure utilities: student filtering, pagination edge cases, URL search-param parsing/serialization, status mapping, and view-state transformations. | Browser auth, real Supabase/RLS parity, or feature mutation workflows. |
| React Testing Library | Valuable independent behavior: FilterBar state, pagination state, loading/empty/error, confirmation/pending presentation, and non-browser responsive decisions. | Exhaustive tests of simple markup or real backend authorization. |
| Playwright | Real authenticated browser behavior: shell, role-aware navigation, route access parity, URL persistence, reference workflow, lifecycle/confirmation/permission-denied states, responsive rendering, and controlled screenshots. | Production testing, random live data, or unsafe destructive operations. |

## Environment boundary

- Browser tests run only against a dedicated non-production Supabase staging/test project and a non-production application deployment/local target connected to it.
- The current application is treated as single-center/single-tenant. Test isolation must not add a tenant/organization abstraction.
- RLS/RBAC must not be weakened, mocked, bypassed, or replaced for parity tests.
- Production credentials, production Supabase URLs/project references, and production operational data must never be used.

## Representative role accounts

Provision the minimum number of fixed accounts using actual existing roles and permission assignments from the repository/database. Do not invent test-only application roles.

The final role selection must cover these capability profiles where the current role model provides them:

- A full A–E operational account for permitted Students, Classes, Sessions, Attendance, Results, and Lock workflows.
- A read-only account that can establish navigation/route-access and hidden-action parity.
- An attendance-capable account for `attendance.mark` with necessary read access.
- A results/lock-capable account for `results.manage` and/or `sessions.lock`, if these are separated in the real role model.

Credentials are secrets supplied only through non-committed environment variables. Authentication state files are treated as sensitive and ignored by Git.

## Synthetic fixture contract

Baseline fixtures are owned by the test environment and are synthetic, deterministic, and protected from destructive tests. They include only what A–E needs:

- Representative students, including duplicate-lookup and enrollment scenarios.
- Representative classes, academic-year context, and schedules.
- Sessions in known scheduled, in-progress, completed, locked, and cancelled states.
- Attendance scenarios sufficient to show eligible, incomplete, and blocked session conditions.
- Results sufficient to show required, entered, and missing-result conditions.

Fixture identifiers and display values must be stable. Screenshot scenarios must avoid timestamps, random IDs, changing counts, and live operational records.

## Disposable workflow records

Lifecycle/mutation tests create or select only explicitly disposable records. They must:

- Use a unique per-run identifier to prevent collisions.
- Never permanently mutate baseline fixture records.
- Exercise the real Server Action/RPC and validation/conflict path.
- Clean up or restore the record at the end of the test; failures must leave enough metadata for the documented reset process.
- Be limited to the non-production project.

Destructive scenarios include session lifecycle transitions, attendance marking, result entry, and any supported lock/reset/reversal behavior. No destructive test is permitted to run on baseline records or a production target.

## Reset and ownership

- Assign a named environment owner before Wave 1; that owner manages baseline fixture creation, reset authorization, and rotation of non-production secrets.
- Baseline reset must be an explicit, documented operation that restores the known scenario without altering production or the application’s domain model.
- Disposable-record cleanup runs after each test and an idempotent environment cleanup/reset procedure is available for failed runs.
- Fixture reset mechanisms must respect existing RLS/RBAC, RPC, and audit contracts. They are not a reason to create test-only privileged production behavior.

## Required configuration interface

Wave 1 may standardize the exact names, but the test harness requires non-committed values equivalent to:

| Variable category | Purpose |
| --- | --- |
| `E2E_BASE_URL` | Non-production application URL. |
| `E2E_SUPABASE_URL` and non-production project identifier/allowlist | Verify that the configured target is the approved test project. |
| `E2E_ROLE_<PROFILE>_EMAIL` / `E2E_ROLE_<PROFILE>_PASSWORD` | Fixed representative test account credentials. |
| `E2E_FIXTURE_NAMESPACE` / baseline identifiers | Locate deterministic baseline data. |
| `E2E_DISPOSABLE_PREFIX` | Uniquely mark per-run mutation records. |
| Optional reset credential/configuration | Run the approved non-production reset procedure only. |

No actual value, production reference, credential, or service-role secret belongs in source control. Variable names above are a contract interface, not an instruction to create credentials in Wave 0.

## Hard production-target refusal

Playwright destructive projects must fail before test execution unless the configured URL and Supabase project reference match an explicit non-production allowlist. Missing target identity is a failure, not an invitation to proceed. A production domain, production project reference, or unrecognized target must refuse all mutation/lifecycle tests.

Read-only local visual work must likewise never fall back to production credentials or production fixture data.

## Authentication strategy

- Authenticate through the real application flow using the fixed non-production role accounts.
- Persist per-role Playwright storage state only in ignored local/CI-secure locations; do not commit it.
- Refresh or recreate state predictably when sessions expire.
- Permission parity tests use real route guards, server permission lookup, RBAC/RLS, Server Actions, and RPCs; Supabase must not be mocked for those cases.

## Initial automated coverage

### Foundation gate

- Vitest: student filtering, pagination edges, URL-state parsing and serialization.
- React Testing Library: shared loading/empty/error states, FilterBar behavior, confirmation/pending presentation.
- Playwright: authenticated shell, permission-aware navigation, one Students directory happy path, URL filters surviving refresh/navigation, and representative desktop/tablet/mobile rendering.

### Incremental coverage

- Wave 3 expands the Students workflow and URL-state parity.
- Wave 4 expands Classes/status/schedules and academic-year context.
- Wave 5 expands Sessions/lifecycle using disposable records.
- Wave 6 expands Attendance/Results/Lock and post-lock immutability using disposable records.

## Screenshot rules

- Screenshot only stable structural surfaces backed by deterministic baseline data: shell, Students directory, Classes directory, and Sessions directory/detail.
- Use defined desktop, tablet, and mobile viewports.
- Mask or avoid unstable time, random data, notifications, counters, and live operational content.
- Do not use brittle full-page screenshots for dynamic data-heavy surfaces unless every visible value is deterministic.
- Global typography visual checks include the A–E reference surfaces plus Finance/payments, imports, RBAC/permissions, and payroll/people only to detect wrapping, clipping, density, button, modal, table, and mobile-card regressions. Those non-A–E modules are not redesigned in Wave 1.

## Ambiguity requiring verification before Wave 1

- The final account names and number of accounts must be derived from the actual deployed non-production permission assignments; this contract intentionally does not invent roles.
- The repository does not yet contain the test runner/configuration or a populated Supabase seed scenario. Their implementation and exact reset mechanism are Wave 1 work, subject to this safety contract.
