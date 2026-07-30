begin;

-- TASK 8G: monthly payroll foundation. A closed time entry is one work unit
-- of nine hours. An approved timekeeping adjustment supplies its effective
-- check-in mode before the applicable staff rate version is snapshotted.

insert into public.permissions (code, module, name, description)
values
  ('payroll.view', 'payroll', 'Xem bảng lương', 'Nhân sự chỉ xem bảng lương của chính mình; người có quyền quản lý xem được toàn bộ.'),
  ('payroll.manage', 'payroll', 'Lập bảng lương', 'Tạo bảng lương tháng đã kết thúc và thêm thưởng hoặc khấu trừ thủ công trong bản nháp.'),
  ('payroll.accountant_reconcile', 'payroll', 'Đối soát bảng lương', 'Chuyển bảng lương từ nháp sang chờ chủ trung tâm duyệt.'),
  ('payroll.owner_approve', 'payroll', 'Duyệt bảng lương', 'Duyệt cuối cùng bảng lương đã được đối soát.')
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission
  on (
    permission.code = 'payroll.view'
    or (permission.code = 'payroll.manage' and role.code in ('owner', 'operations_manager', 'assistant_manager'))
    or (permission.code = 'payroll.accountant_reconcile' and role.code in ('owner', 'accountant'))
    or (permission.code = 'payroll.owner_approve' and role.code = 'owner')
  )
where role.code in (
  'owner',
  'accountant',
  'operations_manager',
  'assistant_manager',
  'teaching_assistant',
  'admissions_specialist',
  'admissions_leader',
  'admissions_manager',
  'collaborator'
)
on conflict (role_id, permission_id) do nothing;

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  pay_date date not null,
  status text not null default 'draft',
  generated_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz not null default pg_catalog.now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  constraint payroll_periods_month_start_check
    check (period_month = pg_catalog.date_trunc('month', period_month)::date),
  constraint payroll_periods_pay_date_check
    check (pay_date = (period_month + interval '1 month' + interval '27 days')::date),
  constraint payroll_periods_status_check
    check (status in ('draft', 'review', 'approved')),
  constraint payroll_periods_lifecycle_check
    check (
      (status = 'draft' and reviewed_by is null and reviewed_at is null and approved_by is null and approved_at is null)
      or (status = 'review' and reviewed_by is not null and reviewed_at is not null and approved_by is null and approved_at is null)
      or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and approved_by is not null and approved_at is not null)
    ),
  unique (period_month)
);

create index payroll_periods_status_month_idx
  on public.payroll_periods (status, period_month desc);

create table public.payroll_statements (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  staff_display_name_snapshot text not null,
  staff_employee_code_snapshot text,
  work_units integer not null default 0,
  work_hours integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_statements_work_units_check check (work_units >= 0),
  constraint payroll_statements_work_hours_check check (work_hours = work_units * 9),
  unique (payroll_period_id, staff_id)
);

create index payroll_statements_staff_period_idx
  on public.payroll_statements (staff_id, payroll_period_id);

create table public.payroll_line_items (
  id uuid primary key default gen_random_uuid(),
  payroll_statement_id uuid not null references public.payroll_statements(id) on delete restrict,
  line_type text not null,
  direction text not null,
  amount_vnd bigint not null,
  unit_count integer,
  unit_rate_vnd bigint,
  source_time_entry_id uuid references public.time_entries(id) on delete restrict,
  staff_rate_version_id uuid references public.staff_rate_versions(id) on delete restrict,
  note text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint payroll_line_items_type_check
    check (line_type in ('hourly_wage', 'revenue_bonus', 'kpi_bonus', 'grading_bonus', 'commission', 'manual_reward', 'manual_deduction', 'advance_deduction')),
  constraint payroll_line_items_direction_check check (direction in ('earning', 'deduction')),
  constraint payroll_line_items_amount_check check (amount_vnd > 0),
  constraint payroll_line_items_direction_by_type_check
    check (
      (line_type in ('hourly_wage', 'revenue_bonus', 'kpi_bonus', 'grading_bonus', 'commission', 'manual_reward') and direction = 'earning')
      or (line_type in ('manual_deduction', 'advance_deduction') and direction = 'deduction')
    ),
  constraint payroll_line_items_hourly_snapshot_check
    check (
      (line_type = 'hourly_wage' and unit_count = 9 and unit_rate_vnd is not null and source_time_entry_id is not null and staff_rate_version_id is not null)
      or (line_type <> 'hourly_wage' and unit_count is null and unit_rate_vnd is null and source_time_entry_id is null and staff_rate_version_id is null)
    ),
  constraint payroll_line_items_note_check
    check (note is null or (note = pg_catalog.btrim(note) and note <> '' and pg_catalog.length(note) <= 2000)),
  unique (payroll_statement_id, source_time_entry_id)
);

