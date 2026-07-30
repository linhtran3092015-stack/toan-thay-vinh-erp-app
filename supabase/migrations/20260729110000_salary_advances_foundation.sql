begin;

-- TASK 8H: salary advances are requested by staff, reconciled by accounting,
-- approved by the owner, then deducted once from their chosen fixed-month
-- payroll period. The deduction is an immutable payroll line snapshot.

insert into public.permissions (code, module, name, description)
values
  ('advances.view', 'advances', 'Xem tạm ứng', 'Nhân sự xem yêu cầu tạm ứng của chính mình; người đối soát hoặc duyệt xem được toàn bộ.'),
  ('advances.request', 'advances', 'Yêu cầu tạm ứng', 'Tạo yêu cầu tạm ứng lương cho chính mình.'),
  ('advances.review', 'advances', 'Đối soát tạm ứng', 'Đối soát hoặc từ chối yêu cầu tạm ứng trước khi chủ trung tâm duyệt.'),
  ('advances.owner_approve', 'advances', 'Duyệt tạm ứng', 'Duyệt hoặc từ chối cuối cùng yêu cầu tạm ứng.')
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
    permission.code in ('advances.view', 'advances.request')
    or (permission.code = 'advances.review' and role.code in ('owner', 'accountant'))
    or (permission.code = 'advances.owner_approve' and role.code = 'owner')
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

create table public.salary_advances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  amount_vnd bigint not null,
  request_note text not null,
  deduction_period_month date not null,
  status text not null default 'requested',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default pg_catalog.now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  approval_note text,
  rejected_by uuid references public.profiles(id) on delete restrict,
  rejected_at timestamptz,
  rejection_reason text,
  deducted_at timestamptz,
  deduction_payroll_period_id uuid references public.payroll_periods(id) on delete restrict,
  constraint salary_advances_amount_check check (amount_vnd > 0),
  constraint salary_advances_request_note_check
    check (request_note = pg_catalog.btrim(request_note) and request_note <> '' and pg_catalog.length(request_note) <= 2000),
  constraint salary_advances_period_month_check
    check (deduction_period_month = pg_catalog.date_trunc('month', deduction_period_month)::date),
  constraint salary_advances_status_check
    check (status in ('requested', 'review', 'approved', 'rejected', 'deducted')),
  constraint salary_advances_review_note_check
    check (review_note is null or (review_note = pg_catalog.btrim(review_note) and review_note <> '' and pg_catalog.length(review_note) <= 2000)),
  constraint salary_advances_approval_note_check
    check (approval_note is null or (approval_note = pg_catalog.btrim(approval_note) and approval_note <> '' and pg_catalog.length(approval_note) <= 2000)),
  constraint salary_advances_rejection_reason_check
    check (rejection_reason is null or (rejection_reason = pg_catalog.btrim(rejection_reason) and rejection_reason <> '' and pg_catalog.length(rejection_reason) <= 2000))
);

create index salary_advances_staff_status_idx
  on public.salary_advances (staff_id, status, requested_at desc);

create index salary_advances_deduction_period_idx
  on public.salary_advances (deduction_period_month, status)
  where status in ('approved', 'deducted');

alter table public.payroll_line_items
  add column salary_advance_id uuid references public.salary_advances(id) on delete restrict;

alter table public.payroll_line_items
  add constraint payroll_line_items_salary_advance_check
  check (
    (line_type = 'advance_deduction' and salary_advance_id is not null)
    or (line_type <> 'advance_deduction' and salary_advance_id is null)
  );

create unique index payroll_line_items_salary_advance_unique_idx
  on public.payroll_line_items (salary_advance_id)
  where salary_advance_id is not null;

