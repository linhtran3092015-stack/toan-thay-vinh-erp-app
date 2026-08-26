begin;

create extension if not exists btree_gist;

insert into public.permissions (code, module, name, description)
values
  ('staff.manage_payroll_profile', 'staff', 'Quản lý cấu hình lương nhân sự', 'Thiết lập vị trí tính lương, mức lương ngày, khối phụ trách và nhiệm vụ có hiệu lực.'),
  ('staff.bank.view', 'staff', 'Xem thông tin ngân hàng nhân sự', 'Xem thông tin ngân hàng đầy đủ để chi trả lương.'),
  ('staff.bank.manage', 'staff', 'Duyệt thông tin ngân hàng nhân sự', 'Duyệt hoặc từ chối yêu cầu thay đổi thông tin ngân hàng.'),
  ('payroll.policy.manage', 'payroll', 'Quản lý chính sách lương', 'Thiết lập tham số chính sách lương có thời gian hiệu lực.'),
  ('payroll.import', 'payroll', 'Nhập dữ liệu lương', 'Tải, đối soát và duyệt dữ liệu Excel dự phòng cho kỳ lương.'),
  ('payroll.feedback.resolve', 'payroll', 'Xử lý phản hồi bảng lương', 'Xử lý yêu cầu điều chỉnh và đóng thời gian phản hồi.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission on (
  role.code = 'owner'
  or (role.code = 'accountant' and permission.code in (
    'staff.manage_payroll_profile',
    'staff.bank.view',
    'staff.bank.manage',
    'payroll.policy.manage',
    'payroll.import',
    'payroll.feedback.resolve'
  ))
  or (role.code = 'operations_manager' and permission.code = 'staff.manage_payroll_profile')
)
where permission.code in (
  'staff.manage_payroll_profile',
  'staff.bank.view',
  'staff.bank.manage',
  'payroll.policy.manage',
  'payroll.import',
  'payroll.feedback.resolve'
)
on conflict (role_id, permission_id) do nothing;

create or replace function public.assert_payroll_configuration_date_allowed(p_effective_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_effective_from is null then
    raise exception using errcode = '22023', message = 'PAYROLL_EFFECTIVE_DATE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.payroll_periods as period
    where period.status <> 'draft'
      and (period.period_month + interval '1 month' - interval '1 day')::date >= p_effective_from
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CONFIGURATION_BACKDATE_LOCKED';
  end if;
end;
$$;

revoke all on function public.assert_payroll_configuration_date_allowed(date) from public, anon, authenticated;

create or replace function public.prevent_payroll_configuration_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'PAYROLL_CONFIGURATION_HISTORY_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_payroll_configuration_mutation() from public, anon, authenticated;

create table public.staff_payroll_position_versions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  position_code text not null check (position_code in ('teaching_assistant', 'operations_assistant', 'admissions_manager')),
  effective_from date not null,
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint staff_payroll_position_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  unique (staff_id, effective_from)
);

create index staff_payroll_position_staff_effective_idx
  on public.staff_payroll_position_versions (staff_id, effective_from desc);

create trigger staff_payroll_position_versions_immutable
before update or delete on public.staff_payroll_position_versions
for each row execute function public.prevent_payroll_configuration_mutation();

create table public.staff_daily_rate_versions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  effective_from date not null,
  offline_daily_rate_vnd bigint not null check (offline_daily_rate_vnd >= 0),
  online_rate_basis_points integer not null default 5000 check (online_rate_basis_points between 0 and 10000),
  note text,
  reason text not null,
  migrated_from_staff_rate_version_id uuid references public.staff_rate_versions(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint staff_daily_rate_note_check check (
    note is null or (note = pg_catalog.btrim(note) and note <> '' and pg_catalog.length(note) <= 1000)
  ),
  constraint staff_daily_rate_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  unique (staff_id, effective_from)
);

create index staff_daily_rate_staff_effective_idx
  on public.staff_daily_rate_versions (staff_id, effective_from desc);

create trigger staff_daily_rate_versions_immutable
before update or delete on public.staff_daily_rate_versions
for each row execute function public.prevent_payroll_configuration_mutation();

