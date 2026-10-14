# Design System — Toán Thầy Vinh ERP

## Update approved 2026-10-12 — Stumana handoff

This update supersedes the 2026-09-09 terracotta update and the original navy anchor for **colors, radius, badge shape, and motion**. Module structure, permissions, operational density, and the semantic status families (success / warning / danger / info / neutral) remain authoritative. The token source of truth is the `:root` block in `src/app/globals.css`; the design handoff is `HANDOFF.md` (12/10/2026). Terracotta (`#B83C30`) and the other palettes remain selectable under Settings → Thương hiệu & giao diện; moss is the default. Legacy `--color-*` aliases stay in `globals.css` for features not yet redesigned. No route, permission, RPC, schema, or state-machine change is authorized.

### Foundation tokens (2026-10-12)

#### Color roles

| Token | Value | Use |
| --- | --- | --- |
| `--surface-canvas` | `#FAF9F6` | Application background (warm light canvas). |
| `--surface-base` | `#FFFFFF` | Page, table, form, and panel surface. |
| `--surface-raised` | `#FCFBF9` | Popovers, dropdowns. |
| `--surface-sunken` | `#F3F1EC` | Filter field background, disabled interior. |
| `--surface-selected` | `#EDF2EE` | Selected row, active filter. |
| `--surface-hover` | `#F8F6F2` | Row and surface hover. |
| `--text-strong` / `--text-default` | `#2B3444` / `#4A5566` | Titles and primary values / body copy. |
| `--text-muted` / `--text-subtle` / `--text-disabled` | `#647083` / `#98A2B3` / `#A9B2C1` | Secondary metadata / timestamps / disabled only. |
| `--border-subtle` | `#ECE8E1` | Default panel, field, and separator border. |
| `--border-strong` | `#E1DCD3` | Secondary button and stronger division (hover `--border-strong-hover` `#C9C3B8`). |
| `--border-row` | `#F1EEE8` | Table row divider (`border-top: 1px`). |
| `--border-focus` | `#315FCC` | Focused control border. Focus stays blue, not moss. |
| `--action-primary` | `#4F6B5A` | One primary page action, active navigation, identity anchor (moss). |
| `--action-primary-hover` | `#3F5749` | Primary hover/pressed. |
| `--action-primary-soft` / `--action-primary-soft-border` | `#EDF2EE` / `#C9D8CE` | Quiet emphasis, active chip/filter. |
| `--action-primary-shadow` | `0 1px 2px rgba(63,87,73,.18)` | Primary button 1px shadow. |
| `--action-link` | `#4F6B5A` | Text links. |
| `--focus-ring` | `rgba(49, 95, 204, 0.28)` | Two-layer keyboard focus halo. |
| `--disabled-bg` / `--disabled-border` | `#F1F3F7` / `#E1E6EE` | Disabled control. |

#### Semantic state roles

Each family now carries an `-ink` token for long text on its soft surface (result banners); badges keep the family foreground. `--status-*` stays the icon/accent foreground.

| Family | Foreground | Soft surface | Border | Ink (text on soft) |
| --- | --- | --- | --- | --- |
| Success | `#16794C` | `#EAF8F1` | `#B7E9D0` | `--status-success-ink: #0F5A38` |
| Warning | `#A85B09` | `#FFF5E5` | `#F3D3A6` | `--status-warning-ink: #7A4306` |
| Danger | `#BE123C` | `#FFF1F2` | `#FECDD3` | `--status-danger-ink: #881337` |
| Info | `#215FC7` | `#EDF4FF` | `#BED4FB` | `--status-info-ink: #1A4B9E` |
| Neutral | `#536174` | `#F1F3F6` | `#D5DCE6` | `--status-neutral-ink: #3F4C5E` |

Danger changed from `#C33752` to `#BE123C`. Feature code still maps its own domain status to a family; vocabulary must match source code (HANDOFF.md §4b), for example attendance is present / excused_absence / unexcused_absence / additional_study with no "late" state, and a session lock is permanent.

#### Navigation, elevation, table, and form roles

| Token family | Approved role |
| --- | --- |
| `--nav-sidebar-*` | Light sidebar: `bg #FFFFFF`, `fg #3B465A`, `muted #647083`, `hover #F6F3EE`, `active-bg #EDF2EE`, `active-fg #4F6B5A`, `indicator #4F6B5A`, `border #E7E3DC`. Active item = soft background + `box-shadow: inset 3px 0 0 var(--nav-sidebar-indicator)`. |
| `--panel-shadow` | `0 1px 2px rgba(32,43,64,.04)`. Ordinary panels only; replaces the older "no default card shadow" rule at this strength. |
| `--elevation-1` / `-2` / `-3` | `0 1px 2px rgba(32,43,64,.06)` / `0 8px 24px rgba(32,43,64,.12), 0 2px 8px rgba(32,43,64,.06)` / `0 20px 56px rgba(32,43,64,.20), 0 4px 16px rgba(32,43,64,.10)`. |
| `--overlay-scrim` / `--toast-bg` | `rgba(32,43,64,.44)` / `#202B40` (toast only for background jobs). |
| `--table-header` / `--table-row-hover` / `--table-row-selected` | `#F7F5F1` / `#F8F6F2` / `#EDF2EE`. |
| `--field-bg` / `--field-placeholder` / `--field-error-*` | `#FFFFFF` / `#98A2B3` / danger family. |

#### Radius

| Token | Default | `data-erp-rounded="false"` | Use |
| --- | --- | --- | --- |
| `--radius-sm` | 6px | 4px | Badges, compact row actions, chips, icon tiles. |
| `--radius-md` | 10px | 6px | Inputs, selects, buttons, tabs, filter controls. |
| `--radius-lg` | 12px | 8px | Tables, panels, cards, drawers. |
| `--radius-xl` | 16px | 12px | Dialogs only. |
| `--radius-full` | `9999px` | `9999px` | Avatar, count dot, toggle. Never a control or badge shape. |