create or replace function public.protect_salary_advance_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCES_CANNOT_BE_DELETED';
  end if;

  if new.id is distinct from old.id
    or new.staff_id is distinct from old.staff_id
    or new.amount_vnd is distinct from old.amount_vnd
    or new.request_note is distinct from old.request_note
    or new.deduction_period_month is distinct from old.deduction_period_month
    or new.requested_by is distinct from old.requested_by
    or new.requested_at is distinct from old.requested_at
  then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCE_REQUEST_IS_IMMUTABLE';
  end if;

  if old.status = 'requested' and new.status = 'review'
    and new.reviewed_by is not null
    and new.reviewed_at is not null
    and new.approved_by is null
    and new.approved_at is null
    and new.rejected_by is null
    and new.rejected_at is null
    and new.rejection_reason is null
    and new.deducted_at is null
    and new.deduction_payroll_period_id is null
  then
    return new;
  end if;

  if old.status = 'requested' and new.status = 'rejected'
    and new.reviewed_by is null
    and new.reviewed_at is null
    and new.approved_by is null
    and new.approved_at is null
    and new.rejected_by is not null
    and new.rejected_at is not null
    and new.rejection_reason is not null
    and new.deducted_at is null
    and new.deduction_payroll_period_id is null
  then
    return new;
  end if;

  if old.status = 'review' and new.status = 'approved'
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.review_note is not distinct from old.review_note
    and new.approved_by is not null
    and new.approved_at is not null
    and new.rejected_by is null
    and new.rejected_at is null
    and new.rejection_reason is null
    and new.deducted_at is null
    and new.deduction_payroll_period_id is null
  then
    return new;
  end if;

  if old.status = 'review' and new.status = 'rejected'
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.review_note is not distinct from old.review_note
    and new.approved_by is null
    and new.approved_at is null
    and new.rejected_by is not null
    and new.rejected_at is not null
    and new.rejection_reason is not null
    and new.deducted_at is null
    and new.deduction_payroll_period_id is null
  then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'deducted'
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.review_note is not distinct from old.review_note
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
    and new.approval_note is not distinct from old.approval_note
    and new.rejected_by is null
    and new.rejected_at is null
    and new.rejection_reason is null
    and new.deducted_at is not null
    and new.deduction_payroll_period_id is not null
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'SALARY_ADVANCE_HISTORY_IS_IMMUTABLE';
end;
$$;

create or replace function public.audit_salary_advance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_actor_id uuid;
begin
  if tg_op = 'INSERT' then
    audit_action := 'salary_advance_requested';
    audit_actor_id := new.requested_by;
  elsif new.status = 'review' then
    audit_action := 'salary_advance_reviewed';
    audit_actor_id := new.reviewed_by;
  elsif new.status = 'approved' then
    audit_action := 'salary_advance_approved';
    audit_actor_id := new.approved_by;
  elsif new.status = 'rejected' then
    audit_action := 'salary_advance_rejected';
    audit_actor_id := new.rejected_by;
  elsif new.status = 'deducted' then
    audit_action := 'salary_advance_deducted';
    audit_actor_id := coalesce(auth.uid(), new.requested_by);
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_SALARY_ADVANCE_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (actor_user_id, module, action, entity_type, entity_id, old_data, new_data, reason, metadata)
  values (
    audit_actor_id,
    'advances',
    audit_action,
    'salary_advance',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    case
      when new.status = 'rejected' then new.rejection_reason
      when new.status = 'review' then new.review_note
      when new.status = 'approved' then new.approval_note
      else null
    end,
    pg_catalog.jsonb_build_object('source', 'salary_advance_workflow')
  );

  return new;
end;
$$;

revoke all on function public.protect_salary_advance_history() from public, anon, authenticated;
revoke all on function public.audit_salary_advance_change() from public, anon, authenticated;

create trigger salary_advances_protect_history
before update or delete on public.salary_advances
for each row execute function public.protect_salary_advance_history();

create trigger salary_advances_audit_changes
after insert or update on public.salary_advances
for each row execute function public.audit_salary_advance_change();

alter table public.salary_advances enable row level security;

create policy salary_advances_select_authorized
on public.salary_advances
for select
to authenticated
using (
  public.has_permission('advances.view')
  and (
    staff_id = (select auth.uid())
    or public.has_permission('advances.review')
    or public.has_permission('advances.owner_approve')
  )
);

revoke all privileges on public.salary_advances from public, anon, authenticated;
grant select on public.salary_advances to authenticated;

