-- Migration: 20260726151000_crm_foundation.sql
-- Description: Foundation schema for CRM lead management, trial bookings, lead assignment history, and enrollment checklists

begin;

-- 1. Register new permissions
insert into public.permissions (code, module, name, description)
values
  ('crm.view', 'crm', 'Xem danh sách CRM & Lead', 'Quyền xem thông tin lead và CRM cases'),
  ('crm.update', 'crm', 'Cập nhật CRM & Lead', 'Quyền chỉnh sửa thông tin CRM cases và học thử'),
  ('crm.transfer', 'crm', 'Chuyển giao Lead', 'Quyền chuyển giao lead cho nhân sự Sale khác'),
  ('students.confirm_official', 'students', 'Xác nhận học viên chính thức', 'Quyền chuyển lead thành học viên chính thức'),
  ('sepay.accountant_confirm', 'sepay', 'Kế toán xác nhận giao dịch', 'Quyền kế toán xác nhận giao dịch học phí (tiêu chí checklist #8)')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Grant permissions to roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where (p.code in ('crm.view', 'crm.update', 'crm.transfer', 'students.confirm_official')
       and r.code in ('owner', 'operations_manager', 'assistant_manager', 'admissions_leader', 'consultant'))
   or (p.code = 'sepay.accountant_confirm'
       and r.code in ('owner', 'operations_manager', 'accountant'))
on conflict (role_id, permission_id) do nothing;

-- 2. Create Lead Sources table
create table if not exists public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  group_code text not null check (group_code in ('mma', 'other', 'sandbox')),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now()
);

-- Seed default lead sources
insert into public.crm_lead_sources (code, name, group_code)
values
  ('mma_fanpage', 'MMA Fanpage Facebook', 'mma'),
  ('mma_zalo', 'MMA Zalo OA / Hotline', 'mma'),
  ('mma_website', 'MMA Website', 'mma'),
  ('sandbox_partner', 'Đối tác Sandbox', 'sandbox'),
  ('referral_student', 'Giới thiệu từ học viên cũ', 'other'),
  ('referral_teacher', 'Giới thiệu từ giáo viên', 'other'),
  ('direct_walkin', 'Đến trực tiếp trung tâm', 'other')
on conflict (code) do nothing;

