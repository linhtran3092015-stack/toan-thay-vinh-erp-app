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
- **Acceptance gate:** No protected-contract diff; semantic tokens cover all required categories; no serious typography overflow; lint, unit/RTL tests, typecheck, build, and the Playwright harness pass their applicable local checks. Authenticated staging Playwright remains pre-production hardening.

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
- **Acceptance gate:** Pure URL/filter/pagination and focused presentation tests pass; no Server Action/RPC or read-model behavior changes. Authenticated staging role-path QA remains pre-production hardening.

## Wave 4 — Classes

- **Scope:** Classes directory/detail/form presentation, URL-backed view state, status/schedule presentation, and route-owned academic-year context.
- **Likely affected files:** `src/app/(app)/classes/**`, `src/features/classes/**`, proven pattern components, class tests.
- **Protected files/behaviors:** `classes.view`, `classes.create`, `classes.manage_schedule`; class/academic-year action bindings; existing status/schedule RPCs and transitions; route URLs.
- **Dependencies:** Wave 3 accepted; student-derived list/form/table patterns proven reusable.
- **Rollback boundary:** Class page/pattern presentation and client URL adapters only.
- **Regression checks:** Filter/pagination parity; create/edit/status/schedule permissions and errors; `draft → active` and `active → closed` behavior unchanged; academic-year context is never global.
- **Acceptance gate:** Existing class operations work with representative permitted/denied roles, stable responsive rendering, and no change to RPC/action payloads or revalidation behavior.

## Wave 5 — Sessions

- **Scope:** Sessions directory/detail presentation, URL-backed view state, and Start/Complete/Cancel lifecycle action surfaces. Unused generation, reset, and reversal flows are not surfaced.
- **Likely affected files:** `src/app/(app)/sessions/**`, `src/features/sessions/**`, proven pattern components, session tests.
- **Protected files/behaviors:** Session read model/status type, `sessions.manage`, session generator’s current exposure/RPC enforcement, Server Actions/RPCs, lifecycle/time/conflict behavior, audit/revalidation paths.
- **Dependencies:** Wave 4 accepted; non-production disposable records ready for lifecycle testing.
- **Rollback boundary:** Session presentation, client view-state adapter, and test code only.
- **Regression checks:** Scheduled/in-progress/completed/cancelled/locked rendering; permitted/denied lifecycle actions; refresh after start/complete/cancel; responsive list/detail behavior.
- **Acceptance gate:** Focused lifecycle-presentation and URL-state tests pass; no new session permission is introduced; cancellation/lock terminal behavior is preserved. Real-stack lifecycle tests on disposable records remain pre-production hardening.

## Wave 6 — Attendance, results, and lock

- **Scope:** Session-detail attendance/results/lock presentation and responsive operational flow, using the patterns proven in Waves 3–5.
- **Likely affected files:** `src/features/sessions/components/session-attendance-management.tsx`, `src/features/sessions/components/session-result-management.tsx`, `src/features/sessions/components/session-lock-actions.tsx`, `src/features/sessions/session-detail-page.tsx`, scoped Sessions styles, and focused Sessions feature tests.
- **Protected files/behaviors:** `attendance.view`, `attendance.mark`, `results.view`, `results.manage`, `sessions.lock`; roster/lifecycle validation; Server Actions/RPCs; lock immutability and audit paths.
- **Dependencies:** Wave 5 accepted; deterministic baseline fixtures and disposable lifecycle records.
- **Rollback boundary:** Attendance/result/lock presentation and tests only; no record schema, state-machine, or action change.
- **Regression checks:** Attendance started/locked/cancelled/enrollment conflicts; result record/update permissions; lock readiness and explicit confirmation; post-lock immutability; role-aware desktop/tablet/mobile.
- **Acceptance gate:** The reference workflow's focused unit/RTL coverage and all local validation gates pass; lock presentation preserves existing authoritative requirements. Real-stack authenticated workflow testing and destructive cleanup remain pre-production hardening.

## Proven implementation patterns

The following patterns are proven by the completed Foundation through Wave 6 reference implementation. They are implementation guidance for later redesign modules, not new abstractions or policy owners.

### Application shell