Setting `data-erp-rounded="false"` on the root element restores the earlier tight 4/6/8/12 scale. Corners are softer but controls and badges are still not pills.

#### Badge and button spec

| Element | Spec |
| --- | --- |
| Status badge | 12px / 500, padding 3px 9px, `--radius-sm`, soft surface + family foreground (`--status-*`) text + family border; `-ink` text is used by result banners. Always carries text; optional 12–14px icon. |
| Primary button | Weight 500, horizontal padding 18px, `--action-primary-shadow` (1px), `active:translate-y-px`. One per page. |
| Secondary button | Weight 500, `--border-strong` border, padding 18px, hover `--border-strong-hover` + `--interactive-hover`. |
| Danger | Danger-outline for in-page destructive actions; danger-solid only inside a confirm dialog. Never a page primary. |
| Titles | Weight 600 with `-0.01em` letter-spacing (handoff 1a) instead of 700. Body uses `-webkit-font-smoothing: antialiased`. |

#### Control, row, and layout metrics

| Token | Value |
| --- | --- |
| `--control-h-compact` / `--control-h` / `--control-h-touch` | 32px / 40px / 44px. |
| `--row-h` / `--row-h-2` | 48px / 56px (56px only when a secondary line is needed). |
| `--sidebar-w` / `--rail-w` | 240px (light sidebar) / 72px (icon rail with tooltip + `aria-label`). |
| `--topbar-h` / `--module-strip-h` | 64px / 48px. |

#### Motion timings

| Motion | Spec |
| --- | --- |
| Hover/focus feedback | `background-color / border-color / color / box-shadow` 150ms ease-out on button, a, input, select. |
| `.panel-rise` | `rise` keyframe (opacity 0→1, translateY 4px→0), 240ms ease-out, `backwards`. Applies from 768px (tablet) up only; phones open menus without motion. |
| `.progress-grow` | `grow` keyframe (`transform: scaleX(0)` → 1, `transform-origin: left`), 800ms ease-out, `backwards`, for progress bars. |
| Skeleton | Tailwind `animate-pulse` (2s), `motion-safe` only. |
| Reduced motion | Global `@media (prefers-reduced-motion: reduce)` sets `animation: none` and `transition: none` on every element. |

Menus, drawers, and dialogs keep the 150–200ms guidance from the older Motion section; page-entry choreography remains prohibited apart from `.panel-rise`.

### Hard rules (HANDOFF.md §5)

1. One primary button per page; danger is never a page's primary action.
2. Color and icon never carry meaning alone: badges, lock conditions, and GPS state always include text.
3. Loading / empty / error / forbidden states live inside the table or panel frame and never change the page geometry.
4. A consequential action states its consequence in words and shows its result next to the button; no anonymous toasts for it.
5. Components never decide permissions; they only receive `available / blocked / reason` from the feature. On mobile there is no bottom navigation; a bottom bar is only a form's action bar.

### Implementation guardrails (dev preview routes)

Development-only preview routes render redesigned components with fixture data inside the real shell. They answer 404 when `NODE_ENV === "production"`; `src/proxy.ts` lets only GET/HEAD requests to `/dev/*` skip sign-in, and only outside production; a POST to `/dev/*` still requires a session because it can carry any server action id.