insert into public.staff_daily_rate_versions (
  staff_id,
  effective_from,
  offline_daily_rate_vnd,
  note,
  reason,
  migrated_from_staff_rate_version_id,
  created_by,
  created_at
)
select
  rate.staff_id,
  rate.effective_from,
  rate.offline_hourly_rate_vnd * 9,
  rate.note,
  'Chuyển đổi tự động từ đơn giá giờ hiện có.',
  rate.id,
  rate.created_by,
  rate.created_at
from public.staff_rate_versions as rate
on conflict (staff_id, effective_from) do nothing;

create table public.staff_grade_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  grade smallint not null check (grade between 2 and 12),
  effective_from date not null,
  effective_to date,
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint staff_grade_assignment_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint staff_grade_assignment_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  constraint staff_grade_assignment_exclusive exclude using gist (
    grade with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  )
);

create index staff_grade_assignment_staff_effective_idx
  on public.staff_grade_assignments (staff_id, effective_from desc, grade);

create or replace function public.protect_staff_grade_assignment_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and pg_catalog.current_setting('app.payroll_grade_transfer', true) = 'on'
    and old.id is not distinct from new.id
    and old.staff_id is not distinct from new.staff_id
    and old.grade is not distinct from new.grade
    and old.effective_from is not distinct from new.effective_from
    and old.reason is not distinct from new.reason
    and old.created_by is not distinct from new.created_by
    and old.created_at is not distinct from new.created_at
    and old.effective_to is null
    and new.effective_to is not null
    and new.effective_to >= old.effective_from
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'PAYROLL_GRADE_ASSIGNMENT_HISTORY_IMMUTABLE';
end;
$$;

create trigger staff_grade_assignments_immutable
before update or delete on public.staff_grade_assignments
for each row execute function public.protect_staff_grade_assignment_history();

create table public.staff_payroll_task_versions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  task_code text not null check (task_code in (
    'center_renewal_duty',
    'record_excess',
    'payroll_processing',
    'staff_recruitment_care',
    'student_coaching',
    'daily_admin_reporting',
    'addon_product_sales'
  )),
  is_enabled boolean not null,
  effective_from date not null,
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint staff_payroll_task_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  unique (staff_id, task_code, effective_from)
);

create index staff_payroll_task_staff_effective_idx
  on public.staff_payroll_task_versions (staff_id, task_code, effective_from desc);

create trigger staff_payroll_task_versions_immutable
before update or delete on public.staff_payroll_task_versions
for each row execute function public.prevent_payroll_configuration_mutation();

create table public.payroll_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_code text not null check (policy_code in (
    'teaching_allowance',
    'grading_pool',
    'operations_grade_renewal',
    'operations_new_enrollment',
    'operations_center_renewal_duty',
    'operations_record_excess',
    'operations_payroll_processing',
    'operations_staff_recruitment_care',
    'operations_student_coaching',
    'operations_daily_admin_reporting',
    'operations_addon_product_sales',
    'operations_piecework_floor',
    'admissions_new_enrollment',
    'admissions_revenue_tiers',
    'admissions_piecework_floor'
  )),
  effective_from date not null,
  parameters jsonb not null,
  reason text not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_policy_parameters_object_check check (pg_catalog.jsonb_typeof(parameters) = 'object'),
  constraint payroll_policy_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  unique (policy_code, effective_from)
);

create index payroll_policy_code_effective_idx
  on public.payroll_policy_versions (policy_code, effective_from desc);

create trigger payroll_policy_versions_immutable
before update or delete on public.payroll_policy_versions
for each row execute function public.prevent_payroll_configuration_mutation();