create index payroll_line_items_statement_idx
  on public.payroll_line_items (payroll_statement_id, created_at);

create or replace function public.protect_payroll_period_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'review'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.approved_by is null
    and new.approved_at is null
  then
    return new;
  end if;

  if old.status = 'review' and new.status = 'approved'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_HISTORY_IS_IMMUTABLE';
end;
$$;

create or replace function public.prevent_payroll_statement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'PAYROLL_STATEMENTS_ARE_IMMUTABLE';
end;
$$;

create or replace function public.prevent_payroll_line_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'PAYROLL_LINE_ITEMS_ARE_IMMUTABLE';
end;
$$;

revoke all on function public.protect_payroll_period_history() from public, anon, authenticated;
revoke all on function public.prevent_payroll_statement_mutation() from public, anon, authenticated;
revoke all on function public.prevent_payroll_line_item_mutation() from public, anon, authenticated;

create trigger payroll_periods_protect_history
before update or delete on public.payroll_periods
for each row execute function public.protect_payroll_period_history();

create trigger payroll_statements_prevent_mutation
before update or delete on public.payroll_statements
for each row execute function public.prevent_payroll_statement_mutation();

create trigger payroll_line_items_prevent_mutation
before update or delete on public.payroll_line_items
for each row execute function public.prevent_payroll_line_item_mutation();

create or replace function public.audit_payroll_period_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'payroll_draft_created';
  elsif new.status = 'review' then
    audit_action := 'payroll_submitted_for_review';
  elsif new.status = 'approved' then
    audit_action := 'payroll_approved';
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_PAYROLL_PERIOD_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata)
  values (
    pg_catalog.coalesce(auth.uid(), new.generated_by),
    'payroll',
    audit_action,
    'payroll_period',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'payroll_workflow')
  );

  return new;
end;
$$;

create or replace function public.audit_payroll_line_item_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, new_data, metadata)
  values (
    pg_catalog.coalesce(new.created_by, auth.uid()),
    'payroll',
    case when new.line_type in ('manual_reward', 'manual_deduction') then 'payroll_manual_line_added' else 'payroll_line_calculated' end,
    'payroll_line_item',
    new.id::text,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('source', 'payroll_workflow')
  );

  return new;
end;
$$;

revoke all on function public.audit_payroll_period_change() from public, anon, authenticated;
revoke all on function public.audit_payroll_line_item_insert() from public, anon, authenticated;

create trigger payroll_periods_audit_change
after insert or update on public.payroll_periods
for each row execute function public.audit_payroll_period_change();

create trigger payroll_line_items_audit_insert
after insert on public.payroll_line_items
for each row execute function public.audit_payroll_line_item_insert();

alter table public.payroll_periods enable row level security;
alter table public.payroll_statements enable row level security;
alter table public.payroll_line_items enable row level security;

create policy payroll_periods_select
on public.payroll_periods for select to authenticated
using (public.has_permission('payroll.view'));

create policy payroll_statements_select
on public.payroll_statements for select to authenticated
using (
  public.has_permission('payroll.view')
  and (
    staff_id = (select auth.uid())
    or public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve')
  )
);

create policy payroll_line_items_select
on public.payroll_line_items for select to authenticated
using (
  public.has_permission('payroll.view')
  and exists (
    select 1
    from public.payroll_statements as statement
    where statement.id = payroll_line_items.payroll_statement_id
      and (
        statement.staff_id = (select auth.uid())
        or public.has_permission('payroll.manage')
        or public.has_permission('payroll.accountant_reconcile')
        or public.has_permission('payroll.owner_approve')
      )
  )
);