create or replace function public.request_salary_advance(
  p_amount_vnd bigint,
  p_deduction_period_month date,
  p_request_note text
)
returns public.salary_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_month date := pg_catalog.date_trunc('month', p_deduction_period_month)::date;
  normalized_note text := nullif(pg_catalog.btrim(p_request_note), '');
  created_advance public.salary_advances%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('advances.request') then
    raise exception using errcode = '42501', message = 'ADVANCES_REQUEST_PERMISSION_REQUIRED';
  end if;

  if p_amount_vnd is null or p_amount_vnd <= 0 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_AMOUNT_INVALID';
  end if;

  if p_deduction_period_month is null or p_deduction_period_month <> normalized_month then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_DEDUCTION_MONTH_INVALID';
  end if;

  if normalized_month < pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_DEDUCTION_MONTH_IN_PAST';
  end if;

  if normalized_note is null or pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REQUEST_NOTE_INVALID';
  end if;

  insert into public.salary_advances (
    staff_id,
    amount_vnd,
    request_note,
    deduction_period_month,
    status,
    requested_by
  )
  values (
    actor_id,
    p_amount_vnd,
    normalized_note,
    normalized_month,
    'requested',
    actor_id
  )
  returning * into created_advance;

  return created_advance;
end;
$$;

create or replace function public.review_salary_advance(
  p_salary_advance_id uuid,
  p_decision text,
  p_note text
)
returns public.salary_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  updated_advance public.salary_advances%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('advances.review') then
    raise exception using errcode = '42501', message = 'ADVANCES_REVIEW_PERMISSION_REQUIRED';
  end if;

  if normalized_decision not in ('review', 'rejected') then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REVIEW_DECISION_INVALID';
  end if;

  if normalized_decision = 'rejected' and normalized_note is null then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REJECTION_REASON_REQUIRED';
  end if;

  if normalized_note is not null and pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REVIEW_NOTE_INVALID';
  end if;

  if normalized_decision = 'review' then
    update public.salary_advances
    set status = 'review', reviewed_by = actor_id, reviewed_at = pg_catalog.now(), review_note = normalized_note
    where id = p_salary_advance_id and status = 'requested'
    returning * into updated_advance;
  else
    update public.salary_advances
    set status = 'rejected', rejected_by = actor_id, rejected_at = pg_catalog.now(), rejection_reason = normalized_note
    where id = p_salary_advance_id and status = 'requested'
    returning * into updated_advance;
  end if;

  if not found then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCE_NOT_REQUESTED';
  end if;

  return updated_advance;
end;
$$;

create or replace function public.approve_salary_advance(
  p_salary_advance_id uuid,
  p_decision text,
  p_note text
)
returns public.salary_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(p_decision));
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
  updated_advance public.salary_advances%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('advances.owner_approve') then
    raise exception using errcode = '42501', message = 'ADVANCES_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;

  if normalized_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_APPROVAL_DECISION_INVALID';
  end if;

  if normalized_decision = 'rejected' and normalized_note is null then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_REJECTION_REASON_REQUIRED';
  end if;

  if normalized_note is not null and pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'SALARY_ADVANCE_APPROVAL_NOTE_INVALID';
  end if;

  if normalized_decision = 'approved' then
    update public.salary_advances
    set status = 'approved', approved_by = actor_id, approved_at = pg_catalog.now(), approval_note = normalized_note
    where id = p_salary_advance_id and status = 'review'
    returning * into updated_advance;
  else
    update public.salary_advances
    set status = 'rejected', rejected_by = actor_id, rejected_at = pg_catalog.now(), rejection_reason = normalized_note
    where id = p_salary_advance_id and status = 'review'
    returning * into updated_advance;
  end if;

  if not found then
    raise exception using errcode = '23514', message = 'SALARY_ADVANCE_NOT_REVIEWED';
  end if;

  return updated_advance;
end;
$$;

revoke all on function public.request_salary_advance(bigint, date, text) from public, anon;
revoke all on function public.review_salary_advance(uuid, text, text) from public, anon;
revoke all on function public.approve_salary_advance(uuid, text, text) from public, anon;
grant execute on function public.request_salary_advance(bigint, date, text) to authenticated;
grant execute on function public.review_salary_advance(uuid, text, text) to authenticated;
grant execute on function public.approve_salary_advance(uuid, text, text) to authenticated;