insert into public.payroll_policy_versions (policy_code, effective_from, parameters, reason)
values
  ('teaching_allowance', '2025-07-01', '{"amount_vnd":40000}', 'Chính sách khởi tạo.'),
  ('grading_pool', '2025-07-01', '{"monthly_pool_vnd":1000000}', 'Chính sách khởi tạo.'),
  ('operations_grade_renewal', '2025-07-01', '{"rate_basis_points":200}', 'Chính sách khởi tạo.'),
  ('operations_new_enrollment', '2025-07-01', '{"revenue_rate_basis_points":500,"fixed_by_source":{"survey":500000,"school_telesales_ads":200000,"organic_direct":100000,"referral_internal_upsell":50000,"math_to_english":100000}}', 'Chính sách khởi tạo.'),
  ('operations_center_renewal_duty', '2025-07-01', '{"rate_basis_points":50}', 'Chính sách khởi tạo.'),
  ('operations_record_excess', '2025-07-01', '{"rate_basis_points":500,"record_revenue_vnd":310040000}', 'Chính sách khởi tạo.'),
  ('operations_payroll_processing', '2025-07-01', '{"amount_per_staff_vnd":25000,"include_self":true}', 'Chính sách khởi tạo.'),
  ('operations_staff_recruitment_care', '2025-07-01', '{"rate_basis_points":500}', 'Chính sách khởi tạo.'),
  ('operations_student_coaching', '2025-07-01', '{"rate_basis_points":50}', 'Chính sách khởi tạo.'),
  ('operations_daily_admin_reporting', '2025-07-01', '{"amount_per_day_vnd":30000}', 'Chính sách khởi tạo.'),
  ('operations_addon_product_sales', '2025-07-01', '{"rate_basis_points":500}', 'Chính sách khởi tạo.'),
  ('operations_piecework_floor', '2025-07-01', '{"base_salary_basis_points":8500}', 'Chính sách khởi tạo.'),
  ('admissions_new_enrollment', '2025-07-01', '{"fixed_by_source":{"self_sourced":500000,"school_telesales_ads":200000,"teacher_vinh_zalo_direct_referral":50000,"math_to_english":100000}}', 'Chính sách khởi tạo.'),
  ('admissions_revenue_tiers', '2025-07-01', '{"tiers":[{"minimum_vnd":0,"rate_basis_points":0},{"minimum_vnd":20000000,"rate_basis_points":400},{"minimum_vnd":30000000,"rate_basis_points":600},{"minimum_vnd":40000000,"rate_basis_points":800}]}', 'Chính sách khởi tạo.'),
  ('admissions_piecework_floor', '2025-07-01', '{"base_salary_basis_points":10000}', 'Chính sách khởi tạo.')
on conflict (policy_code, effective_from) do nothing;

create table public.payroll_lead_source_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  lead_source_id uuid not null references public.crm_lead_sources(id) on delete restrict,
  payroll_source_code text not null check (payroll_source_code in (
    'survey',
    'school_telesales_ads',
    'organic_direct',
    'referral_internal_upsell',
    'math_to_english',
    'self_sourced',
    'teacher_vinh_zalo_direct_referral'
  )),
  effective_from date not null,
  reason text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_lead_source_mapping_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  unique (lead_source_id, effective_from)
);

create index payroll_lead_source_mapping_effective_idx
  on public.payroll_lead_source_mapping_versions (lead_source_id, effective_from desc);

create trigger payroll_lead_source_mapping_versions_immutable
before update or delete on public.payroll_lead_source_mapping_versions
for each row execute function public.prevent_payroll_configuration_mutation();

create or replace function public.create_staff_payroll_position_version(
  p_staff_id uuid,
  p_position_code text,
  p_effective_from date,
  p_reason text
)
returns public.staff_payroll_position_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_position text := pg_catalog.lower(pg_catalog.btrim(p_position_code));
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.staff_payroll_position_versions%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('staff.manage_payroll_profile') then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED';
  end if;
  if p_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_SELF_CHANGE_FORBIDDEN';
  end if;
  if normalized_position not in ('teaching_assistant', 'operations_assistant', 'admissions_manager') then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_POSITION_INVALID';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_POSITION_REASON_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles where id = p_staff_id and employment_status = 'active') then
    raise exception using errcode = '23514', message = 'STAFF_PAYROLL_POSITION_REQUIRES_ACTIVE_PROFILE';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  insert into public.staff_payroll_position_versions (staff_id, position_code, effective_from, reason, created_by)
  values (p_staff_id, normalized_position, p_effective_from, normalized_reason, actor_id)
  returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'STAFF_PAYROLL_POSITION_EFFECTIVE_DATE_EXISTS';
end;
$$;