revoke all privileges on public.payroll_periods, public.payroll_statements, public.payroll_line_items from public, anon, authenticated;
grant select on public.payroll_periods, public.payroll_statements, public.payroll_line_items to authenticated;

create or replace function public.create_payroll_draft(p_period_month date)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_month date := pg_catalog.date_trunc('month', p_period_month)::date;
  created_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_period_month is null or p_period_month <> normalized_month then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_MONTH_INVALID';
  end if;

  if normalized_month >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception using errcode = '22023', message = 'PAYROLL_PERIOD_NOT_CLOSED';
  end if;

  if exists (select 1 from public.payroll_periods where period_month = normalized_month) then
    raise exception using errcode = '23505', message = 'PAYROLL_PERIOD_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.time_entries as entry
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and not exists (
        select 1
        from public.staff_rate_versions as rate
        where rate.staff_id = entry.staff_id
          and rate.effective_from <= entry.work_date
      )
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_RATE_VERSION_NOT_FOUND';
  end if;

  insert into public.payroll_periods (period_month, pay_date, status, generated_by)
  values (
    normalized_month,
    (normalized_month + interval '1 month' + interval '27 days')::date,
    'draft',
    actor_id
  )
  returning * into created_period;

  with effective_entries as (
    select
      entry.id as time_entry_id,
      entry.staff_id,
      rate.id as rate_version_id,
      case
        when pg_catalog.coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
          then rate.online_hourly_rate_vnd
        else rate.offline_hourly_rate_vnd
      end as hourly_rate_vnd
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_mode
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id
        and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_hourly_rate_vnd, rate.online_hourly_rate_vnd
      from public.staff_rate_versions as rate
      where rate.staff_id = entry.staff_id
        and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
  )
  insert into public.payroll_statements (
    payroll_period_id,
    staff_id,
    staff_display_name_snapshot,
    staff_employee_code_snapshot,
    work_units,
    work_hours
  )
  select
    created_period.id,
    entry.staff_id,
    pg_catalog.coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    pg_catalog.count(*)::integer,
    (pg_catalog.count(*) * 9)::integer
  from effective_entries as entry
  join public.profiles as profile on profile.id = entry.staff_id
  group by entry.staff_id, profile.display_name, profile.email, profile.employee_code;

  with effective_entries as (
    select
      entry.id as time_entry_id,
      entry.staff_id,
      rate.id as rate_version_id,
      case
        when pg_catalog.coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
          then rate.online_hourly_rate_vnd
        else rate.offline_hourly_rate_vnd
      end as hourly_rate_vnd
    from public.time_entries as entry
    left join lateral (
      select request.requested_check_in_mode
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id
        and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_hourly_rate_vnd, rate.online_hourly_rate_vnd
      from public.staff_rate_versions as rate
      where rate.staff_id = entry.staff_id
        and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= normalized_month
      and entry.work_date < (normalized_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
  )
  insert into public.payroll_line_items (
    payroll_statement_id,
    line_type,
    direction,
    amount_vnd,
    unit_count,
    unit_rate_vnd,
    source_time_entry_id,
    staff_rate_version_id,
    note,
    created_by
  )
  select
    statement.id,
    'hourly_wage',
    'earning',
    entry.hourly_rate_vnd * 9,
    9,
    entry.hourly_rate_vnd,
    entry.time_entry_id,
    entry.rate_version_id,
    '1 công × 9 giờ',
    actor_id
  from effective_entries as entry
  join public.payroll_statements as statement
    on statement.payroll_period_id = created_period.id
    and statement.staff_id = entry.staff_id;

  return created_period;
end;
$$;

create or replace function public.add_payroll_manual_line(
  p_payroll_statement_id uuid,
  p_line_type text,
  p_amount_vnd bigint,
  p_note text
)
returns public.payroll_line_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_type text := pg_catalog.lower(pg_catalog.btrim(p_line_type));
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  statement_period record;
  created_line public.payroll_line_items%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;

  if normalized_type not in ('manual_reward', 'manual_deduction') then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_LINE_TYPE_INVALID';
  end if;

  if p_amount_vnd is null or p_amount_vnd <= 0 then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_LINE_AMOUNT_INVALID';
  end if;

  if normalized_note is null or pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_MANUAL_LINE_NOTE_INVALID';
  end if;

  select statement.id, period.status
  into statement_period
  from public.payroll_statements as statement
  join public.payroll_periods as period on period.id = statement.payroll_period_id
  where statement.id = p_payroll_statement_id
  for share of statement, period;

  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_STATEMENT_NOT_FOUND';
  end if;

  if statement_period.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;

  insert into public.payroll_line_items (
    payroll_statement_id,
    line_type,
    direction,
    amount_vnd,
    note,
    created_by
  )
  values (
    statement_period.id,
    normalized_type,
    case when normalized_type = 'manual_reward' then 'earning' else 'deduction' end,
    p_amount_vnd,
    normalized_note,
    actor_id
  )
  returning * into created_line;

  return created_line;
end;
$$;

create or replace function public.submit_payroll_for_review(p_payroll_period_id uuid)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.accountant_reconcile') then
    raise exception using errcode = '42501', message = 'PAYROLL_ACCOUNTANT_RECONCILE_PERMISSION_REQUIRED';
  end if;

  update public.payroll_periods
  set status = 'review', reviewed_by = actor_id, reviewed_at = pg_catalog.now()
  where id = p_payroll_period_id and status = 'draft'
  returning * into updated_period;

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;

  return updated_period;
end;
$$;

create or replace function public.approve_payroll_period(p_payroll_period_id uuid)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.owner_approve') then
    raise exception using errcode = '42501', message = 'PAYROLL_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;

  update public.payroll_periods
  set status = 'approved', approved_by = actor_id, approved_at = pg_catalog.now()
  where id = p_payroll_period_id and status = 'review'
  returning * into updated_period;

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_REVIEW';
  end if;

  return updated_period;
end;
$$;

revoke all on function public.create_payroll_draft(date) from public, anon;
revoke all on function public.add_payroll_manual_line(uuid, text, bigint, text) from public, anon;
revoke all on function public.submit_payroll_for_review(uuid) from public, anon;
revoke all on function public.approve_payroll_period(uuid) from public, anon;
grant execute on function public.create_payroll_draft(date) to authenticated;
grant execute on function public.add_payroll_manual_line(uuid, text, bigint, text) to authenticated;
grant execute on function public.submit_payroll_for_review(uuid) to authenticated;
grant execute on function public.approve_payroll_period(uuid) to authenticated;

create or replace function public.get_payroll_dashboard()
returns table (
  payroll_period_id uuid,
  period_month date,
  pay_date date,
  period_status text,
  staff_id uuid,
  payroll_statement_id uuid,
  staff_display_name text,
  staff_employee_code text,
  work_units integer,
  work_hours integer,
  total_earnings_vnd bigint,
  total_deductions_vnd bigint,
  payable_amount_vnd bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_see_all boolean;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.view') then
    raise exception using errcode = '42501', message = 'PAYROLL_VIEW_PERMISSION_REQUIRED';
  end if;

  can_see_all := public.has_permission('payroll.manage')
    or public.has_permission('payroll.accountant_reconcile')
    or public.has_permission('payroll.owner_approve');

  return query
  select
    period.id,
    period.period_month,
    period.pay_date,
    period.status,
    statement.staff_id,
    statement.id,
    statement.staff_display_name_snapshot,
    statement.staff_employee_code_snapshot,
    statement.work_units,
    statement.work_hours,
    pg_catalog.coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'), 0)::bigint,
    pg_catalog.coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)::bigint,
    (
      pg_catalog.coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'earning'), 0)
      - pg_catalog.coalesce(pg_catalog.sum(line.amount_vnd) filter (where line.direction = 'deduction'), 0)
    )::bigint
  from public.payroll_periods as period
  join public.payroll_statements as statement on statement.payroll_period_id = period.id
  left join public.payroll_line_items as line on line.payroll_statement_id = statement.id
  where can_see_all or statement.staff_id = actor_id
  group by
    period.id,
    period.period_month,
    period.pay_date,
    period.status,
    statement.staff_id,
    statement.id,
    statement.staff_display_name_snapshot,
    statement.staff_employee_code_snapshot,
    statement.work_units,
    statement.work_hours
  order by period.period_month desc, statement.staff_display_name_snapshot asc;
end;
$$;

revoke all on function public.get_payroll_dashboard() from public, anon;
grant execute on function public.get_payroll_dashboard() to authenticated;

commit;
