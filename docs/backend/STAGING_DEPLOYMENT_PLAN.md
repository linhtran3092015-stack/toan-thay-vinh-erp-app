# Staging Deployment Blueprint & Governance Plan

This document establishes the architecture, environment contracts, and governance rules for deploying the ERP application to the **STAGING** environment.

---

## 1. Environment Matrix

| Environment | Purpose | Supabase Project Name | Supabase Project Ref | Hosting Target | Data Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LOCAL** | Local development | Docker local instance | N/A (Docker container) | `localhost:3000` | Local seeds / synthetic data |
| **DEV** | Development sandbox | `ttv-erp-dev` | `tsihernwjunagrmvdqyb` | Local / Preview | Development sandbox data |
| **STAGING** | Staging UAT | `ttv-erp-staging` | `kdscaoudnxekytfvqotf` | **Vercel** | **Synthetic staging data only** |
| **PRODUCTION** | Live operations | *Not provisioned in STG-1* | *Ref unknown / unassigned* | *Not provisioned in STG-1* | Live operational data |

### Staging Specifications:
* **Project Name:** `ttv-erp-staging`
* **Project Reference:** `kdscaoudnxekytfvqotf`
* **Supabase API URL:** `https://kdscaoudnxekytfvqotf.supabase.co`
* **Geographic Region:** `ap-southeast-1` (Singapore)
* **Hosted Database Engine:** PostgreSQL 17
* **Frontend Target:** Vercel

---

## 2. PostgreSQL Engine Version Contract

* **Local Engine:** PostgreSQL 15.6 (local Docker container)
* **Hosted Staging Engine:** PostgreSQL 17 (`db.kdscaoudnxekytfvqotf.supabase.co`)

> [!IMPORTANT]
> Local validation on PostgreSQL 15.6 does **NOT** guarantee PostgreSQL 17 compatibility. In STG-2, the full repository migration chain and pgTAP test suite must be validated directly against PostgreSQL 17 on STAGING using `supabase test db --linked`.

---

## 3. Hosted `pg_cron` Contract

Local database initialization uses `supabase/roles.sql` (`create extension if not exists pg_cron;`) during container setup. However, `supabase db push` does **NOT** execute `roles.sql` or automatically enable `pg_cron` on hosted Supabase instances.

### STG-2 Pre-Migration Requirement:
Before applying cron-dependent migrations (e.g., `20260728155000_timekeeping_auto_end_cron.sql`), the operator or migration runner must explicitly enable `pg_cron` in the hosted Supabase Dashboard / SQL Editor and verify:

```sql
select extname, extversion
from pg_catalog.pg_extension
where extname = 'pg_cron';
```
*Expected output: Exactly 1 row confirming `pg_cron` is installed.*

### Timekeeping Cron Contract:
* **Job Name:** `timekeeping-auto-end-teaching-assistants`
* **Schedule:** `30 16 * * *` (16:30 UTC / 23:30 Asia/Ho_Chi_Minh)
* **Command:** `select public.auto_end_stale_teaching_assistant_time_entries();`
* **Active State:** `true`

---

## 4. Hosted Database Test Contract

Commands such as `npm run test:db` and `supabase test db` target the **LOCAL** database container by default.

For STG-2 validation against hosted Staging:
* The repository must be explicitly linked to `kdscaoudnxekytfvqotf`.
* Preflight check `npm run staging:preflight` must return **PASS**.
* The test command must explicitly run:
  ```bash
  supabase test db --linked
  ```
* Operator approval must be obtained prior to execution.

---

## 5. Forward-Only Migration Deployment Contract

* **Repository Migration Head:** `20260811113000` ([20260811113000_harden_payment_request_unit_price_authority.sql](file:///Users/linhtran/Documents/ERP-Toan-Thay-Vinh/toan-thay-vinh-erp-app/supabase/migrations/20260811113000_harden_payment_request_unit_price_authority.sql))
* All 68 repository migrations must be applied sequentially.
* **Prohibited:**
  * Skipping migrations.
  * Repairing migration history (`supabase migration repair`) to mask errors.
  * Marking failed migrations as applied.
  * Editing landed migrations.
* **Failure Handling:** If a migration fails on PostgreSQL 17, STOP immediately, capture the exact failure error message, classify severity, and propose a forward-only fix migration.

---

## 6. Target Isolation & Preflight Verification

Before STG-2 can mutate remote database state, the preflight utility (`npm run staging:preflight`) must confirm:
1. `TARGET_ENV` is explicitly set to `staging`.
2. Actual linked Supabase project ref in `supabase/.temp/linked-project.json` matches `kdscaoudnxekytfvqotf`.
3. Actual linked ref is **NOT** DEV ref (`tsihernwjunagrmvdqyb`).
4. Derived hostname matches `kdscaoudnxekytfvqotf.supabase.co`.

> [!WARNING]
> A `PASS` verdict from `npm run staging:preflight` indicates safety readiness only; it does **NOT** authorize database mutations. Explicit operator approval is required for each phase (linking, migration push, test execution).

---

## 7. Frontend Target & OAuth Boundaries

### Vercel Hosting Boundary (STG-3):
* Vercel is the designated staging frontend provider.
* No Vercel deployment, project creation, or domain assignment occurs in STG-1 or STG-2. STG-3 owns frontend staging deployment.

### OAuth Architecture Boundary:
* **Google Cloud OAuth Redirect URI:** `https://kdscaoudnxekytfvqotf.supabase.co/auth/v1/callback`
* **App Callback Route:** `https://<STAGING_APP_DOMAIN>/auth/callback`
* OAuth credentials and client secrets must never be placed in Git or documentation files.

---

## 8. Data Governance Policy

* **SYNTHETIC DATA ONLY.**
* Absolute prohibition against copying real student records, guardian phone numbers, tuition fee payments, staff salary rates, or real parent contact info to staging.
* STG-4 will generate isolated synthetic fixture datasets for UAT testing.