create or replace function public.create_staff_daily_rate_version(
  p_staff_id uuid,
  p_effective_from date,
  p_offline_daily_rate_vnd bigint,
  p_note text,
  p_reason text
)
returns public.staff_daily_rate_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.staff_daily_rate_versions%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('staff.manage_payroll_profile') and not public.has_permission('staff.manage_rates') then
    raise exception using errcode = '42501', message = 'STAFF_DAILY_RATE_PERMISSION_REQUIRED';
  end if;
  if p_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_DAILY_RATE_SELF_CHANGE_FORBIDDEN';
  end if;
  if p_offline_daily_rate_vnd is null or p_offline_daily_rate_vnd < 0 then
    raise exception using errcode = '22023', message = 'STAFF_DAILY_RATE_INVALID';
  end if;
  if normalized_note is not null and pg_catalog.length(normalized_note) > 1000 then
    raise exception using errcode = '22023', message = 'STAFF_DAILY_RATE_NOTE_INVALID';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'STAFF_DAILY_RATE_REASON_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles where id = p_staff_id and employment_status = 'active') then
    raise exception using errcode = '23514', message = 'STAFF_DAILY_RATE_REQUIRES_ACTIVE_PROFILE';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  insert into public.staff_daily_rate_versions (
    staff_id, effective_from, offline_daily_rate_vnd, note, reason, created_by
  ) values (
    p_staff_id, p_effective_from, p_offline_daily_rate_vnd, normalized_note, normalized_reason, actor_id
  ) returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'STAFF_DAILY_RATE_EFFECTIVE_DATE_EXISTS';
end;
$$;

create or replace function public.create_staff_grade_assignment(
  p_staff_id uuid,
  p_grade smallint,
  p_effective_from date,
  p_effective_to date,
  p_reason text
)
returns public.staff_grade_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.staff_grade_assignments%rowtype;
  effective_position text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if p_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_GRADE_ASSIGNMENT_SELF_CHANGE_FORBIDDEN';
  end if;
  if not public.has_permission('staff.manage_payroll_profile') then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED';
  end if;
  if p_grade is null or p_grade < 2 or p_grade > 12 then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_GRADE_INVALID';
  end if;
  if p_effective_to is not null and p_effective_to < p_effective_from then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_DATES_INVALID';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'STAFF_GRADE_ASSIGNMENT_REASON_REQUIRED';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  select position.position_code into effective_position
  from public.staff_payroll_position_versions as position
  where position.staff_id = p_staff_id and position.effective_from <= p_effective_from
  order by position.effective_from desc
  limit 1;

  if effective_position is distinct from 'operations_assistant' then
    raise exception using errcode = '23514', message = 'STAFF_GRADE_ASSIGNMENT_REQUIRES_OPERATIONS_POSITION';
  end if;

  -- A new owner takes over from the effective date; preserve the prior assignment
  -- as a closed historical range instead of mutating or deleting it.
  perform pg_catalog.set_config('app.payroll_grade_transfer', 'on', true);
  update public.staff_grade_assignments
  set effective_to = p_effective_from - 1
  where grade = p_grade
    and effective_from < p_effective_from
    and effective_to is null;
  perform pg_catalog.set_config('app.payroll_grade_transfer', 'off', true);

  insert into public.staff_grade_assignments (
    staff_id, grade, effective_from, effective_to, reason, created_by
  ) values (
    p_staff_id, p_grade, p_effective_from, p_effective_to, normalized_reason, actor_id
  ) returning * into created_row;
  return created_row;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'STAFF_GRADE_ASSIGNMENT_OVERLAPS';
end;
$$;

create or replace function public.create_staff_payroll_task_version(
  p_staff_id uuid,
  p_task_code text,
  p_is_enabled boolean,
  p_effective_from date,
  p_reason text
)
returns public.staff_payroll_task_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_task text := pg_catalog.lower(pg_catalog.btrim(p_task_code));
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.staff_payroll_task_versions%rowtype;
  effective_position text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if p_staff_id = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_TASK_SELF_CHANGE_FORBIDDEN';
  end if;
  if not public.has_permission('staff.manage_payroll_profile') then
    raise exception using errcode = '42501', message = 'STAFF_PAYROLL_PROFILE_PERMISSION_REQUIRED';
  end if;
  if normalized_task not in (
    'center_renewal_duty', 'record_excess', 'payroll_processing', 'staff_recruitment_care',
    'student_coaching', 'daily_admin_reporting', 'addon_product_sales'
  ) then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_TASK_INVALID';
  end if;
  if p_is_enabled is null then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_TASK_STATE_REQUIRED';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'STAFF_PAYROLL_TASK_REASON_REQUIRED';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  select position.position_code into effective_position
  from public.staff_payroll_position_versions as position
  where position.staff_id = p_staff_id and position.effective_from <= p_effective_from
  order by position.effective_from desc
  limit 1;
  if effective_position is distinct from 'operations_assistant' then
    raise exception using errcode = '23514', message = 'STAFF_PAYROLL_TASK_REQUIRES_OPERATIONS_POSITION';
  end if;

  insert into public.staff_payroll_task_versions (
    staff_id, task_code, is_enabled, effective_from, reason, created_by
  ) values (
    p_staff_id, normalized_task, p_is_enabled, p_effective_from, normalized_reason, actor_id
  ) returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'STAFF_PAYROLL_TASK_EFFECTIVE_DATE_EXISTS';
