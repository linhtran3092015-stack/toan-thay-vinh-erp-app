# Engineering plan: Phases A–E

## Architecture boundary

```text
src/components/ui          Domain-agnostic primitives and visual tokens
src/components/shared      Shared presentation states only
src/components/patterns    Reusable operational/page presentation patterns
src/features/<domain>      Data, read models, permissions, actions, RPCs,
                           validation, lifecycle rules, and domain copy
```

New primitives/patterns are introduced only when required by the approved contract or proven across at least two real workflows.

## Approved decisions D3–D11

| Decision | Locked implementation rule |
| --- | --- |
| D3 — Feature ownership | Permissions, action availability, confirmation wording/meaning, Server Action bindings, RPC bindings, validation, and state transitions remain in feature code. Shared components standardize presentation states only. No central permission/action registry. |
| D4 — URL view state | Existing list filters and pagination move to URL search params as client view state only. Keep full-directory reads, client filtering, pagination semantics, and scopes unchanged. |
| D5 — UI layers | `ui` is domain-agnostic; `shared` holds loading/empty/error/permission/pending/confirmation presentation; `patterns` holds page/operational layout primitives. No mega-table, universal form engine, or new UI library. |
| D6 — Academic year | Remove the shell’s hard-coded year label. No global selector or new cross-module filtering. Show context only from trustworthy route-owned data. |
| D7 — Tokens | Define complete semantic token vocabulary in Wave 1. Every touched A–E component consumes tokens. Do not bulk-edit unrelated features; preserve status semantics and behavior. |
| D8 — Icons | Add and use only `lucide-react` on redesigned A–E surfaces. Navigation baseline is 20px unless DESIGN.md specifies a contextual exception. Icons are accessible presentation, never authorization/state logic. |
| D9 — Typography | Use Be Vietnam Pro through `next/font/google` as the single primary ERP typeface; introduce semantic type roles. Smoke-check A–E plus finance/payments, imports, RBAC, and payroll/people for global typography breakage only. |
| D10 — Test stack | Vitest tests pure logic; React Testing Library tests valuable isolated behavior; Playwright tests real authenticated browser flows, roles, responsive behavior, and stable screenshots. |
| D11 — Test environment | Use a dedicated non-production Supabase project, existing representative roles, synthetic deterministic baseline data, disposable mutations, cleanup/reset, secret environment variables, and hard production-target refusal. No tenant abstraction or Supabase mocking for permission/workflow parity. |

## Wave 1 — Foundation

- **Scope:** Add semantic design tokens, Be Vietnam Pro, Lucide, the three UI layers’ minimum primitives/states, URL-state utilities, and minimal Vitest/RTL/Playwright configuration/smoke coverage.
- **Likely affected files:** `package.json`, lockfile, `src/app/layout.tsx`, `src/app/globals.css`, new `src/components/ui/**`, `src/components/shared/**`, test configuration and test files, `.gitignore`, test documentation.
- **Protected files/behaviors:** Feature actions/RPCs, `src/proxy.ts`, permission database helpers, Supabase files, routes, existing domain validation and lifecycle code.
- **Dependencies:** Wave 0 acceptance; approved staging/test environment contract and access to non-production credentials outside the repository.
- **Rollback boundary:** Foundation-only styles/fonts/icons/test tooling and new presentation primitives. Revert without touching domain or backend contracts.
- **Regression checks:** Type/lint/build; token use in touched files; font smoke checks on shell, Students, Classes, Sessions, Attendance, finance/payments, imports, RBAC, payroll/people; initial unit/RTL/browser smoke suite.
- **Acceptance gate:** No protected-contract diff; semantic tokens cover all required categories; no serious typography overflow; all initial smoke tests execute against safe targets.

## Wave 2 — Application shell

