-- TOÁN THẦY VINH ERP — SUPABASE SCHEMA v0.1
-- Foundation for staging. Review and split into timestamped migrations before production.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- ORGANIZATION, AUTH, PERMISSION
-- =========================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code citext not null,
  wifi_ssids text[] not null default '{}',
  latitude numeric(10,7),
  longitude numeric(10,7),
  allowed_radius_m integer,
  is_active boolean not null default true,
  unique (organization_id, code)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  check (end_date > start_date),
  unique (organization_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  mfa_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id),
  status text not null default 'active'
    check (status in ('invited','active','temporarily_inactive','locked','left')),
  unique (organization_id, profile_id)
);

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email citext not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  code citext not null,
  name text not null,
  is_system boolean not null default false,
  unique (organization_id, code)
);

create table public.permissions (
  code citext primary key,
  name text not null,
  module text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code citext not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table public.membership_roles (
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

create table public.membership_permission_overrides (
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  permission_code citext not null references public.permissions(code),
  effect text not null check (effect in ('allow','deny')),
  primary key (membership_id, permission_code)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_profile_id uuid references public.profiles(id),
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index audit_logs_org_time_idx
on public.audit_logs (organization_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  recipient_membership_id uuid references public.organization_memberships(id),
  recipient_permission_code citext references public.permissions(code),
  type text not null,
  title text not null,
  body text,
  action_url text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- STUDENTS, GUARDIANS, CRM
-- =========================================================

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  full_name text not null,
  phone text not null,
  normalized_phone text not null,
  zalo text,
  email citext,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guardians_phone_idx
on public.guardians (organization_id, normalized_phone);

create trigger guardians_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code citext not null,
  name text not null,
  participates_in_round_robin boolean not null default true,
  is_active boolean not null default true,
  unique (organization_id, code)
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code citext not null,
  name text not null,
  is_active boolean not null default true,
  unique (organization_id, code)
);

create sequence if not exists public.student_public_code_seq start 1;

create or replace function public.next_student_public_code(p_year integer)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.student_public_code_seq');
  return 'TV-' || p_year::text || '-' || lpad(n::text, 5, '0');
end;
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  public_code citext,
  full_name text not null,
  nickname text,
  birth_year integer not null,
  province_city text,
  current_grade smallint check (current_grade between 1 and 12),
  lifecycle_status text not null default 'interested'
    check (lifecycle_status in (
      'interested','trial_booked','trial_completed',
      'pending_enrollment_confirmation','active','reserved',
      'resumed','waiting_class','completed'
    )),
  learning_level text check (learning_level in ('A','B','CLC')),
  registered_mode text check (registered_mode in ('online','offline')),
  official_start_date date,
  learning_goal text,
  internal_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, public_code)
);

create trigger students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  primary key (student_id, guardian_id)
);

create unique index one_primary_guardian_per_student
on public.student_guardians (student_id)
where is_primary;

create table public.student_acquisitions (
  student_id uuid primary key references public.students(id) on delete cascade,
  source_id uuid references public.lead_sources(id),
  partner_id uuid references public.partners(id),
  sale_closer_membership_id uuid references public.organization_memberships(id),
  source_confirmed_by uuid references public.profiles(id),
  source_confirmed_at timestamptz,
  sale_locked_at timestamptz
);

create table public.communication_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  platform text not null default 'zalo',
  group_name text,
  group_url text,
  status text not null default 'pending'
    check (status in ('pending','created','not_required')),
  created_by_membership_id uuid references public.organization_memberships(id),
  created_on date,
  notes text,
  unique (student_id, platform)
);

create table public.crm_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null unique references public.students(id),
  assigned_sale_membership_id uuid references public.organization_memberships(id),
  stage text not null default 'new'
    check (stage in (
      'new','unreachable','contacted','consulting',
      'trial_booked','trial_completed','post_trial_followup',
      'payment_committed','paid_pending_confirmation',
      'enrollment_confirmation','converted','no_need',
      'follow_up_later','chose_other_center',
      'schedule_not_suitable','fee_not_suitable','duplicate'
    )),
  next_follow_up_at timestamptz,
  last_activity_at timestamptz,
  is_reactivated boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_cases_updated_at
before update on public.crm_cases
for each row execute function public.set_updated_at();