| Route | Shows |
| --- | --- |
| `/dev/ui` | Component library preview: button, badge, tabs, result banner, and token primitives. |
| `/dev/shell` | App shell: light sidebar, rail, topbar, module strip, mobile drawer. |
| `/dev/lists` | Student and class directory previews: DataTableFrame, FilterBar, quick filter chips, bulk bar, record list. |
| `/dev/session` | Session workbench with fixture data: attendance group, results, guarded lock panel. Buttons call real server actions, so look only. |
| `/dev/student` | Student profile with fixture data. Enrollment dialogs open but their server actions fail on fixture ids. |
| `/dev/class` | Class detail with fixture data: header, Tổng quan, Buổi học, Học sinh, Kết quả and Học phí tabs, enrol, transfer and reserve dialogs. Query params `state` (`active`, `unscheduled`, `draft`, `closed`, `composite`), `role` (`owner`, `ta`), `tab` (`overview`, `sessions`, `students`, `results`, `fees`) and `period` (`locked` by default, `draft`) for the Học phí tab. Dialogs open but their server actions fail on fixture ids, as does switching the tuition period. |
| `/dev/dashboard` | Home dashboard (design 02) with fixture data: centre layout (2a) and personal layout (2b) chosen by permission codes, with the "Phân tích" section below. Query params `role` (`owner`, `accountant`, `ta`) and `state` (`normal`, `empty`, `errors`). Links point at real routes and the timekeeping dialog calls a real server action, so look only; the live payroll estimate card is left out. |
| `/dev/tuition` | Tuition period list (design 07, frame 7a) and period page (7b) with fixture data: the draft page with its 4-step stepper, lock panel and readiness table, and the locked page with KPI strip, payment-status chips and notice table. Query params `view` (`list` by default, `draft`, `locked`), `role` (`owner`, `accountant`) and `state` (`normal`, `ready` for a draft without blockers, `empty`, `errors`). Create, lock and rate/source writes are inert stubs that never call a server action; links point at real routes, so look only. |
| `/dev/sepay` | SePay reconciliation (design 07, frame 7c) with fixture data: "Cần xử lý" queue (440px list with status chips, selection in `?tx=`) beside the selected transfer with the existing Phân bổ học phí / Đối soát flows and its allocation suggestion, and the "Tất cả giao dịch" history with suggestions and history sync panels. Query params `tab` (`review` by default, `all`), `role` (`owner`, `accountant`) and `state` (`normal`, `empty`, `errors`). Every server action (allocation, suggestion confirm, reconciliation search/match/resolve, reversal, allocation details, history sync) is an inert stub (`previewSepayActions`); tab and filter links point at the real route, so look only. |
| `/dev/payroll` | Payroll (design 08) with fixture data: the payroll dashboard headed "Quỹ lương tháng MM/YYYY" with its figures strip and "Theo nhân sự" table, the older charts and tables under "Phân tích"; one staff member's per-day ledger with each shift's pay state ("Chờ xác minh (tính tạm)", "Chưa tính · chưa xác minh", "Chưa tính · thiếu đơn giá"); and the restyled payslip. Query params `view` (`dashboard` by default, `ledger`, `payslip`), `role` (`owner` by default, `accountant`, `staff`; only the owner sees the dashboard, the others get the permission-denied state) and `state` (`normal`, `empty`, `errors`). The live estimate runs on a no-op fixture transport (`previewPayrollTransports`: no `/api/payroll/*` fetch, no realtime channel) and the payslip PDF action is disabled; links point at real routes, so look only. |
| `/dev/settings` | Settings hub (design 09, frames 9a and 9b) with fixture data: the left "Mục cài đặt" table of contents (sections hidden without permission), the "Chung" form, the branding page (Nhận diện, Giao diện ERP with Màu nhấn, Bo góc and the scoped "Xem trước" sample, Màu website, personal palette), the public website editor, and the roles × permissions grid with its reason dialog, all with the StickySaveBar. Query params `view` (`branding` by default, `general`, `website`, `permissions`), `role` (`owner` by default, `manager` with settings.manage but not Owner so the grid is read-only, `viewer` read-only everywhere) and `state` (`normal`, `dirty` to start with unsaved edits, `error` to start dirty with realistic save failures, including a partial per-role failure). Every write (system settings, website/branding save and publish, role permissions, the personal palette in localStorage) and the ZaloCRM nick list are inert stubs (`previewSettingsActions`); table-of-contents links point at real routes, so look only. |
| `/dev/crm` | CRM (design 12, frames 12a and 12b) with fixture data: the "Lead tuyển sinh" list (month context line, FilterBar with the five URL filters and "Xóa lọc (n)", status chips whose counts ignore the status filter, DataTableFrame with "Chưa phân công" and status suffixes, record list on a narrow work area) and the lead page (header with one primary chosen by state and the reason when conversion is not offered, read-only "Checklist nhập học" n/10, "Học thử" rows, notes, the "Vòng đời" rail, "Dự kiến nhập học" and "Lịch sử phân công"). Query params `view` (`list` by default, `detail`), `role` (`owner` by default, `leader` with crm.transfer, `sale` with crm.update only) and `state` (`normal`, `empty`, `errors`, `converted`, `dropped`; on the list `errors` shows the in-frame error and `empty` the empty frame, on the lead page `errors` shows the not-found state). Every CRM server action (transfer, trial booking and result, status changes, conversion, notes and follow-ups, lead creation) is an inert stub (`previewCrmActions`); the list's chips and filters rewrite the preview URL and lead links point at real routes, so look only. |

---

## Update approved 2026-09-09

> Superseded for colors, radius, badge, and motion by the 2026-10-12 update above.