create or replace function public.get_salary_advances_dashboard()
returns table (
  salary_advance_id uuid,
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  amount_vnd bigint,
  request_note text,
  deduction_period_month date,
  advance_status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  reviewed_by_display_name text,
  approved_at timestamptz,
  approval_note text,
  approved_by_display_name text,
  rejected_at timestamptz,
  rejection_reason text,
  rejected_by_display_name text,
  deducted_at timestamptz,
  deduction_payroll_period_id uuid
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

  if not public.has_permission('advances.view') then
    raise exception using errcode = '42501', message = 'ADVANCES_VIEW_PERMISSION_REQUIRED';
  end if;

  can_see_all := public.has_permission('advances.review')
    or public.has_permission('advances.owner_approve');

  return query
  select
    salary_advance.id,
    salary_advance.staff_id,
    coalesce(nullif(pg_catalog.btrim(staff.display_name), ''), staff.email),
    staff.employee_code,
    salary_advance.amount_vnd,
    salary_advance.request_note,
    salary_advance.deduction_period_month,
    salary_advance.status,
    salary_advance.requested_at,
    salary_advance.reviewed_at,
    salary_advance.review_note,
    coalesce(nullif(pg_catalog.btrim(reviewer.display_name), ''), reviewer.email),
    salary_advance.approved_at,
    salary_advance.approval_note,
    coalesce(nullif(pg_catalog.btrim(approver.display_name), ''), approver.email),
    salary_advance.rejected_at,
    salary_advance.rejection_reason,
    coalesce(nullif(pg_catalog.btrim(rejector.display_name), ''), rejector.email),
    salary_advance.deducted_at,
    salary_advance.deduction_payroll_period_id
  from public.salary_advances as salary_advance
  join public.profiles as staff on staff.id = salary_advance.staff_id
  left join public.profiles as reviewer on reviewer.id = salary_advance.reviewed_by
  left join public.profiles as approver on approver.id = salary_advance.approved_by
  left join public.profiles as rejector on rejector.id = salary_advance.rejected_by
  where can_see_all or salary_advance.staff_id = actor_id
  order by salary_advance.requested_at desc;
end;
$$;

revoke all on function public.get_salary_advances_dashboard() from public, anon;
grant execute on function public.get_salary_advances_dashboard() to authenticated;

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
        when coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
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
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    pg_catalog.count(*)::integer,
    (pg_catalog.count(*) * 9)::integer
  from effective_entries as entry
  join public.profiles as profile on profile.id = entry.staff_id
  group by entry.staff_id, profile.display_name, profile.email, profile.employee_code;

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
    salary_advance.staff_id,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    0,
    0
  from public.salary_advances as salary_advance
  join public.profiles as profile on profile.id = salary_advance.staff_id
  where salary_advance.status = 'approved'
    and salary_advance.deduction_period_month = normalized_month
  on conflict (payroll_period_id, staff_id) do nothing;

  with effective_entries as (
    select
      entry.id as time_entry_id,
      entry.staff_id,
      rate.id as rate_version_id,
      case
        when coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) = 'online'
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

  insert into public.payroll_line_items (
    payroll_statement_id,
    line_type,
    direction,
    amount_vnd,
    note,
    created_by,
    salary_advance_id
  )
  select
    statement.id,
    'advance_deduction',
    'deduction',
    salary_advance.amount_vnd,
    'Khấu trừ tạm ứng lương',
    actor_id,
    salary_advance.id
  from public.salary_advances as salary_advance
  join public.payroll_statements as statement
    on statement.payroll_period_id = created_period.id
    and statement.staff_id = salary_advance.staff_id
  where salary_advance.status = 'approved'
    and salary_advance.deduction_period_month = normalized_month;

  update public.salary_advances as salary_advance
  set
    status = 'deducted',
    deducted_at = pg_catalog.now(),
    deduction_payroll_period_id = created_period.id
  where salary_advance.status = 'approved'
    and salary_advance.deduction_period_month = normalized_month;

  return created_period;
end;
$$;

revoke all on function public.create_payroll_draft(date) from public, anon;
grant execute on function public.create_payroll_draft(date) to authenticated;

commit;