create table public.crm_assignment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  crm_case_id uuid not null references public.crm_cases(id),
  from_sale_membership_id uuid references public.organization_memberships(id),
  to_sale_membership_id uuid references public.organization_memberships(id),
  transferred_by uuid references public.profiles(id),
  transferred_at timestamptz not null default now(),
  note text
);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  crm_case_id uuid not null references public.crm_cases(id),
  actor_membership_id uuid not null references public.organization_memberships(id),
  new_stage text,
  short_note text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  crm_case_id uuid not null references public.crm_cases(id),
  assigned_membership_id uuid not null references public.organization_memberships(id),
  task_type text not null,
  due_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open','done','cancelled','overdue')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- CLASSES, SESSIONS, ATTENDANCE, RESULTS
-- =========================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  academic_year_id uuid not null references public.academic_years(id),
  code citext not null,
  name text not null,
  grade smallint not null check (grade between 1 and 12),
  level text not null check (level in ('A','B','CLC')),
  classin_url text,
  status text not null default 'active'
    check (status in ('draft','active','closed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, academic_year_id, code)
);

create trigger classes_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create table public.class_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  class_id uuid not null references public.classes(id),
  component_code text,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  learning_mode text check (learning_mode in ('online','offline','hybrid')),
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  check (end_time > start_time)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  class_id uuid not null references public.classes(id),
  schedule_template_id uuid references public.class_schedule_templates(id),
  session_number integer not null,
  week_number integer,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  topic text,
  lesson_number text,
  status text not null default 'scheduled'
    check (status in (
      'scheduled','in_progress','attendance_completed',
      'locked','cancelled','rescheduled','interrupted'
    )),
  replaces_session_id uuid references public.class_sessions(id),
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  cancellation_reason text,
  unique (class_id, session_number),
  check (ends_at > starts_at)
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  class_id uuid not null references public.classes(id),
  registered_mode text not null check (registered_mode in ('online','offline')),
  status text not null default 'active'
    check (status in ('active','transferred','reserved','completed')),
  effective_from date not null,
  effective_to date,
  change_reason text
);

create unique index one_active_enrollment_per_student
on public.student_enrollments (student_id)
where status = 'active' and effective_to is null;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  class_session_id uuid not null references public.class_sessions(id),
  student_id uuid not null references public.students(id),
  attendance_kind text not null default 'main'
    check (attendance_kind in ('main','additional')),
  status text not null
    check (status in (
      'present','excused_absence',
      'unexcused_absence','additional_study'
    )),
  actual_mode text check (actual_mode in ('online','offline')),
  short_note text,
  marked_by uuid references public.profiles(id),
  marked_at timestamptz not null default now(),
  is_late_update boolean not null default false,
  unique (class_session_id, student_id)
);

create table public.session_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  class_session_id uuid not null references public.class_sessions(id),
  student_id uuid not null references public.students(id),
  end_test_status text not null default 'not_submitted'
    check (end_test_status in (
      'scored','not_submitted','exempt','not_applicable_absent'
    )),
  end_test_score numeric(4,2),
  notebook_status text not null default 'not_submitted'
    check (notebook_status in (
      'scored','not_submitted','exempt','not_applicable_absent'
    )),
  notebook_score numeric(4,2),
  comment text,
  first_scored_by_membership_id uuid references public.organization_memberships(id),
  first_scored_at timestamptz,
  unique (class_session_id, student_id),
  check (end_test_score is null or end_test_score between 0 and 10),
  check (notebook_score is null or notebook_score between 0 and 10)
);

create table public.student_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  alert_type text not null
    check (alert_type in (
      'two_consecutive_absences',
      'two_consecutive_low_scores',
      'score_drop',
      'zero_sessions',
      'negative_sessions'
    )),
  severity text not null default 'warning'
    check (severity in ('info','warning','critical')),
  title text not null,
  detail jsonb,
  status text not null default 'open'
    check (status in ('open','acknowledged','resolved','dismissed')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.coaching_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  assigned_assistant_membership_id uuid not null references public.organization_memberships(id),
  title text not null,
  reason text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','monitoring','improved','not_improved','completed')),
  form_data jsonb not null default '{}'::jsonb,
  review_on date,
  result_summary text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  crm_case_id uuid not null references public.crm_cases(id),
  class_session_id uuid not null references public.class_sessions(id),
  booked_by_membership_id uuid not null references public.organization_memberships(id),
  learning_mode text not null check (learning_mode in ('online','offline')),
  status text not null default 'booked'
    check (status in (
      'booked','parent_confirmed','attended',
      'no_show','reschedule_requested','cancelled'
    )),
  official_class_id uuid references public.classes(id)
);