end;
$$;

create or replace function public.create_payroll_policy_version(
  p_policy_code text,
  p_effective_from date,
  p_parameters jsonb,
  p_reason text
)
returns public.payroll_policy_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text := pg_catalog.lower(pg_catalog.btrim(p_policy_code));
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  created_row public.payroll_policy_versions%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.policy.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_POLICY_MANAGE_PERMISSION_REQUIRED';
  end if;
  if p_parameters is null or pg_catalog.jsonb_typeof(p_parameters) <> 'object' then
    raise exception using errcode = '22023', message = 'PAYROLL_POLICY_PARAMETERS_INVALID';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_POLICY_REASON_REQUIRED';
  end if;
  perform public.assert_payroll_configuration_date_allowed(p_effective_from);

  insert into public.payroll_policy_versions (policy_code, effective_from, parameters, reason, created_by)
  values (normalized_code, p_effective_from, p_parameters, normalized_reason, actor_id)
  returning * into created_row;
  return created_row;
exception
  when check_violation then
    raise exception using errcode = '22023', message = 'PAYROLL_POLICY_CODE_OR_PARAMETERS_INVALID';
  when unique_violation then
    raise exception using errcode = '23505', message = 'PAYROLL_POLICY_EFFECTIVE_DATE_EXISTS';
end;
$$;

revoke all on function public.create_staff_payroll_position_version(uuid, text, date, text) from public, anon;
revoke all on function public.create_staff_daily_rate_version(uuid, date, bigint, text, text) from public, anon;
revoke all on function public.create_staff_grade_assignment(uuid, smallint, date, date, text) from public, anon;
revoke all on function public.create_staff_payroll_task_version(uuid, text, boolean, date, text) from public, anon;
revoke all on function public.create_payroll_policy_version(text, date, jsonb, text) from public, anon;
grant execute on function public.create_staff_payroll_position_version(uuid, text, date, text) to authenticated;
grant execute on function public.create_staff_daily_rate_version(uuid, date, bigint, text, text) to authenticated;
grant execute on function public.create_staff_grade_assignment(uuid, smallint, date, date, text) to authenticated;
grant execute on function public.create_staff_payroll_task_version(uuid, text, boolean, date, text) to authenticated;
grant execute on function public.create_payroll_policy_version(text, date, jsonb, text) to authenticated;

create table public.staff_bank_account_versions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  bank_name text not null,
  account_number text not null,
  account_holder_name text not null,
  effective_from date not null,
  source_request_id uuid,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  constraint staff_bank_name_check check (
    bank_name = pg_catalog.btrim(bank_name) and bank_name <> '' and pg_catalog.length(bank_name) <= 160
  ),
  constraint staff_bank_account_number_check check (
    account_number = pg_catalog.btrim(account_number) and account_number ~ '^[A-Za-z0-9.-]{4,40}$'
  ),
  constraint staff_bank_account_holder_check check (
    account_holder_name = pg_catalog.btrim(account_holder_name) and account_holder_name <> '' and pg_catalog.length(account_holder_name) <= 160
  ),
  unique (staff_id, effective_from)
);

create table public.staff_bank_account_change_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  bank_name text not null,
  account_number text not null,
  account_holder_name text not null,
  effective_from date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default pg_catalog.now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  constraint staff_bank_request_name_check check (
    bank_name = pg_catalog.btrim(bank_name) and bank_name <> '' and pg_catalog.length(bank_name) <= 160
  ),
  constraint staff_bank_request_account_number_check check (
    account_number = pg_catalog.btrim(account_number) and account_number ~ '^[A-Za-z0-9.-]{4,40}$'
  ),
  constraint staff_bank_request_holder_check check (
    account_holder_name = pg_catalog.btrim(account_holder_name) and account_holder_name <> '' and pg_catalog.length(account_holder_name) <= 160
  ),
  constraint staff_bank_request_reason_check check (
    reason = pg_catalog.btrim(reason) and reason <> '' and pg_catalog.length(reason) <= 2000
  ),
  constraint staff_bank_request_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_note is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null and review_note is not null)
  )
);