The user selected warm red, soft corners, and a closer Stumana feel. The ERP now defaults to terracotta (#B83C30), a warm light canvas, and configurable corner radii. This supersedes the navy visual anchor below; existing module structure, permissions, operational density, and semantic status colors remain authoritative. Settings → Thương hiệu & Giao diện controls center appearance; browser-local palette choice overrides the center default. Settings → Trang web công khai edits explicit public content with separate saved drafts and published snapshots.

## Product context

- **What this is:** A Vietnamese-first operational ERP for an education center: students, classes, sessions, attendance, results, finance, people, and administration.
- **Who it serves:** Staff executing frequent, permission-aware, and audit-sensitive work. The reference operational chain is Students → Classes → Sessions → Attendance / Results / Lock.
- **Product posture:** Desktop-first operational software. Calm and compact, never casual or consumer-like. It should feel like a dependable control room: users can scan the current state, see what they may do, and understand the consequence before they act.
- **Visual anchor:** Preserve the recognizable light canvas and deep navy navigation from the original reference. The redesign removes excess decoration, mixed typefaces, card nesting, fake utilities, and arbitrary density.

## Design principles

1. **State before action.** Show the record’s lifecycle, blockers, and readiness before presenting a control that changes it.
2. **Density with breathing room.** Fit real operational context on screen through hierarchy, alignment, and 4px rhythm, not tiny type or cramped targets.
3. **One obvious next step.** Each page has one primary action at most. Secondary, guarded, and destructive actions remain visibly different.
4. **Data is the interface.** Tables, filters, numeric alignment, statuses, and error states carry more value than decorative KPI cards.
5. **Trust is explicit.** Use clear labels, concrete confirmation consequences, semantic status treatment, and stable layouts. Color and icons never carry meaning alone.
6. **Policy stays feature-owned.** Components may present available, pending, blocked, success, error, conflict, and destructive states. They never determine permissions, transitions, confirmation meaning, or action binding.

## Aesthetic direction

- **Direction:** Restrained operational utility.
- **Decoration level:** Minimal. Color signals hierarchy or meaning; it is not ornament.
- **Layout:** Grid-disciplined, information-dense, and left-aligned. Content may be wide up to 1600px where tables need it.
- **Theme:** Light is the canonical operational theme. The existing theme behavior must be preserved until separately reviewed; any dark-mode implementation uses the same semantic roles rather than a second visual system.
- **Avoid:** Decorative gradients, glassmorphism, decorative shadows, oversized KPI cards, floating decorative icon circles, gratuitous animation, mobile card mosaics, large empty hero areas, and generic dashboard chrome.

## Foundation tokens

Wave 1 defines these as semantic tokens. Values below are the approved light-theme reference values. A touched A–E component consumes these tokens and must not introduce a new hard-coded semantic color.

### Color roles

_Superseded by the 2026-10-12 update above._

| Token | Value | Use |
| --- | --- | --- |
| `--surface-canvas` | `#F6F8FC` | Application background. |
| `--surface-base` | `#FFFFFF` | Main page, table, form, and panel surface. |
| `--surface-raised` | `#FCFCFE` | Popovers, dropdowns, and a subtle higher layer. |
| `--surface-sunken` | `#F1F3F7` | Table header, filter field background, disabled interior. |
| `--surface-selected` | `#EEF1FF` | Selected row, active filter, non-destructive selection. |
| `--text-strong` | `#17203A` | Titles, primary values, and primary body text. |
| `--text-default` | `#334155` | Standard body copy. |
| `--text-muted` | `#667085` | Labels, supporting copy, and secondary metadata. |
| `--text-subtle` | `#98A2B3` | Timestamps and intentionally de-emphasized metadata. |
| `--text-disabled` | `#A9B2C1` | Disabled text only. |
| `--border-subtle` | `#E6EAF2` | Default table, field, panel, and separator border. |
| `--border-strong` | `#CBD5E1` | Active structural boundary or stronger division. |
| `--border-focus` | `#315FCC` | Focused control border. |
| `--action-primary` | `#24348B` | One primary page action, active navigation, and identity anchor. |
| `--action-primary-hover` | `#1D2A73` | Primary hover/pressed treatment. |
| `--action-primary-soft` | `#EEF1FF` | Primary selection and quiet emphasis. |
| `--action-link` | `#315FCC` | Text links and non-primary actionable text. |
| `--focus-ring` | `rgba(49, 95, 204, 0.28)` | Visible two-layer keyboard focus halo. |
| `--disabled-bg` | `#F1F3F7` | Disabled control background. |
| `--disabled-border` | `#E1E6EE` | Disabled control border. |

### Semantic state roles

_Superseded by the 2026-10-12 update above._

| Family | Foreground | Soft surface | Border | Meaning |
| --- | --- | --- | --- | --- |
| Success | `--status-success: #16794C` | `--status-success-soft: #EAF8F1` | `--status-success-border: #B7E9D0` | Confirmed, completed, valid, or positive outcome. |
| Warning | `--status-warning: #A85B09` | `--status-warning-soft: #FFF5E5` | `--status-warning-border: #F3D3A6` | Attention, pending condition, or reduced safety margin. |
| Danger | `--status-danger: #C33752` | `--status-danger-soft: #FFF0F3` | `--status-danger-border: #F4C4CF` | Error, blocked critical condition, destructive operation, or negative balance. |
| Info | `--status-info: #215FC7` | `--status-info-soft: #EDF4FF` | `--status-info-border: #BED4FB` | Informational, scheduled, or neutral-progress state. |
| Neutral | `--status-neutral: #536174` | `--status-neutral-soft: #F1F3F6` | `--status-neutral-border: #D5DCE6` | Inactive, unavailable, archived, cancelled, or non-actionable status when supplied by the feature. |

The feature maps its own domain status to a semantic family. This system does not centralize mappings for student lifecycle, session lifecycle, payment state, or permissions.

### Navigation, elevation, table, and form roles

_Superseded by the 2026-10-12 update above._

| Token family | Approved role |
| --- | --- |
| `--nav-sidebar-*` | `bg #24348B`, `fg #FFFFFF`, `muted rgba(255,255,255,.64)`, `hover rgba(255,255,255,.10)`, `active rgba(255,255,255,.18)`, `active-indicator #AFC0FF`, `border rgba(255,255,255,.12)`. |
| `--elevation-1` | `0 1px 2px rgba(23,32,58,.06)`. Use only for floating controls where a border is insufficient. |
| `--elevation-2` | `0 8px 24px rgba(23,32,58,.12), 0 2px 8px rgba(23,32,58,.06)`. Menus, popovers, and drawers. |
| `--elevation-3` | `0 20px 56px rgba(23,32,58,.20), 0 4px 16px rgba(23,32,58,.10)`. Modal/dialog only. |
| `--overlay-scrim` | `rgba(23,32,58,.44)`. Dialog/drawer overlay. |
| `--table-header` / `--table-row-hover` / `--table-row-selected` | `#F1F3F7` / `#F8FAFD` / `#EEF1FF`. |
| `--field-bg` / `--field-placeholder` / `--field-error-*` | `#FFFFFF` / `#98A2B3` / danger family. |

No default card shadow is permitted. Borders establish ordinary grouping; elevation is reserved for layers that actually float above another surface.

## Typography

### Typeface and numeric behavior

- **Single primary family:** Be Vietnam Pro, loaded with `next/font/google` and Vietnamese support in Wave 1.
- **Weights:** 400, 500, 600, 700. Avoid 800/900 for ordinary UI.
- **Numbers:** financial amounts, balances, session counts, dates in dense columns, and KPI values use `font-variant-numeric: tabular-nums`. Do not introduce a separate display or monospace family for normal product data.
- **Case:** Vietnamese labels remain sentence case. Do not force uppercase body labels. Table headers may use restrained 12px uppercase only where it improves dense scanning.

### Semantic type roles

_Superseded for title weight by the 2026-10-12 update above (600, -0.01em tracking)._

| Role | Desktop token | Mobile token | Weight / leading | Use |
| --- | --- | --- | --- | --- |
| Page title | 24px | 22px | 700 / 32px | Route identity. One per page. |
| Section title | 18px | 18px | 600 / 28px | Section or operational work area. |
| Body | 14px | 14px | 400 / 20px | Primary reading and data description. |
| Secondary text | 13px | 13px | 400 / 18px | Supportive description and metadata. |
| Label | 13px | 13px | 500 / 18px | Field labels, filter labels, key/value labels. |
| Caption | 12px | 12px | 400 / 16px | Timestamps, hints, and compact metadata. |
| Table header | 12px | 12px | 600 / 16px | Column labels. Use `0.02em` tracking only when uppercase. |
| Table body | 14px | 14px | 400 / 20px | Table values. |
| Numeric / KPI | 28px | 24px | 700 / 32px | Compact operational summary only. |
| Control text | 14px | 14px | 600 / 20px | Buttons, menus, and action labels. |

Do not use arbitrary per-component type sizes or weights once these roles exist. A 32px KPI is reserved for a dashboard metric that needs it; reference operational pages use 20–28px values, not oversized tiles.

**Operational typography floor:** Dense desktop operational data uses the `14px / 20px` body and table baseline. Primary information in a mobile record also remains at least `14px / 20px`. Components must not reduce type outside these semantic roles merely to fit columns or controls.

## Shape, border, and spacing system

### Radius

_Superseded by the 2026-10-12 update above._

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 4px | Badges, compact row actions, inner field grouping. |
| `--radius-md` | 6px | Inputs, selects, buttons, tabs, filter controls. |
| `--radius-lg` | 8px | Tables, panels, cards, drawers. |
| `--radius-xl` | 12px | Dialogs only. |
| `--radius-full` | `9999px` | Avatar, count dot, toggle. Never a default control or status badge shape. |

The radius hierarchy is deliberately tight. It makes a dense ERP feel engineered rather than toy-like.

### Spacing and density

- **Base unit:** 4px.
- **Scale:** `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- **Page padding:** 24px desktop, 20px tablet, 16px mobile.
- **Page section gap:** 24px desktop; 16px mobile.
- **Panel padding:** 16px standard; 20px for a form or primary detail panel. Do not use 24px simply to make a screen look premium.
- **Control height:** 40px desktop; 44px when touch-first or on mobile. Compact table row actions may be 32px only when their label remains legible and the desktop context is not touch-first.
- **List/table row height:** 48px default, 56px when a secondary line is necessary. Do not compress body copy below 12px to gain space.

## Icons and motion

### Icon conventions

- Use `lucide-react` only on redesigned A–E surfaces.
- Default stroke weight is 1.8. Keep a consistent line style; do not mix filled icon sets, emoji, Unicode symbols, text initials, or hand-drawn SVG when a Lucide icon exists.
- Sizes: 16px inline metadata, 18px inside controls and table actions, 20px navigation/top-bar baseline, 24px mobile menu and empty-state illustrations.
- An icon-only control always has an accessible name and tooltip. An unfamiliar or consequential action uses icon **and** text.
- Icons support labels; they never encode permission, business state, or confirmation meaning by themselves.

### Motion

_Timings extended by the 2026-10-12 update above (`.panel-rise`, `.progress-grow`, global reduced motion)._

- **Approach:** Minimal-functional.
- Hover/focus feedback: 100–150ms ease-out, color/border/background only.
- Menus, drawers, dialogs: 150–200ms opacity and short transform transition.
- Never use decorative animation, elastic motion, page-entry choreography, or scale-on-click as a normal interaction pattern.
- Respect `prefers-reduced-motion`: remove transform motion and retain immediate state feedback.

## Application shell

### Global layout

- Desktop sidebar baseline is **240px**.
- Top bar baseline is **64px**.
- Main content begins with the page header and is constrained to 1600px only where a wide operational table benefits. Content should not be artificially narrowed into dashboard cards.
- The shell background is `--surface-canvas`; pages and tables use `--surface-base` purposefully, not as a card around every section.
- No global academic-year label or selector. Route-owned academic-year context appears only where trustworthy feature data already exists.

### Locked Direction C shell architecture

This is the approved application-shell architecture for the redesign. It does not change routes, permissions, or the business meaning of navigation.

| Context | Locked shell behavior |
| --- | --- |
| Desktop | A 240px primary-domain sidebar, a 64px top bar, and contextual horizontal module navigation for the active domain. |
| Tablet | A 72px collapsed icon rail and contextual module navigation with horizontal overflow behavior. |
| Mobile | A compact top bar, primary-navigation drawer, and an active-domain module selector. No bottom navigation is introduced. |

The shell maximizes practical workspace for operational tables and forms. It contains only real route context, notifications, and the existing user-menu utility; it never adds fake search, calendar, or global academic-year controls.

### Navigation planes

The following planes have separate purpose, semantics, and visual hierarchy. They must never be styled or implemented as interchangeable controls.

1. **Primary domain navigation** identifies the top-level approved IA domains in `docs/redesign/INFORMATION_ARCHITECTURE.md`.
2. **Contextual module navigation** exposes permission-visible, existing route links within the current primary domain.
3. **Page-level tabs** are feature-owned views inside the current page or detail workflow. They do not select a domain or module.

Primary-domain navigation is persistent shell navigation. Contextual module navigation is a compact horizontal route list below the top bar. Page-level tabs sit inside the page work area, below the `PageHeader`, only where an existing feature already has views to switch between. Only true page-level view switching uses tab semantics; module navigation uses ordinary links.

### Domain route resolution

- Selecting a primary domain navigates to its **first permission-visible existing child module** in approved IA order.
- The shell creates no parent-domain landing route and no static fallback route.
- A domain with zero permission-visible child modules is hidden.
- Existing navigation configuration remains the source of route order and visibility. This presentation behavior must not create a second permission registry or authorization decision.
- The active domain is derived from the current route. The shell must not permit a displayed contextual domain to disagree with the current route.

### Contextual module strip

- Render the strip as a semantic `<nav>` with an accessible label that identifies its domain, for example `Mô-đun trong Tài chính`.
- Render only existing, permission-visible route links from the active domain. It has no synthetic module, action, or route.
- The current link uses `aria-current="page"`. Nested routes retain their owning module’s active state without changing route meaning: `/classes/academic-years` remains under the Classes module; `/settings/users` and `/settings/permissions` remain under the Settings module.
- The strip is route navigation, never a `tablist` and never visually competes with feature-owned page tabs.
- On desktop, links stay on one line and do not wrap. When they do not fit, the strip scrolls horizontally instead of compressing labels or changing hierarchy.
- When overflow exists, show labelled previous/next scroll controls only while they are useful. They perform real scrolling, expose their purpose, and are absent or disabled when no further scroll is possible.
- A focused or active module link scrolls into view. Native pointer, wheel, touch, and keyboard access must remain available.
- Omit the strip when the active domain has only one permission-visible module; do not add redundant chrome.

### Mobile module selector

- The selector exposes the real permission-visible module routes for the active domain; it is not a fake or non-functional select.
- Its accessible name identifies the domain, for example `Chuyển mô-đun trong Tài chính`.
- It supports ordinary keyboard navigation, Escape dismissal, and focus restoration to its trigger when closed.
- Selecting a module follows its existing route. It does not manufacture cross-module filtering, global context, or new state.

### Sidebar

- Group navigation as approved in `docs/redesign/INFORMATION_ARCHITECTURE.md`; preserve every URL and permission code.
- Brand area is simple wordmark/mark treatment. Replace the current text-initial logo treatment with a restrained presentation, not an invented brand feature.
- Each navigation item is 44px high, 20px icon plus label, with 8px gap and 8px horizontal inset. Active treatment uses a quiet active surface plus a 3px left indicator; it does not depend on a colored icon tile.
- Section labels are small, muted, sentence case or restrained uppercase. They separate real groups, not every few links.
- The collapsed rail uses Lucide icons with accessible labels/tooltips. It does not use text initials.
- Tablet (768–1279px) uses the locked 72px compact rail; mobile uses the same primary navigation in an off-canvas drawer.
- Every icon-only navigation control has a programmatic accessible name, a visible focus state, and a tooltip on both hover and keyboard focus. The tooltip supplements, and never supplies, the accessible name.

### Topbar

- Contains: mobile menu, optional sidebar toggle, context supplied by the current route when useful, notifications, and user menu.
- Notifications remain a top-bar utility and retain their existing route/data behavior.
- Remove the fake search and fake calendar affordances. Do not replace them with functionality in this program.
- Do not use translucent glass or permanent decorative blur. A solid base surface with a bottom border is the default.

## Page hierarchy and operational patterns

### PageHeader

A `PageHeader` is a compact structural region, not a hero.

- Left: title, optional one-line route-owned context, then concise descriptive/support text only when it helps the next decision.
- Right: one primary action maximum, then secondary actions. Action visibility is supplied by the feature.
- The top bar shows the real-route breadcrumb (domain when it has a module strip, then the current module) on every route in the navigation; detail/edit pages may add the record level. A breadcrumb never substitutes for a page title.
- Put record status adjacent to the title, not detached in a metric strip.
- On narrow screens, title/context comes first and action controls wrap below in source order.

### PageActionBar

- Use directly below the header or immediately above the work area only when a persistent set of existing actions requires it.
- Primary action: solid `--action-primary` (moss since the 2026-10-12 update), labelled, optionally paired with a 18px Lucide icon.
- Secondary action: outlined or quiet. Tertiary action: text/ghost.
- Never use a danger fill as the page primary action. Consequential actions remain in their feature-owned panel or dialog.
- Buttons may be disabled only with a nearby explanation supplied by the feature when users need to understand why.

### FilterBar

- Filters are one compact operational region, aligned with the table they control. They are not a second page header or a set of decorative cards.
- Desktop order: search first, high-frequency select filters next, lower-frequency filters next, then clear/reset only when state is active. The result count belongs in table metadata or the header, not a pill competing with page status.
- Use labels above controls on wide layouts. Do not rely on placeholder-only fields.
- On mobile, show a labelled Filter control that opens a sheet/drawer with the same controls and active-filter count. Preserve values and URL-backed client view state.
- URL search params are view state only: preserve existing full-directory reads, client-side filtering, pagination semantics, and permission scope.

### DataTableFrame

- Table wrapper: `--surface-base`, 1px `--border-subtle`, `--radius-lg` (12px since the 2026-10-12 update), `--panel-shadow`.
- Header: 36–40px, `--table-header`, 12px/600. It is visually quieter than data rows but never too faint to scan.
- Rows: 48px default; 56px only for a useful secondary line. Use a single bottom border. Hover uses `--table-row-hover`; selected uses `--table-row-selected`.
- The primary identifying field is left-aligned and visually strongest. Codes, dates, and financial/session values use tabular figures; financial and numeric columns align right.
- Sticky header is used for long in-page operational tables. Sticky first column is used only when the record identity would otherwise be lost during necessary horizontal scrolling.
- Row actions stay in a right-aligned narrow column. Familiar low-risk actions may be icon-only with an accessible name; consequential actions are labelled or live in a feature-owned menu/panel.
- Empty, loading, error, and permission states occupy the table frame rather than abruptly changing page geometry.
- Do not make every cell clickable. A row may have one clear detail link; nested controls retain their own event target and keyboard access.
- Use `DataTableFrame` only while the required columns retain readable semantic typography, useful labels, and operable actions in the available container width. Never solve insufficient width with tiny type or forced unusable columns.

### ResponsiveRecordList

- Data presentation changes by available container width and the readable-column requirements of the feature, not by device labels alone. A feature may use a table at one width and a record list at another without changing data, permissions, routes, or actions.
- Use `ResponsiveRecordList` when `DataTableFrame` cannot preserve the required columns safely. The current 1024px Students shell scenario lacks enough safe width for the approved Students columns and therefore uses `ResponsiveRecordList`; 1024px is not a universal switching condition.
- A record is a compact bordered **record strip**, not a stack of heavily padded cards: identity and a visible textual status first, one or two essential metadata lines next, and one clear record action with appropriate tap targets.
- Do not nest a rounded inner information card inside every record strip. Use dividers and aligned label/value pairs instead.
- Keep actions at the bottom in source order. Use full-width controls only for a single primary record action on narrow screens.
- Exception: a record strip may carry one row "…" menu beside it (`RecordListItem` `trailing`, outside the record link and after it in source order; `ActionMenu` `align="end"` keeps the panel on screen). The class roster uses it for Chuyển lớp / Bảo lưu, as in design 03. Owner-approved for the Stumana redesign step 5b (v0.9.0.0).

## Forms and detail pages

### Form conventions

- Forms use an 8- or 12-column grid on desktop and one column on mobile. Common fields are two columns at tablet/desktop only when label and error copy have room.
- Group existing fields into `FormSection`s with a section title and a brief feature-owned explanation where needed. Do not invent fields or rearrange a workflow in a way that changes validation expectations.
- Standard control is 40px high on desktop with `--radius-md` (10px since the 2026-10-12 update). Textareas have a defined minimum height and resize behavior appropriate to the existing feature.
- Labels remain visible. Required, help, error, pending, disabled, and stale/conflict states must be communicated with text as well as color/border treatment.
- Form actions follow the existing feature’s binding and confirmation semantics. On long forms, use a sticky action area only if the current workflow benefits and it does not hide validation feedback.
- Mobile form save/cancel actions may become a safe-area-aware bottom action bar. They must preserve keyboard visibility and existing unsaved-change behavior.
- Settings forms save through `StickySaveBar` (`components/patterns/sticky-save-bar.tsx`, design 09a/17a): fixed to the bottom of the content column (left edge = rail/sidebar width), always visible for people who can save and absent for read-only viewers. Clean: grey dot, "Chưa có thay đổi", save disabled with that text as its reason. Dirty: warning dot, "n thay đổi chưa lưu", the changed field names, Hủy (restores the last saved values) and the page's single primary. Save errors render as a danger `ResultBanner` directly above the bar and keep typed values. The bar renders an in-flow spacer that follows its measured height (96px fallback before measuring or without ResizeObserver) and publishes that height as `--save-bar-h` on `<html>` (the install prompt adds it to its bottom offset); pages add no bottom padding of their own. The bar's background spans the content column while its contents sit in the same 1600px column and side padding as `<main>`. It stacks at z-[41]: above the install prompt (z-40), below the mobile drawer and dialogs. While dirty, `useLeaveGuard(dirty, onDiscard)` adds a `beforeunload` prompt, and links inside the hub that would leave a dirty form use `GuardedLink`/`useGuardedNavigation` (the table of contents included): they ask "Thay đổi chưa lưu sẽ mất" in the one dialog hosted by `LeaveGuardProvider` (outside page content), and "Rời trang" discards the draft (the form's Hủy) before navigating; while a save is in flight `beforeunload` still prompts (`useSaveInFlightGuard`) and hub links pass through, except the multi-role permission save, which asks "Đang lưu phân quyền" and whose "Vẫn rời trang" leaves without discarding.

### Detail pages

- Detail header establishes record identity, key route-owned context, current status, and existing available actions.
- Use a two-column detail composition where helpful: a narrow context/summary column and a primary operational work area. Collapse to one column on smaller screens.
- Reuse existing student tabs without changing their data/access rules. The visual system gives the active tab a clear base surface/underline treatment and preserves horizontal tab scrolling on small screens.
- Classes show schedule/status context beside the record identity, not inside unrelated global controls.
- Sessions are an operational workbench: header → lifecycle state/action panel → compact readiness summary → Attendance → Results → Lock. This order follows the real workflow and makes lock blockers visible before the irreversible action.

## Guarded, destructive, and stateful actions

### GuardedActionPanel presentation

- A feature supplies whether an action is available and why. The presentation shell shows the operation title, consequence, feature-owned prerequisites/blockers, pending state, action result, and optional confirmation control.
- A blocked action appears disabled with a visible reason, not merely as a missing button when the user needs to understand the workflow.
- Pending actions retain their label with a progress indicator, prevent duplicate submission, and do not imply completion before the Server Action/RPC result returns.
- Success, error, stale, and conflict results are shown close to the action that produced them. They do not become anonymous global toasts with lost context.

### Destructive and irreversible actions

- Danger uses the danger semantic family, explicit consequence text, and a visually distinct boundary. It is never styled as an ordinary secondary button.
- Confirmation meaning, wording, inputs, and Server Action binding remain feature-owned. Shared UI only provides the dialog/panel, pending, success, error, conflict, disabled, and destructive visual states.
- Session Lock is the reference: show its completed/unlocked state, attendance and results readiness, missing blockers, the permanent/immutable consequence, the existing feature-owned reason/confirmation, and the returned result. Never use icon/color alone to imply its permanence.

### Status badges

_Badge shape superseded by the 2026-10-12 update above (radius-sm, 12px/500, padding 3/9, `-ink` text); the text, icon, and feature-ownership rules below still apply._

- Badge shape is 4px radius, 12px/600, compact horizontal padding, and a semantic soft surface with foreground and optional border. It is not a default pill.
- Every badge contains readable text. An optional 14–16px icon may reinforce familiar meaning but is never sufficient alone.
- Feature code supplies domain wording and tone. Do not centralize `scheduled`, `in_progress`, `completed`, `locked`, `cancelled`, student enrollment, finance, or permission mapping in a shared badge.
- Use status badges for state, not every taxonomy field. Mode, grade, and ordinary metadata use quiet text or a neutral compact token only when scanning benefits.

## Shared presentation states

| State | Presentation rule |
| --- | --- |
| Loading | Use a layout-shaped skeleton for tables, detail header, and form sections. Avoid a full-page spinner except a short initial route transition. Preserve final geometry. |
| Empty | Use a 24px Lucide icon, direct Vietnamese title, one concise explanation, and a feature-owned next action only when permitted. No illustration, confetti, or generic encouragement. |
| Error | Use danger surface/border with a clear plain-language message. A retry action appears only when the feature can safely retry. Preserve any detailed conflict information supplied by the feature. |
| Permission denied | Use a neutral or warning presentation stating that access is unavailable. Do not imply the user can request/override access unless such a workflow already exists. |
| Result banner | Inline near the action or at the top of its work area. Success, warning, error, stale, and conflict presentation is standardized; feature-owned copy and remediation stay local. |

## Responsive behavior

| Breakpoint | Shell | Page content | Operations |
| --- | --- | --- | --- |
| Desktop ≥1280px | 240px sidebar; 64px topbar. | Wide tables and two-column details where useful. | Inline filters, labelled actions, compact summaries. |
| Tablet 768–1279px | Locked 72px icon rail; contextual module strip scrolls horizontally when required. | Tables convert to record lists when available container width cannot safely preserve columns. | Page actions wrap; filters use two-column grid or sheet. |
| Mobile <768px | Compact topbar + off-canvas primary navigation drawer + active-domain module selector. No bottom navigation is introduced. | One column, 16px page padding, record strips, horizontally scrollable existing page tabs. | 44px targets; action hierarchy preserved; destructive panels never compress consequence text. |

Responsive behavior changes layout, not data availability, permissions, route access, workflow order, action meaning, or filtering/pagination semantics.

## Accessibility and focus behavior

- Meet WCAG AA contrast for text and meaningful controls. Semantic soft surfaces must be paired with a sufficiently dark foreground.
- Keyboard focus is always visible: 2px `--border-focus` plus 3px `--focus-ring` outer halo, with enough offset to remain visible against adjacent borders.
- Keyboard traversal follows the structural order: primary navigation → top-bar utilities → contextual module navigation → page header/actions → filters → page content. Visual wrapping must not change this source order.
- Interactive targets are at least 40px on desktop and 44px when touch is likely. Compact table actions may be 32px only in a desktop-only, labelled/tooltip-backed context.
- Inputs expose visible label, required state, help, validation error, and disabled reason through accessible text/relationships.
- Transient overlays, including dialogs, drawers, selectors, and menus, trap focus when modal, support their applicable dismissal behavior, and restore focus to their invoker on close. Escape dismissal is supported unless the existing feature’s workflow explicitly requires a different safety behavior. Initial focus lands on the title or first actionable field without surprising screen-reader users.
- Status, permission, error, and destructive states use text plus semantic treatment. Never use color, position, tooltip, or icon as the sole signal.
- Respect reduced-motion preference and maintain logical source order when controls wrap on small screens.

## Reference workflow rules

### Students

- Directory emphasizes name, code, active class/enrollment state, primary guardian contact, and lifecycle status. Filters are URL-backed view state but retain current client filtering and pagination.
- Detail header makes student identity and enrollment status easy to scan; existing enrollment, transfer, reserve, and resume surfaces remain feature-owned.
- Duplicate warnings appear in the existing form flow as actionable, readable warnings, not global alerts.

### Classes

- Directory emphasizes class code/name, academic-year context, grade/level/mode, schedule presence, and status. Academic year is a route/read-model field, never a global shell control.
- Detail makes class status and schedule context prominent before secondary metadata. Existing class status and schedule actions retain their own permissions, errors, confirmation meaning, and RPC binding.

### Sessions

- Directory makes date, time, class, status, session kind, and lock state scannable. Summary counts are compact operational context, not oversized KPI tiles.
- Detail keeps lifecycle status next to the session title. Lifecycle action feedback remains adjacent to the action.

### Attendance / Results / Lock

- Attendance and results are work areas inside the Session detail route, not navigation destinations.
- Participant rows preserve identity, roster/enrollment context, attendance/result state, and feature-owned editable controls.
- The lock area follows attendance/results and clearly presents readiness. If blocked, show the existing blockers. If available, show the irreversible consequence before the feature-owned confirmation.

## Implementation guardrails

- This document directs Wave 1+ presentation work only. It authorizes no route, permission, action, RPC, schema, RLS, RBAC, audit, state-machine, server filtering, or pagination change. Changes the owner approved separately are recorded in `docs/redesign/WORKFLOW_CONTRACTS_A_E.md` (for example v0.8.0.0: class-page bulk cancel and enrolment search).
- `components/ui` implements domain-agnostic tokens/primitives; `components/shared` presents generic loading/empty/error/permission/result/pending states; `components/patterns` composes reusable page and operational presentation. Features keep all domain behavior.
- New pattern primitives require two real workflow uses or an approved contractual need.
- Dev preview routes (`/dev/ui`, `/dev/shell`, `/dev/lists`, `/dev/session`, `/dev/student`, `/dev/class`, `/dev/dashboard`, `/dev/tuition`, `/dev/sepay`, `/dev/payroll`, `/dev/settings`, `/dev/crm`) skip sign-in for GET/HEAD only, and only outside production, and use fixture data; see the 2026-10-12 update at the top.
- Preserve non-A–E visual debt until its feature enters a later approved wave, except for the smallest compatibility fix required by the global typography foundation.

## Decisions log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-09 | Light, deep-navy operational system with Be Vietnam Pro. | Preserves the strongest recognizable reference traits while serving Vietnamese, data-heavy daily work. |
| 2026-08-09 | Tight 4/6/8/12px shape scale and border-led surfaces. | Avoids decorative cards, excessive pills, and shadow-heavy dashboard styling. |
| 2026-08-09 | Sessions detail is the A–E reference workbench. | Attendance, results, and lock are state-dependent work within the existing Session route. |
| 2026-08-09 | Semantic visual states are shared; policy and action meaning remain feature-owned. | Protects the approved permission/RPC/workflow boundaries while making outcomes consistent. |
| 2026-10-12 | Adopt the Stumana-style handoff: moss `#4F6B5A` accent, warm `#FAF9F6` canvas, light 240px sidebar with 3px indicator, 6/10/12/16 radii (`data-erp-rounded="false"` restores 4/6/8/12), 12px/500 badges with `-ink` tokens, danger `#BE123C`, 240ms `.panel-rise` (tablet+) and 800ms `.progress-grow`. | Owner-approved redesign supersedes the 2026-09-09 terracotta update and the navy anchor for color, radius, badge, and motion; structure, permissions, density, and semantic families are unchanged. |