-- =========================================================
-- FINANCE AND SESSION LEDGER
-- =========================================================

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purpose text not null
    check (purpose in ('new_enrollment','renewal','expense','other')),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  is_active boolean not null default true,
  unique (organization_id, bank_name, account_number)
);

create table public.fee_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code citext not null,
  name text not null,
  learning_mode text not null check (learning_mode in ('online','offline')),
  region_category text,
  standard_price_per_session bigint not null,
  effective_from date not null,
  effective_to date,
  unique (organization_id, code, effective_from)
);

create table public.student_fee_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  fee_policy_id uuid references public.fee_policies(id),
  agreed_price_per_session bigint not null,
  effective_from date not null,
  effective_to date,
  note text
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  request_type text not null check (request_type in ('new_enrollment','renewal')),
  bank_account_id uuid not null references public.bank_accounts(id),
  requested_amount bigint not null check (requested_amount > 0),
  transfer_content text not null,
  expected_sessions integer,
  expected_bonus_sessions integer not null default 0,
  status text not null default 'pending'
    check (status in (
      'pending','sent','partially_paid',
      'paid_pending_confirmation','completed',
      'cancelled','expired'
    )),
  created_by_membership_id uuid not null references public.organization_memberships(id),
  created_at timestamptz not null default now()
);

create table public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  external_transaction_id text not null,
  bank_account_id uuid references public.bank_accounts(id),
  occurred_at timestamptz not null,
  amount bigint not null check (amount > 0),
  transfer_content text,
  sender_name text,
  sender_account text,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'unidentified'
    check (status in (
      'unidentified','suggested','awaiting_allocation',
      'awaiting_accountant_confirmation','completed',
      'adjusted','duplicate','invalid'
    )),
  received_at timestamptz not null default now(),
  unique (organization_id, external_transaction_id)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  transaction_id uuid not null references public.sepay_transactions(id),
  student_id uuid not null references public.students(id),
  fee_agreement_id uuid references public.student_fee_agreements(id),
  allocated_amount bigint not null check (allocated_amount > 0),
  paid_sessions integer not null check (paid_sessions >= 0),
  bonus_sessions integer not null default 0 check (bonus_sessions >= 0),
  actual_unit_price bigint,
  allocation_type text not null check (allocation_type in ('new_enrollment','renewal')),
  sale_closer_membership_id uuid references public.organization_memberships(id),
  source_id uuid references public.lead_sources(id),
  partner_id uuid references public.partners(id),
  assistant_confirmed_by uuid references public.profiles(id),
  accountant_confirmed_by uuid references public.profiles(id),
  status text not null default 'draft'
    check (status in (
      'draft','assistant_confirmed',
      'accountant_confirmed','posted','reversed'
    )),
  posted_at timestamptz,
  check (paid_sessions + bonus_sessions > 0)
);

create table public.session_credit_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  payment_allocation_id uuid not null unique references public.payment_allocations(id),
  paid_sessions integer not null,
  bonus_sessions integer not null default 0,
  actual_unit_price bigint not null,
  credited_at timestamptz not null default now()
);

create table public.session_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  entry_type text not null
    check (entry_type in (
      'payment_credit','bonus_credit','session_charge',
      'session_reversal','manual_adjustment',
      'transfer_out','transfer_in',
      'refund_debit','annual_carryover'
    )),
  delta_sessions integer not null check (delta_sessions <> 0),
  credit_lot_id uuid references public.session_credit_lots(id),
  class_session_id uuid references public.class_sessions(id),
  reference_type text,
  reference_id uuid,
  transfer_group_id uuid,
  unit_price_snapshot bigint,
  note text,
  created_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now()
);

create index ledger_student_time_idx
on public.session_ledger_entries (student_id, occurred_at, id);

create view public.student_session_balances
with (security_invoker = true)
as
select
  organization_id,
  student_id,
  coalesce(sum(delta_sessions), 0)::integer as balance_sessions
from public.session_ledger_entries
group by organization_id, student_id;

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id),
  requested_sessions integer not null check (requested_sessions > 0),
  calculated_amount bigint,
  approved_amount bigint,
  reason text not null,
  status text not null default 'assistant_requested'
    check (status in (
      'assistant_requested','accountant_checked',
      'owner_approved','paid','rejected','cancelled'
    )),
  requested_by uuid not null references public.profiles(id),
  accountant_checked_by uuid references public.profiles(id),
  owner_approved_by uuid references public.profiles(id),
  paid_at timestamptz,
  proof_drive_url text
);