- The application shell projects existing, permission-visible routes into a top-level domain sidebar and contextual module navigation for the active domain.
- Desktop uses the domain sidebar; tablet uses the collapsed icon rail; mobile uses the primary-navigation drawer and a real active-domain module selector. Existing routes, ordering, and permission inputs remain the source of navigation visibility.
- Shell navigation is never authorization. Route guards and feature/server permission checks remain authoritative.

### Page and data composition

- Operational directories use `PageHeader`, existing permitted actions, `FilterBar`, result context, operational content, and feature-local pagination where the current route supports it.
- Tables use `DataTableFrame` only at a safe readable available-container width. Below that width, the same feature renders `ResponsiveRecordList`; tables are not squeezed and the decision is not based on a device name alone.
- Record lists keep identity, textual state, essential metadata, and a labelled operational action visible without turning the page into a card mosaic.

### Feature ownership and URL state

- Feature folders own permissions, domain state, URL parser/serializer, filter semantics, action availability, confirmation meaning, Server Action/RPC bindings, validation, and domain copy. Shared UI owns presentation and interaction states only.
- Directory URL state is feature-local: it preserves unrelated parameters, resets page on filter changes, composes rapid updates before navigation settles, and retains existing client-side full-directory filtering and pagination behavior.
- This program does not introduce a generic application-wide URL-state framework or server-side filtering/pagination. Any server-read optimization requires its own measured, approved contract.

### High-trust actions, status, and feedback

- `Dialog` provides visual layering, focus containment, Escape/backdrop routing, and focus restoration; the feature retains availability, policy, copy, pending-dismissal rules, and action binding. Pending feature actions prevent duplicate submission and unsafe dismissal.
- Semantic status treatment is reserved for real lifecycle/status meaning. Ordinary metadata remains neutral. Derived immutable state remains separate from lifecycle enums; session `lockedAt` is the reference example.
- `ResultBanner` provides accessible success, error, warning, and information presentation while each feature owns the copy and the action/result meaning.

### Accessibility and visual system

- Redesigned operational controls use explicit labels, `aria-describedby` for relevant help/errors, textual state, labelled consequential actions, and minimum 44px touch targets where the interaction is touch-facing.
- Dialogs provide labelled, focus-safe confirmation flows; repeated editors use stable, unique control/error IDs.
- Redesigned surfaces consume semantic tokens, Be Vietnam Pro, and Lucide. They avoid decorative gradients, glassmorphism, shadow decoration, and card mosaics.

### Protected backend boundary

- UI redesign preserves permission codes, Server Actions, RPCs, RLS/RBAC, audit/revalidation behavior, and authoritative workflow validation.
- Financial/session accounting remains server-owned. UI does not recreate ledger calculations, session quantities, or other accounting consequences.

### Testing gate for future redesign modules

- Add focused unit/RTL coverage for feature-local view state and valuable presentation/interaction regressions, then run lint, tests, typecheck, build, and `git diff --check`.
- Run a focused gstack review after implementation before accepting the wave.
- The authenticated staging Playwright program remains deferred pre-production hardening. Its harness is retained, but it is not a redesign-wave blocker.

### Reference modules

| Module | Proven patterns |
| --- | --- |
| Students | URL-backed client view state, filtered return context, directory table/record-list switch, detail hierarchy, and feature-owned enrollment actions. |
| Classes | Directory/table/list pattern, route-owned academic-year context, feature-local forms, and high-trust schedule/academic-year dialogs. |
| Sessions | URL-backed directory state, lifecycle presentation, session-detail composition, and separate lifecycle versus `lockedAt` presentation. |
| Attendance | Dense editable operational data presentation, container-width record-list fallback, permission-safe identity presentation, and editable/readonly state treatment. |
| Results | DataTableFrame/record-list reuse, eligibility/editability presentation, validation feedback, and feature-owned result semantics. |
| Lock | Server-authoritative readiness, irreversible-action presentation, pending-safe confirmation, separate immutable `lockedAt`, and no client ledger/readiness engine. |

## Cross-wave rule

No later wave begins until its predecessor passes the stated gate. If a generic component would require moving permission, business-state, or action-binding logic out of a feature, it is out of scope and the feature continues to own that logic.