alter table public.staff_bank_account_versions
  add constraint staff_bank_account_versions_source_request_fkey
  foreign key (source_request_id) references public.staff_bank_account_change_requests(id) on delete restrict;

create unique index staff_bank_account_one_pending_idx
  on public.staff_bank_account_change_requests (staff_id)
  where status = 'pending';

create trigger staff_bank_account_versions_immutable
before update or delete on public.staff_bank_account_versions
for each row execute function public.prevent_payroll_configuration_mutation();

create or replace function public.protect_staff_bank_account_request_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status in ('approved', 'rejected')
    and new.staff_id is not distinct from old.staff_id
    and new.bank_name is not distinct from old.bank_name
    and new.account_number is not distinct from old.account_number
    and new.account_holder_name is not distinct from old.account_holder_name
    and new.effective_from is not distinct from old.effective_from
    and new.reason is not distinct from old.reason
    and new.requested_by is not distinct from old.requested_by
    and new.requested_at is not distinct from old.requested_at
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'STAFF_BANK_ACCOUNT_REQUEST_HISTORY_IMMUTABLE';
end;
$$;

create trigger staff_bank_account_requests_protect_history
before update or delete on public.staff_bank_account_change_requests
for each row execute function public.protect_staff_bank_account_request_history();

create or replace function public.submit_staff_bank_account_change(
  p_staff_id uuid,
  p_bank_name text,
  p_account_number text,
  p_account_holder_name text,
  p_effective_from date,
  p_reason text
)
returns public.staff_bank_account_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  created_row public.staff_bank_account_change_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if p_staff_id is distinct from actor_id and not public.has_permission('staff.bank.manage') then
    raise exception using errcode = '42501', message = 'STAFF_BANK_ACCOUNT_SUBMIT_PERMISSION_REQUIRED';
  end if;
  if p_effective_from is null then
    raise exception using errcode = '22023', message = 'STAFF_BANK_ACCOUNT_EFFECTIVE_DATE_REQUIRED';
  end if;
  insert into public.staff_bank_account_change_requests (
    staff_id, bank_name, account_number, account_holder_name, effective_from, reason, requested_by
  ) values (
    p_staff_id,
    pg_catalog.btrim(p_bank_name),
    pg_catalog.btrim(p_account_number),
    pg_catalog.btrim(p_account_holder_name),
    p_effective_from,
    pg_catalog.btrim(p_reason),
    actor_id
  ) returning * into created_row;
  return created_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'STAFF_BANK_ACCOUNT_REQUEST_ALREADY_PENDING';
  when check_violation then
    raise exception using errcode = '22023', message = 'STAFF_BANK_ACCOUNT_REQUEST_INVALID';
end;
$$;

create or replace function public.decide_staff_bank_account_change(
  p_request_id uuid,
  p_decision text,
  p_review_note text
)
returns public.staff_bank_account_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  target_request public.staff_bank_account_change_requests%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('staff.bank.manage') then
    raise exception using errcode = '42501', message = 'STAFF_BANK_ACCOUNT_MANAGE_PERMISSION_REQUIRED';
  end if;
  if normalized_decision not in ('approved', 'rejected') or nullif(pg_catalog.btrim(p_review_note), '') is null then
    raise exception using errcode = '22023', message = 'STAFF_BANK_ACCOUNT_DECISION_INVALID';
  end if;

  select * into target_request
  from public.staff_bank_account_change_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_BANK_ACCOUNT_REQUEST_NOT_PENDING';
  end if;
  if target_request.staff_id = actor_id or target_request.requested_by = actor_id then
    raise exception using errcode = '42501', message = 'STAFF_BANK_ACCOUNT_SELF_APPROVAL_FORBIDDEN';
  end if;

  update public.staff_bank_account_change_requests
  set status = normalized_decision,
      reviewed_by = actor_id,
      reviewed_at = pg_catalog.now(),
      review_note = pg_catalog.btrim(p_review_note)
  where id = target_request.id
  returning * into target_request;

  if normalized_decision = 'approved' then
    insert into public.staff_bank_account_versions (
      staff_id, bank_name, account_number, account_holder_name, effective_from,
      source_request_id, approved_by, approved_at
    ) values (
      target_request.staff_id,
      target_request.bank_name,
      target_request.account_number,
      target_request.account_holder_name,
      target_request.effective_from,
      target_request.id,
      actor_id,
      target_request.reviewed_at
    );
  end if;
  return target_request;