create table public.refund_lines (
  id uuid primary key default gen_random_uuid(),
  refund_request_id uuid not null references public.refund_requests(id),
  credit_lot_id uuid not null references public.session_credit_lots(id),
  paid_sessions_refunded integer not null,
  unit_price bigint not null,
  amount bigint not null
);

create table public.commission_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_allocation_id uuid references public.payment_allocations(id),
  refund_request_id uuid references public.refund_requests(id),
  beneficiary_membership_id uuid references public.organization_memberships(id),
  beneficiary_partner_id uuid references public.partners(id),
  commission_type text not null
    check (commission_type in (
      'new_enrollment','renewal','clawback','adjustment'
    )),
  commissionable_amount bigint not null default 0,
  amount bigint not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'provisional'
    check (status in (
      'expected','provisional','official','paid','adjusted'
    ))
);

-- =========================================================
-- STAFF, TIMEKEEPING, PAYROLL
-- =========================================================

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null unique references public.organization_memberships(id),
  staff_code citext not null,
  primary_work_role text,
  work_mode text check (work_mode in ('online','offline','hybrid')),
  start_date date,
  employment_status text not null default 'active'
    check (employment_status in (
      'active','probation','temporary_leave',
      'resigned','collaboration_ended'
    )),
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  unique (organization_id, staff_code)
);

create table public.pay_rate_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  staff_profile_id uuid not null references public.staff_profiles(id),
  work_role text,
  offline_hourly_rate bigint not null,
  online_rate_ratio numeric(6,4) not null default 0.5,
  effective_from date not null,
  effective_to date
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  staff_profile_id uuid not null references public.staff_profiles(id),
  work_mode text not null check (work_mode in ('online','offline')),
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  total_minutes integer,
  check_in_latitude numeric(10,7),
  check_in_longitude numeric(10,7),
  wifi_ssid text,
  auto_ended boolean not null default false,
  status text not null default 'working'
    check (status in (
      'working','completed','forgot_clock',
      'pending_confirmation','adjusted','auto_ended'
    ))
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  year integer not null,
  month integer not null check (month between 1 and 12),
  period_start date not null,
  period_end date not null,
  close_due_on date,
  pay_due_on date,
  status text not null default 'draft'
    check (status in (
      'draft','employee_review','assistant_review',
      'accountant_review','owner_approved','paid','reopened'
    )),
  unique (organization_id, year, month)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payroll_period_id uuid not null references public.payroll_periods(id),
  staff_profile_id uuid not null references public.staff_profiles(id),
  gross_amount bigint not null default 0,
  advance_deduction bigint not null default 0,
  other_deduction bigint not null default 0,
  net_amount bigint not null default 0,
  status text not null default 'draft'
    check (status in (
      'draft','employee_checked','assistant_checked',
      'accountant_reconciled','owner_approved',
      'paid','adjusted'
    )),
  unique (payroll_period_id, staff_profile_id)
);

create table public.payroll_components (
  id uuid primary key default gen_random_uuid(),
  payroll_item_id uuid not null references public.payroll_items(id),
  component_type text not null,
  amount bigint not null,
  quantity numeric,
  unit_rate bigint,
  calculation_detail jsonb not null default '{}'::jsonb,
  source_entity_type text,
  source_entity_id uuid
);

create table public.advance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  staff_profile_id uuid not null references public.staff_profiles(id),
  requested_amount bigint not null,
  reason text,
  expected_income_snapshot bigint not null default 0,
  calculated_limit bigint not null default 0,
  approved_amount bigint,
  status text not null default 'requested'
    check (status in (
      'requested','assistant_checked',
      'owner_approved','paid','rejected','carried_forward'
    ))
);

create table public.grading_credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  class_session_id uuid not null references public.class_sessions(id),
  student_id uuid not null references public.students(id),
  grader_staff_profile_id uuid not null references public.staff_profiles(id),
  credited_at timestamptz not null default now(),
  is_late boolean not null default false,
  unique (class_session_id, student_id)
);