-- 3. Create CRM Cases table
create table if not exists public.crm_cases (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  full_name text not null,
  nickname text,
  birth_year integer not null check (birth_year >= 2000 and birth_year <= 2025),
  province_city text,
  expected_grade integer not null check (expected_grade >= 1 and expected_grade <= 12),
  expected_level text check (expected_level in ('A', 'B', 'CLC')),
  expected_mode text check (expected_mode in ('online', 'offline', 'hybrid')),
  expected_official_start_date date,
  expected_tuition_fee_vnd bigint check (expected_tuition_fee_vnd is null or expected_tuition_fee_vnd >= 0),
  discount_notes text,

  -- Guardian details
  guardian_id uuid references public.guardians(id) on delete restrict,
  guardian_phone text not null,
  guardian_full_name text not null,
  guardian_relationship text not null default 'Phụ huynh',

  -- Lead Source & Sale Assignment
  lead_source_id uuid references public.crm_lead_sources(id) on delete restrict,
  sale_owner_id uuid references public.profiles(id) on delete restrict,

  -- Lifecycle Status
  status text not null default 'interested' check (
    status in ('interested', 'trial_booked', 'trial_completed', 'pending_enrollment_confirmation', 'converted', 'dropped')
  ),

  -- Converted student reference
  student_id uuid references public.students(id) on delete restrict,

  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

-- Indexes for crm_cases
create index if not exists crm_cases_status_idx on public.crm_cases (status, created_at desc);
create index if not exists crm_cases_sale_owner_idx on public.crm_cases (sale_owner_id, status);
create index if not exists crm_cases_guardian_phone_idx on public.crm_cases (guardian_phone);
create index if not exists crm_cases_student_idx on public.crm_cases (student_id) where student_id is not null;

-- 4. Create Lead Assignment History table
create table if not exists public.crm_lead_assignment_history (
  id uuid primary key default gen_random_uuid(),
  crm_case_id uuid not null references public.crm_cases(id) on delete restrict,
  previous_sale_owner_id uuid references public.profiles(id) on delete restrict,
  new_sale_owner_id uuid not null references public.profiles(id) on delete restrict,
  assignment_method text not null check (
    assignment_method in ('auto_round_robin', 'manual_assign', 'manual_transfer', 'self_claim')
  ),
  reason text not null,
  assigned_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists crm_lead_assignment_history_case_idx on public.crm_lead_assignment_history (crm_case_id, created_at desc);

-- 5. Create Trial Bookings table
create table if not exists public.crm_trial_bookings (
  id uuid primary key default gen_random_uuid(),
  crm_case_id uuid not null references public.crm_cases(id) on delete restrict,
  class_session_id uuid references public.class_sessions(id) on delete restrict,
  trial_date date not null,
  learning_mode text not null check (learning_mode in ('online', 'offline')),
  status text not null default 'scheduled' check (
    status in ('scheduled', 'attended', 'cancelled', 'no_show')
  ),
  teacher_feedback text,
  sale_notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists crm_trial_bookings_case_idx on public.crm_trial_bookings (crm_case_id, trial_date desc);
create index if not exists crm_trial_bookings_session_idx on public.crm_trial_bookings (class_session_id) where class_session_id is not null;

-- 6. Create Student Enrollment Checklists table
create table if not exists public.student_enrollment_checklists (
  id uuid primary key default gen_random_uuid(),
  crm_case_id uuid references public.crm_cases(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,

  -- 10 Checklist Items
  item_1_payment_received boolean not null default false,
  item_2_source_confirmed boolean not null default false,
  item_3_sale_confirmed boolean not null default false,
  item_4_class_selected boolean not null default false,
  item_5_mode_confirmed boolean not null default false,
  item_6_fee_confirmed boolean not null default false,
  item_7_assistant_sessions_confirmed boolean not null default false,
  item_8_accountant_transaction_confirmed boolean not null default false,
  item_9_official_start_date_entered boolean not null default false,
  item_10_communication_group_ready boolean not null default false,

  is_fully_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists student_enrollment_checklists_case_idx on public.student_enrollment_checklists (crm_case_id) where crm_case_id is not null;
create index if not exists student_enrollment_checklists_student_idx on public.student_enrollment_checklists (student_id) where student_id is not null;

-- 7. Triggers for updated_at
create or replace function public.touch_crm_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger crm_cases_touch_updated_at
before update on public.crm_cases
for each row execute function public.touch_crm_updated_at();

create trigger crm_trial_bookings_touch_updated_at
before update on public.crm_trial_bookings
for each row execute function public.touch_crm_updated_at();

create trigger student_enrollment_checklists_touch_updated_at
before update on public.student_enrollment_checklists
for each row execute function public.touch_crm_updated_at();

-- 8. Enable RLS and SELECT policies
alter table public.crm_lead_sources enable row level security;
alter table public.crm_cases enable row level security;
alter table public.crm_lead_assignment_history enable row level security;
alter table public.crm_trial_bookings enable row level security;
alter table public.student_enrollment_checklists enable row level security;

create policy crm_lead_sources_select on public.crm_lead_sources
  for select to authenticated using (public.has_permission('crm.view'));

create policy crm_cases_select on public.crm_cases
  for select to authenticated using (public.has_permission('crm.view'));

create policy crm_lead_assignment_history_select on public.crm_lead_assignment_history
  for select to authenticated using (public.has_permission('crm.view'));

create policy crm_trial_bookings_select on public.crm_trial_bookings
  for select to authenticated using (public.has_permission('crm.view'));

create policy student_enrollment_checklists_select on public.student_enrollment_checklists
  for select to authenticated using (public.has_permission('crm.view') or public.has_permission('students.view'));

commit;
