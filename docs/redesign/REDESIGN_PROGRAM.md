# Toan Thay Vinh ERP redesign program

## Purpose

Deliver a substantially clearer, faster, and more consistent ERP experience without rebuilding the product or changing its operating model. The program prioritizes daily academic operations first, then applies proven patterns to the rest of the ERP.

## Objectives

- Improve usability, scanability, and speed for frequent staff work.
- Establish a coherent visual language and lower cognitive load.
- Preserve existing routes, business logic, database behavior, Supabase integrations, permissions, RLS/RBAC, audit behavior, Server Action/RPC boundaries, and financial/session state machines. Owner-approved additions are recorded in WORKFLOW_CONTRACTS_A_E.md (v0.8.0.0: class-page bulk cancel and enrolment search).
- Build frontend primitives that remain maintainable without becoming a generic application framework.
- Release in small, independently reversible waves.

## Protected boundaries

The redesign must preserve all of the following unless a separate, explicitly approved program changes them:

- Existing route URLs and permission codes.
- Existing Supabase schema, RLS policies, RBAC, RPC contracts, Server Actions, revalidation, and audit paths.
- Feature-owned validation, authorization, action availability, confirmation meaning/copy, and lifecycle rules.
- Existing full-directory read models, client-side filtering, and pagination semantics.
- Existing financial, attendance, results, enrollment, and session lifecycle behavior.

## Explicit non-goals

- Rebuild the ERP, redesign its domain model, or introduce a tenant/organization model.
- Introduce server-side filtering or server-side pagination in this program. Approved exception: the class-page enrolment search (v0.8.0.0); see WORKFLOW_CONTRACTS_A_E.md, Enrollment lifecycle.
- Add a central permission registry, central action registry, schema-driven mega-table, universal form engine, or third-party UI component library.
- Add a global academic-year selector or imply a cross-module academic-year filter.
- Add a new attendance route.
- Turn visual-only shell affordances into new search or calendar features.
- Bulk-replace visual literals in unrelated modules.

## Product phases

| Phase | Objective | Status in this program |
| --- | --- | --- |
| A — UX Contract | Establish role/capability, route, action, error, audit, and irreversible-operation contracts. | Planned and documented in Wave 0. |
| B — Information Architecture | Clarify navigation and route hierarchy while retaining URLs and permissions. | Planned and documented in Wave 0. |
| C — Design System | Define semantic tokens, typography, density, component, table, form, and responsive conventions. | Implemented only when Wave 1 is approved. |
| D — Application Shell | Redesign sidebar, top bar, page shell, global states, and responsive navigation. | Implemented only when Wave 2 is approved. |
| E — Reference operational workflow | Redesign Students, Classes, Sessions, Attendance, Results, and Lock as reusable ERP patterns. | Implemented only in Waves 3–6. |
| F — Dashboard | Build dashboard after operational patterns are proven. | Later program; out of A–E implementation scope. |
| G — High-trust workflows | Tuition, debt, payments, SePay, and CRM. | Later program; out of A–E implementation scope. |
| H — People and administration | Staff, timekeeping, payroll, advances, commission, imports, reports, RBAC, and audit logs. | Later program; out of A–E implementation scope. |

## Implementation sequence

| Wave | Deliverable | Start condition |
| --- | --- | --- |
| 0 | Contracts, architecture plan, and non-production test-environment plan. | Complete. Documentation only. |
| 1 | Foundation: semantic tokens, Be Vietnam Pro, Lucide, and the minimum test stack/smoke harness. | Wave 0 acceptance gate passes. |
| 2 | Application shell and approved information architecture. | Wave 1 acceptance gate passes. |
| 3 | Students directory/detail/form presentation and URL-backed view state. | Wave 2 acceptance gate passes. |
| 4 | Classes and schedule presentation, preserving feature actions. | Wave 3 acceptance gate passes. |
| 5 | Sessions presentation and lifecycle surfaces. | Wave 4 acceptance gate passes. |
| 6 | Attendance, results, and session lock presentation. | Wave 5 acceptance gate passes. |

## Release gate rule

No wave may begin implementation until the immediately preceding wave has passed its documented acceptance gate, including its regression checks. A failed gate requires correction within that wave or an explicit program decision to stop; later-wave scope must not be used to mask an earlier regression.

Each wave has an independent rollback boundary: its presentation, test, and documentation changes may be reverted without changing protected backend contracts or expanding the next wave.