-- =========================================================
-- PERMISSION HELPERS AND RLS
-- =========================================================

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = p_org
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_permission(
  p_org uuid,
  p_permission citext
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with membership as (
    select id
    from public.organization_memberships
    where organization_id = p_org
      and profile_id = auth.uid()
      and status = 'active'
    limit 1
  ),
  override_effect as (
    select effect
    from public.membership_permission_overrides
    where membership_id = (select id from membership)
      and permission_code = p_permission
    limit 1
  )
  select case
    when exists (
      select 1 from override_effect where effect = 'deny'
    ) then false
    when exists (
      select 1 from override_effect where effect = 'allow'
    ) then true
    else exists (
      select 1
      from membership m
      join public.membership_roles mr
        on mr.membership_id = m.id
      join public.role_permissions rp
        on rp.role_id = mr.role_id
      where rp.permission_code = p_permission
    )
  end;
$$;

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.session_results enable row level security;
alter table public.crm_cases enable row level security;
alter table public.sepay_transactions enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.session_ledger_entries enable row level security;
alter table public.coaching_cases enable row level security;
alter table public.payroll_items enable row level security;
alter table public.audit_logs enable row level security;

create policy students_read
on public.students for select
using (public.has_permission(organization_id, 'students.view'));

create policy guardians_read
on public.guardians for select
using (public.has_permission(organization_id, 'guardians.view'));

create policy classes_read
on public.classes for select
using (public.has_permission(organization_id, 'classes.view'));

create policy sessions_read
on public.class_sessions for select
using (public.has_permission(organization_id, 'sessions.view'));

create policy attendance_read
on public.attendance_records for select
using (public.has_permission(organization_id, 'attendance.view'));

create policy attendance_write
on public.attendance_records for all
using (public.has_permission(organization_id, 'attendance.mark'))
with check (public.has_permission(organization_id, 'attendance.mark'));

create policy results_read
on public.session_results for select
using (public.has_permission(organization_id, 'results.view'));

create policy results_write
on public.session_results for all
using (public.has_permission(organization_id, 'results.enter'))
with check (public.has_permission(organization_id, 'results.enter'));

create policy crm_read
on public.crm_cases for select
using (public.has_permission(organization_id, 'crm.view'));

create policy sepay_read
on public.sepay_transactions for select
using (public.has_permission(organization_id, 'sepay.view'));

create policy ledger_read
on public.session_ledger_entries for select
using (public.has_permission(organization_id, 'session_ledger.view'));

create policy coaching_read
on public.coaching_cases for select
using (public.has_permission(organization_id, 'coaching.view'));

create policy payroll_read
on public.payroll_items for select
using (public.has_permission(organization_id, 'payroll.view'));

create policy audit_read
on public.audit_logs for select
using (public.has_permission(organization_id, 'audit.view'));

-- =========================================================
-- ATOMIC FUNCTIONS
-- =========================================================

create or replace function public.transfer_student_sessions(
  p_organization_id uuid,
  p_from_student_id uuid,
  p_to_student_id uuid,
  p_sessions integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid := gen_random_uuid();
begin
  if not public.has_permission(
    p_organization_id,
    'session_ledger.transfer'
  ) then
    raise exception 'PERMISSION_DENIED';
  end if;

  if p_sessions <= 0 then
    raise exception 'SESSIONS_MUST_BE_POSITIVE';
  end if;

  if p_from_student_id = p_to_student_id then
    raise exception 'STUDENTS_MUST_DIFFER';
  end if;

  insert into public.session_ledger_entries (
    organization_id,
    student_id,
    entry_type,
    delta_sessions,
    transfer_group_id,
    note,
    created_by
  )
  values
    (
      p_organization_id,
      p_from_student_id,
      'transfer_out',
      -p_sessions,
      v_group_id,
      p_reason,
      auth.uid()
    ),
    (
      p_organization_id,
      p_to_student_id,
      'transfer_in',
      p_sessions,
      v_group_id,
      p_reason,
      auth.uid()
    );

  insert into public.audit_logs (
    organization_id,
    actor_profile_id,
    module,
    action,
    entity_type,
    entity_id,
    new_data,
    reason
  )
  values (
    p_organization_id,
    auth.uid(),
    'finance',
    'transfer_sessions',
    'session_transfer',
    v_group_id::text,
    jsonb_build_object(
      'from_student_id', p_from_student_id,
      'to_student_id', p_to_student_id,
      'sessions', p_sessions
    ),
    p_reason
  );

  return v_group_id;
end;
$$;

grant execute on function public.transfer_student_sessions(
  uuid, uuid, uuid, integer, text
) to authenticated;

commit;