- **Scope:** Sidebar/topbar/page shell, approved navigation grouping, responsive navigation, top-bar notifications, removal of fake search/calendar affordances, removal of the hard-coded year label, and global presentation states.
- **Likely affected files:** `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, navigation configuration, shell styles, relevant `components/patterns/**` and shared-state files.
- **Protected files/behaviors:** `AuthenticatedAppShell`, `src/proxy.ts`, existing navigation permission filtering and route guards, notification data/actions, route URLs and permission codes.
- **Dependencies:** Wave 1 accepted; navigation contract confirmed against current routes.
- **Rollback boundary:** Shell/navigation presentation and pattern components only; restore previous shell without feature/data changes.
- **Regression checks:** Authenticated shell loads; route access parity; permission-aware navigation visibility; notifications remain usable; desktop/tablet/mobile; no fake affordance remains; no global year behavior.
- **Acceptance gate:** Every current accessible route remains reachable by its existing permission code; unauthorized routes remain protected; shell responsive checks and screenshot baselines pass.

## Wave 3 — Students

- **Scope:** Students directory, filters/pagination URL view state, responsive record presentation, student detail/form presentation, and enrollment action presentation.
- **Likely affected files:** `src/app/(app)/students/**`, `src/features/students/**`, `src/components/patterns/FilterBar*`, `src/components/patterns/DataTableFrame*`, `src/components/patterns/ResponsiveRecordList*`, student tests.
- **Protected files/behaviors:** Student read models, form schemas, Server Actions, RPC names/arguments, permission checks, duplicate lookup, enrollment/transfer/reserve/resume rules, revalidation/audit boundaries.
- **Dependencies:** Wave 2 accepted; Wave 1 URL-state utilities and test harness available.
- **Rollback boundary:** Student presentation and client view-state adapters only. URL parsing can be rolled back while retaining legacy current behavior.
- **Regression checks:** Existing client-side filtering/pagination results match before/after; URL filters persist through refresh/detail navigation; duplicate/create/update/enrollment controls retain permissions and errors; desktop/mobile stable.
- **Acceptance gate:** Student happy path and denied-role path pass in Playwright; pure URL/filter/pagination tests pass; no Server Action/RPC or read-model behavior changes.

## Wave 4 — Classes

- **Scope:** Classes directory/detail/form presentation, URL-backed view state, status/schedule presentation, and route-owned academic-year context.
- **Likely affected files:** `src/app/(app)/classes/**`, `src/features/classes/**`, proven pattern components, class tests.
- **Protected files/behaviors:** `classes.view`, `classes.create`, `classes.manage_schedule`; class/academic-year action bindings; existing status/schedule RPCs and transitions; route URLs.
- **Dependencies:** Wave 3 accepted; student-derived list/form/table patterns proven reusable.
- **Rollback boundary:** Class page/pattern presentation and client URL adapters only.
- **Regression checks:** Filter/pagination parity; create/edit/status/schedule permissions and errors; `draft → active` and `active → closed` behavior unchanged; academic-year context is never global.
- **Acceptance gate:** Existing class operations work with representative permitted/denied roles, stable responsive rendering, and no change to RPC/action payloads or revalidation behavior.

## Wave 5 — Sessions

- **Scope:** Sessions directory/detail presentation, URL-backed view state, session generation presentation, and lifecycle action surfaces.
- **Likely affected files:** `src/app/(app)/sessions/**`, `src/features/sessions/**`, proven pattern components, session tests.
- **Protected files/behaviors:** Session read model/status type, `sessions.manage`, session generator’s current exposure/RPC enforcement, Server Actions/RPCs, lifecycle/time/conflict behavior, audit/revalidation paths.
- **Dependencies:** Wave 4 accepted; non-production disposable records ready for lifecycle testing.
- **Rollback boundary:** Session presentation, client view-state adapter, and test code only.
- **Regression checks:** Scheduled/in-progress/completed/cancelled/locked rendering; permitted/denied lifecycle actions; refresh after start/complete/cancel; session generation parity; responsive list/detail behavior.
- **Acceptance gate:** Real-stack lifecycle tests pass only on disposable records; no new session permission is introduced; cancellation/lock terminal behavior is preserved.

## Wave 6 — Attendance, results, and lock

- **Scope:** Session-detail attendance/results/lock presentation and responsive operational flow, using the patterns proven in Waves 3–5.
- **Likely affected files:** `src/features/attendance/**`, `src/features/results/**`, `src/features/sessions/components/session-lock-actions.tsx`, session detail route/components, feature tests.
- **Protected files/behaviors:** `attendance.view`, `attendance.mark`, `results.view`, `results.manage`, `sessions.lock`; roster/lifecycle validation; Server Actions/RPCs; lock immutability and audit paths.
- **Dependencies:** Wave 5 accepted; deterministic baseline fixtures and disposable lifecycle records.
- **Rollback boundary:** Attendance/result/lock presentation and tests only; no record schema, state-machine, or action change.
- **Regression checks:** Attendance started/locked/cancelled/enrollment conflicts; result record/update permissions; lock readiness and explicit confirmation; post-lock immutability; role-aware desktop/tablet/mobile.
- **Acceptance gate:** Students → Classes → Sessions → Attendance/Results/Lock reference workflow passes on the real non-production stack; destructive tests clean up; lock remains impossible until existing requirements are satisfied.

## Cross-wave rule

No later wave begins until its predecessor passes the stated gate. If a generic component would require moving permission, business-state, or action-binding logic out of a feature, it is out of scope and the feature continues to own that logic.