end;
$$;

revoke all on function public.submit_staff_bank_account_change(uuid, text, text, text, date, text) from public, anon;
revoke all on function public.decide_staff_bank_account_change(uuid, text, text) from public, anon;
grant execute on function public.submit_staff_bank_account_change(uuid, text, text, text, date, text) to authenticated;
grant execute on function public.decide_staff_bank_account_change(uuid, text, text) to authenticated;

alter table public.staff_payroll_position_versions enable row level security;
alter table public.staff_daily_rate_versions enable row level security;
alter table public.staff_grade_assignments enable row level security;
alter table public.staff_payroll_task_versions enable row level security;
alter table public.payroll_policy_versions enable row level security;
alter table public.payroll_lead_source_mapping_versions enable row level security;
alter table public.staff_bank_account_versions enable row level security;
alter table public.staff_bank_account_change_requests enable row level security;

create policy staff_payroll_positions_select on public.staff_payroll_position_versions for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.manage_payroll_profile') or public.has_permission('payroll.manage'));
create policy staff_daily_rates_select on public.staff_daily_rate_versions for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.manage_rates') or public.has_permission('staff.manage_payroll_profile') or public.has_permission('payroll.manage'));
create policy staff_grade_assignments_select on public.staff_grade_assignments for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.manage_payroll_profile') or public.has_permission('payroll.manage'));
create policy staff_payroll_tasks_select on public.staff_payroll_task_versions for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.manage_payroll_profile') or public.has_permission('payroll.manage'));
create policy payroll_policy_versions_select on public.payroll_policy_versions for select to authenticated
using (public.has_permission('payroll.view'));
create policy payroll_lead_source_mappings_select on public.payroll_lead_source_mapping_versions for select to authenticated
using (public.has_permission('payroll.view'));
create policy staff_bank_versions_select on public.staff_bank_account_versions for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.bank.view'));
create policy staff_bank_requests_select on public.staff_bank_account_change_requests for select to authenticated
using (staff_id = (select auth.uid()) or public.has_permission('staff.bank.manage'));

revoke all privileges on public.staff_payroll_position_versions, public.staff_daily_rate_versions,
  public.staff_grade_assignments, public.staff_payroll_task_versions, public.payroll_policy_versions,
  public.payroll_lead_source_mapping_versions, public.staff_bank_account_versions,
  public.staff_bank_account_change_requests from public, anon, authenticated;
grant select on public.staff_payroll_position_versions, public.staff_daily_rate_versions,
  public.staff_grade_assignments, public.staff_payroll_task_versions, public.payroll_policy_versions,
  public.payroll_lead_source_mapping_versions, public.staff_bank_account_versions,
  public.staff_bank_account_change_requests to authenticated;

create or replace function public.audit_payroll_configuration_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data, metadata)
  values (
    coalesce(auth.uid(), (pg_catalog.to_jsonb(new)->>'created_by')::uuid),
    'payroll',
    tg_table_name || '_created',
    tg_table_name,
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'payroll_configuration')
  );
  return new;
end;
$$;

revoke all on function public.audit_payroll_configuration_insert() from public, anon, authenticated;

create trigger staff_payroll_positions_audit after insert on public.staff_payroll_position_versions
for each row execute function public.audit_payroll_configuration_insert();
create trigger staff_daily_rates_audit after insert on public.staff_daily_rate_versions
for each row execute function public.audit_payroll_configuration_insert();
create trigger staff_grade_assignments_audit after insert on public.staff_grade_assignments
for each row execute function public.audit_payroll_configuration_insert();
create trigger staff_payroll_tasks_audit after insert on public.staff_payroll_task_versions
for each row execute function public.audit_payroll_configuration_insert();
create trigger payroll_policy_versions_audit after insert on public.payroll_policy_versions
for each row execute function public.audit_payroll_configuration_insert();

commit;
