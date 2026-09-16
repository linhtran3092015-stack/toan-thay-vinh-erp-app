begin;

-- Missing mid-shift location is not evidence that somebody stopped working.
-- This applies to already-open shifts too: no historical times are rewritten.
create or replace function public.run_teaching_assistant_timekeeping_watchdog()
returns integer language plpgsql security definer set search_path = '' as $$
declare closed_count integer;
begin
  update public.time_entries as entry
  set check_out_at = greatest(entry.check_in_at, (entry.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh'),
      check_out_mode = 'auto_end', status = 'auto_ended', clock_out_reason = 'daily_cutoff',
      auto_ended_at = greatest(entry.check_in_at, (entry.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh'),
      updated_at = pg_catalog.now()
  where entry.status = 'open'
    and pg_catalog.now() >= (entry.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh';
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;
revoke all on function public.run_teaching_assistant_timekeeping_watchdog() from public, anon, authenticated;

-- Old browser tabs may still send heartbeats. They must not auto-end a shift.
create or replace function public.submit_attendance_heartbeat(
  p_gps_latitude numeric, p_gps_longitude numeric, p_gps_accuracy_meters integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;
  return pg_catalog.jsonb_build_object(
    'session_active', exists(select 1 from public.time_entries where staff_id = auth.uid() and status = 'open'),
    'gps_verification_required', false,
    'reason', 'endpoint_verification',
    'message_vi', 'Vị trí được xác minh khi check-in và check-out.'
  );
end;
$$;
revoke all on function public.submit_attendance_heartbeat(numeric, numeric, integer) from public, anon;
grant execute on function public.submit_attendance_heartbeat(numeric, numeric, integer) to authenticated;

-- Retain the established configuration and permission checks.
alter function public.get_attendance_verification_policy() rename to get_attendance_verification_policy_before_endpoint;
revoke all on function public.get_attendance_verification_policy_before_endpoint() from public, anon, authenticated;
create function public.get_attendance_verification_policy()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.get_attendance_verification_policy_before_endpoint()
    || '{"continuous_gps_tracking_required":false,"exception_review_enabled":true}'::jsonb;
$$;
revoke all on function public.get_attendance_verification_policy() from public, anon;
grant execute on function public.get_attendance_verification_policy() to authenticated;

-- A review is separate from shift lifecycle. Staff can end a shift while its
-- evidence awaits review. Original timestamps/evidence remain immutable.
create table public.attendance_exception_reviews (
  time_entry_id uuid primary key references public.time_entries(id) on delete restrict,
  check_in_reason text,
  check_out_reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  decision_reason text,
  constraint attendance_exception_has_reason check (
    nullif(btrim(check_in_reason),'') is not null or nullif(btrim(check_out_reason),'') is not null
  ),
  constraint attendance_exception_decision_complete check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and decision_reason is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null and nullif(btrim(decision_reason),'') is not null)
  )
);
create table public.attendance_exception_submissions (
  request_id uuid primary key,
  staff_id uuid not null references public.profiles(id),
  operation text not null check (operation in ('check-in','check-out')),
  time_entry_id uuid not null references public.time_entries(id),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.attendance_exception_reviews enable row level security;
alter table public.attendance_exception_submissions enable row level security;
revoke all on public.attendance_exception_reviews, public.attendance_exception_submissions from public, anon, authenticated;

create function public.time_entry_is_verified(p_entry_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.attendance_exception_reviews
    where time_entry_id = p_entry_id and status <> 'approved'
  );
$$;
revoke all on function public.time_entry_is_verified(uuid) from public, anon, authenticated;

create function public.request_attendance_exception(
  p_operation text, p_reason text, p_request_id uuid, p_time_entry_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  submission public.attendance_exception_submissions%rowtype;
  target public.time_entries%rowtype;
  assignment_id uuid;
  business_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  business_time time := (now() at time zone 'Asia/Ho_Chi_Minh')::time;
  normalized_reason text := nullif(btrim(p_reason), '');
begin
  if actor_id is null or not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;
  if p_operation is null or p_operation not in ('check-in','check-out') or p_request_id is null
    or normalized_reason is null or length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'ATTENDANCE_EXCEPTION_INPUT_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('time-entry:' || actor_id::text));
  select * into submission from public.attendance_exception_submissions where request_id = p_request_id;
  if found then
    if submission.staff_id <> actor_id or submission.operation <> p_operation or submission.reason <> normalized_reason
      or (p_operation = 'check-out' and submission.time_entry_id is distinct from p_time_entry_id) then
      raise exception using errcode = '22023', message = 'ATTENDANCE_EXCEPTION_REQUEST_CONFLICT';
    end if;
    return submission.time_entry_id;
  end if;

  if p_operation = 'check-in' then
    if not exists (select 1 from public.profiles where id = actor_id and employment_status = 'active') then
      raise exception using errcode = '42501', message = 'TIME_ENTRY_REQUIRES_ACTIVE_STAFF';
    end if;
    if business_time >= time '23:30' then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECKIN_CUTOFF_REACHED';
    end if;
    perform public.run_teaching_assistant_timekeeping_watchdog();
    if exists (select 1 from public.time_entries where staff_id = actor_id and status = 'open') then
      raise exception using errcode = '23505', message = 'TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS';
    end if;
    select a.id into assignment_id
    from public.staff_shift_assignments a join public.work_shifts s on s.id = a.work_shift_id
    where a.staff_id = actor_id and a.is_active and s.is_active
      and a.effective_from <= business_date and (a.effective_to is null or a.effective_to >= business_date)
      and (a.weekday = extract(isodow from business_date)
        or (s.crosses_midnight and a.weekday = extract(isodow from business_date - 1) and business_time < s.end_time))
    order by case when a.weekday = extract(isodow from business_date) then 0 else 1 end, a.id
    limit 1 for share of a;
    insert into public.time_entries(staff_id, staff_shift_assignment_id, work_date, check_in_at, check_in_mode, status)
      values(actor_id, assignment_id, business_date, now(), 'offline', 'open') returning * into target;
    insert into public.attendance_exception_reviews(time_entry_id, check_in_reason)
      values(target.id, normalized_reason);
  else
    select * into target from public.time_entries where id = p_time_entry_id and staff_id = actor_id for update;
    if not found or target.status <> 'open' or target.check_in_mode <> 'offline' then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_OPEN_ENTRY_NOT_FOUND';
    end if;
    if target.work_date <> business_date or business_time >= time '23:30' then
      raise exception using errcode = '23514', message = 'ATTENDANCE_EXCEPTION_USE_ADJUSTMENT';
    end if;
    insert into public.attendance_exception_reviews(time_entry_id, check_out_reason)
      values(target.id, normalized_reason)
      on conflict (time_entry_id) do update set check_out_reason = excluded.check_out_reason;
    update public.time_entries set check_out_at = now(), check_out_mode = 'offline', status = 'checked_out', clock_out_reason = 'manual'
      where id = target.id;
  end if;
  insert into public.attendance_exception_submissions(request_id, staff_id, operation, time_entry_id, reason)
    values(p_request_id, actor_id, p_operation, target.id, normalized_reason);
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,metadata)
    values(actor_id,'timekeeping','attendance_exception_requested','time_entry',target.id::text,
      pg_catalog.jsonb_build_object('operation',p_operation,'reason',normalized_reason,'request_id',p_request_id));
  return target.id;
end;
$$;
revoke all on function public.request_attendance_exception(text,text,uuid,uuid) from public, anon;
grant execute on function public.request_attendance_exception(text,text,uuid,uuid) to authenticated;

create function public.decide_attendance_exception(p_entry_id uuid, p_decision text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.time_entries%rowtype; review public.attendance_exception_reviews%rowtype;
begin
  if auth.uid() is null or not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_ADJUSTMENT_APPROVAL_PERMISSION_REQUIRED';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') or nullif(btrim(p_reason),'') is null or length(p_reason) > 2000 then
    raise exception using errcode = '22023', message = 'ATTENDANCE_EXCEPTION_INPUT_INVALID';
  end if;
  select * into target from public.time_entries where id = p_entry_id for update;
  if not found or target.status = 'open' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_NOT_CLOSED';
  end if;
  if target.staff_id = auth.uid() then
    raise exception using errcode = '42501', message = 'TIME_ENTRY_ADJUSTMENT_SELF_REVIEW_FORBIDDEN';
  end if;
  select * into review from public.attendance_exception_reviews where time_entry_id = p_entry_id for update;
  if not found or review.status <> 'pending' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_ADJUSTMENT_ALREADY_DECIDED';
  end if;
  update public.attendance_exception_reviews set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(), decision_reason = btrim(p_reason)
    where time_entry_id = p_entry_id;
  insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data,metadata)
    values(auth.uid(),'timekeeping','attendance_exception_decided','time_entry',p_entry_id::text,
      pg_catalog.to_jsonb(review), pg_catalog.jsonb_build_object('status',p_decision),
      pg_catalog.jsonb_build_object('reason',btrim(p_reason)));
  return p_entry_id;
end;
$$;
revoke all on function public.decide_attendance_exception(uuid,text,text) from public, anon;
grant execute on function public.decide_attendance_exception(uuid,text,text) to authenticated;

create function public.get_attendance_exception_reviews()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED'; end if;
  return (select coalesce(jsonb_agg(row_to_json(item) order by item.requested_at desc), '[]'::jsonb) from (
    select e.id, e.staff_id, p.display_name as staff_name, e.check_in_at, e.check_out_at,
      e.work_date, e.status as entry_status, r.status, r.check_in_reason, r.check_out_reason,
      r.requested_at, r.decision_reason,
      exists(select 1 from public.time_entry_evidence v where v.time_entry_id = e.id and v.event_type = 'check_in' and v.evidence_type = 'gps') as has_check_in_gps,
      exists(select 1 from public.time_entry_evidence v where v.time_entry_id = e.id and v.event_type = 'check_out' and v.evidence_type = 'gps') as has_check_out_gps
    from public.attendance_exception_reviews r join public.time_entries e on e.id = r.time_entry_id
      join public.profiles p on p.id = e.staff_id
    where e.staff_id = auth.uid() or public.has_permission('timekeeping.approve_adjustment')
  ) item);
end;
$$;
revoke all on function public.get_attendance_exception_reviews() from public, anon;
grant execute on function public.get_attendance_exception_reviews() to authenticated;

-- Read-model and payroll definitions are appended below before COMMIT.

-- Exclude unresolved/rejected evidence from confirmed totals.
create or replace function public.get_my_monthly_timekeeping_entries(
  p_month integer,
  p_year integer
)
returns table (
  entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  clock_out_reason text,
  auto_ended_at timestamptz,
  work_shift_code text,
  work_shift_name text,
  is_unscheduled boolean,
  total_minutes integer,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean,
  adjustment_status text,
  adjusted_check_in_at timestamptz,
  adjusted_check_out_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') and not public.has_permission('timekeeping.view') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  perform public.run_teaching_assistant_timekeeping_watchdog();

  return query
  select
    entry.id as entry_id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status as entry_status,
    entry.clock_out_reason,
    entry.auto_ended_at,
    shift.code as work_shift_code,
    shift.name as work_shift_name,
    (entry.staff_shift_assignment_id is null) as is_unscheduled,
    case
      when entry.check_out_at is not null then
        greatest(0, round(extract(epoch from (coalesce(adj.requested_check_out_at, entry.check_out_at) - coalesce(adj.requested_check_in_at, entry.check_in_at))) / 60))::integer
      else
        null
    end as total_minutes,
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'wifi'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'wifi'),
    coalesce(adj.status, 'none') as adjustment_status,
    adj.requested_check_in_at as adjusted_check_in_at,
    adj.requested_check_out_at as adjusted_check_out_at
  from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
  left join public.staff_shift_assignments as assignment on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  left join lateral (
    select
      request.status,
      request.requested_check_in_at,
      request.requested_check_out_at
    from public.time_entry_adjustment_requests as request
    where request.time_entry_id = entry.id
    order by
      case request.status
        when 'approved' then 0
        when 'pending' then 1
        else 2
      end,
      request.created_at desc
    limit 1
  ) as adj on true
  where entry.staff_id = actor_id
    and extract(month from entry.work_date)::integer = p_month
    and extract(year from entry.work_date)::integer = p_year
  order by entry.work_date desc, entry.check_in_at desc;
end;
$$;

-- Exclude unresolved/rejected evidence from confirmed totals.
create or replace function public.get_staff_monthly_timekeeping_entries(
  p_staff_id uuid,
  p_month integer,
  p_year integer
)
returns table (
  entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  clock_out_reason text,
  auto_ended_at timestamptz,
  work_shift_code text,
  work_shift_name text,
  is_unscheduled boolean,
  total_minutes integer,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean,
  adjustment_status text,
  adjusted_check_in_at timestamptz,
  adjusted_check_out_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view')
    and not public.has_permission('timekeeping.approve_adjustment')
    and not public.has_permission('staff.manage')
  then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  return query
  select
    entry.id as entry_id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status as entry_status,
    entry.clock_out_reason,
    entry.auto_ended_at,
    shift.code as work_shift_code,
    shift.name as work_shift_name,
    (entry.staff_shift_assignment_id is null) as is_unscheduled,
    case
      when entry.check_out_at is not null then
        greatest(0, round(extract(epoch from (coalesce(adj.requested_check_out_at, entry.check_out_at) - coalesce(adj.requested_check_in_at, entry.check_in_at))) / 60))::integer
      else
        null
    end as total_minutes,
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'wifi'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'wifi'),
    coalesce(adj.status, 'none') as adjustment_status,
    adj.requested_check_in_at as adjusted_check_in_at,
    adj.requested_check_out_at as adjusted_check_out_at
  from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
  left join public.staff_shift_assignments as assignment on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  left join lateral (
    select
      request.status,
      request.requested_check_in_at,
      request.requested_check_out_at
    from public.time_entry_adjustment_requests as request
    where request.time_entry_id = entry.id
    order by
      case request.status
        when 'approved' then 0
        when 'pending' then 1
        else 2
      end,
      request.created_at desc
    limit 1
  ) as adj on true
  where entry.staff_id = p_staff_id
    and extract(month from entry.work_date)::integer = p_month
    and extract(year from entry.work_date)::integer = p_year
  order by entry.work_date desc, entry.check_in_at desc;
end;
$$;

-- Exclude unresolved/rejected evidence from confirmed totals.
create or replace function public.get_center_monthly_timekeeping_overview(
  p_month integer,
  p_year integer
)
returns table (
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  primary_role_name text,
  total_entries integer,
  total_work_days integer,
  total_hours numeric,
  auto_ended_count integer,
  pending_adjustment_count integer
)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view')
    and not public.has_permission('timekeeping.approve_adjustment')
    and not public.has_permission('staff.manage')
  then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  perform public.run_teaching_assistant_timekeeping_watchdog();

  return query
  with staff_entries as (
    select
      entry.staff_id,
      entry.work_date,
      entry.status,
      coalesce(adj.requested_check_in_at, entry.check_in_at) as effective_check_in_at,
      coalesce(adj.requested_check_out_at, entry.check_out_at) as effective_check_out_at,
      adj.status as adjustment_status
    from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
    left join lateral (
      select r.status, r.requested_check_in_at, r.requested_check_out_at
      from public.time_entry_adjustment_requests r
      where r.time_entry_id = entry.id
      order by
        case r.status when 'approved' then 0 when 'pending' then 1 else 2 end,
        r.created_at desc
      limit 1
    ) as adj on true
    where extract(month from entry.work_date)::integer = p_month
      and extract(year from entry.work_date)::integer = p_year
  )
  select
    profile.id as staff_id,
    coalesce(profile.display_name, 'Chưa đặt tên') as staff_display_name,
    profile.employee_code as staff_employee_code,
    coalesce(role.name, 'Nhân viên') as primary_role_name,
    count(se.work_date)::integer as total_entries,
    count(distinct se.work_date)::integer as total_work_days,
    round(
      coalesce(
        sum(
          case
            when se.effective_check_out_at is not null and se.effective_check_out_at >= se.effective_check_in_at then
              extract(epoch from (se.effective_check_out_at - se.effective_check_in_at)) / 3600.0
            else 0
          end
        ), 0
      )::numeric,
      2
    ) as total_hours,
    count(case when se.status = 'auto_ended' then 1 end)::integer as auto_ended_count,
    count(case when se.adjustment_status = 'pending' then 1 end)::integer as pending_adjustment_count
  from public.profiles as profile
  left join lateral (
    select r.name
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = profile.id and ura.revoked_at is null
    order by r.created_at asc
    limit 1
  ) as role on true
  join staff_entries as se on se.staff_id = profile.id
  group by profile.id, profile.display_name, profile.employee_code, role.name
  order by total_hours desc, profile.display_name asc;
end;
$$;

-- Exclude unresolved/rejected evidence from confirmed totals.
create or replace function public.generate_payroll_calculation_run(
  p_payroll_period_id uuid,
  p_reason text
)
returns public.payroll_calculation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_period public.payroll_periods%rowtype;
  previous_run_id uuid;
  created_run public.payroll_calculation_runs%rowtype;
  month_end date;
  next_revision integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not public.has_permission('payroll.manage') then
    raise exception using errcode = '42501', message = 'PAYROLL_MANAGE_PERMISSION_REQUIRED';
  end if;
  if normalized_reason is null or pg_catalog.length(normalized_reason) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_CALCULATION_REASON_REQUIRED';
  end if;

  select * into target_period
  from public.payroll_periods
  where id = p_payroll_period_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_PERIOD_NOT_FOUND';
  end if;
  if target_period.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_DRAFT';
  end if;
  if exists (
    select 1 from public.payroll_correction_requests
    where payroll_period_id = target_period.id and status = 'pending'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_CORRECTION_REQUESTS_PENDING';
  end if;

  month_end := (target_period.period_month + interval '1 month' - interval '1 day')::date;
  perform public.sync_payroll_order_facts(target_period.period_month);

  previous_run_id := target_period.current_calculation_run_id;
  select coalesce(pg_catalog.max(revision), 0) + 1
  into next_revision
  from public.payroll_calculation_runs
  where payroll_period_id = target_period.id;

  if previous_run_id is not null then
    update public.payroll_calculation_runs set status = 'superseded' where id = previous_run_id;
  end if;

  insert into public.payroll_calculation_runs (
    payroll_period_id, revision, status, reason, generated_by
  ) values (
    target_period.id, next_revision, 'current', normalized_reason, actor_id
  ) returning * into created_run;

  -- Time entries without a configured payroll position are visible blockers.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select distinct
    created_run.id,
    'missing_payroll_position',
    entry.staff_id,
    pg_catalog.jsonb_build_object('work_date', entry.work_date)
  from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
  where entry.work_date >= target_period.period_month
    and entry.work_date < (target_period.period_month + interval '1 month')::date
    and entry.status in ('checked_out', 'auto_ended')
    and not exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = entry.staff_id and position.effective_from <= entry.work_date
    );

  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, source_fact_id, details
  )
  select created_run.id, 'missing_payroll_position', fact.staff_id, fact.id,
    pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel')
  from public.payroll_source_facts as fact
  where fact.fact_type = 'timekeeping'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and fact.staff_id is not null
    and not exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.effective_from <= fact.event_date
    );

  -- Every configured payroll position gets a statement, even with zero work minutes.
  with effective_positions as (
    select distinct on (position.staff_id)
      position.staff_id,
      position.position_code
    from public.staff_payroll_position_versions as position
    where position.effective_from <= month_end
    order by position.staff_id, position.effective_from desc
  ), effective_entries as (
    select
      entry.staff_id,
      greatest(
        0,
        pg_catalog.floor(
          extract(epoch from (
            coalesce(adjustment.requested_check_out_at, entry.check_out_at)
            - coalesce(adjustment.requested_check_in_at, entry.check_in_at)
          )) / 60
        )::integer
      ) as worked_minutes
    from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    where entry.work_date >= target_period.period_month
      and entry.work_date < (target_period.period_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and entry.check_out_at is not null
    union all
    select
      fact.staff_id,
      greatest(0, coalesce(fact.quantity, (fact.metadata->>'work_minutes')::numeric, 0))::integer as worked_minutes
    from public.payroll_source_facts as fact
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and fact.staff_id is not null
      and not exists (
        select 1 from public.time_entries as system_entry
        where system_entry.staff_id = fact.staff_id
          and system_entry.work_date = fact.event_date
          and system_entry.status in ('checked_out', 'auto_ended')
          and system_entry.check_out_at is not null
      )
  ), minutes_by_staff as (
    select staff_id, coalesce(pg_catalog.sum(worked_minutes), 0)::integer as work_minutes
    from effective_entries
    group by staff_id
  )
  insert into public.payroll_statements (
    payroll_period_id, calculation_run_id, staff_id, staff_display_name_snapshot,
    staff_employee_code_snapshot, work_units, work_hours, work_minutes
  )
  select
    target_period.id,
    created_run.id,
    position.staff_id,
    coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), profile.email),
    profile.employee_code,
    pg_catalog.floor(coalesce(minutes.work_minutes, 0)::numeric / 540)::integer,
    pg_catalog.round(coalesce(minutes.work_minutes, 0)::numeric / 60)::integer,
    coalesce(minutes.work_minutes, 0)
  from effective_positions as position
  join public.profiles as profile on profile.id = position.staff_id
    and (profile.joined_at is null or profile.joined_at <= month_end)
    and (profile.left_at is null or profile.left_at >= target_period.period_month)
    and (profile.employment_status <> 'inactive' or profile.left_at >= target_period.period_month)
  left join minutes_by_staff as minutes on minutes.staff_id = position.staff_id;

  -- A closed entry requires the daily rate effective on its work date.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select distinct
    created_run.id,
    'missing_daily_rate',
    entry.staff_id,
    pg_catalog.jsonb_build_object('work_date', entry.work_date)
  from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
  where entry.work_date >= target_period.period_month
    and entry.work_date < (target_period.period_month + interval '1 month')::date
    and entry.status in ('checked_out', 'auto_ended')
    and not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
    );

  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, source_fact_id, details
  )
  select created_run.id, 'missing_daily_rate', fact.staff_id, fact.id,
    pg_catalog.jsonb_build_object('work_date', fact.event_date, 'source', 'excel')
  from public.payroll_source_facts as fact
  where fact.fact_type = 'timekeeping'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and fact.staff_id is not null
    and not exists (
      select 1 from public.staff_daily_rate_versions as rate
      where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
    );

  with effective_entries as (
    select
      entry.id as time_entry_id,
      'time_entry'::text as source_kind,
      entry.id::text as source_id,
      entry.staff_id,
      entry.work_date,
      coalesce(adjustment.requested_check_in_mode, entry.check_in_mode) as work_mode,
      greatest(
        0,
        pg_catalog.floor(extract(epoch from (
          coalesce(adjustment.requested_check_out_at, entry.check_out_at)
          - coalesce(adjustment.requested_check_in_at, entry.check_in_at)
        )) / 60)::integer
      ) as worked_minutes,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from (select * from public.time_entries where public.time_entry_is_verified(id)) as entry
    left join lateral (
      select request.requested_check_in_at, request.requested_check_in_mode, request.requested_check_out_at
      from public.time_entry_adjustment_requests as request
      where request.time_entry_id = entry.id and request.status = 'approved'
      order by request.reviewed_at desc
      limit 1
    ) as adjustment on true
    join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = entry.staff_id and rate.effective_from <= entry.work_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where entry.work_date >= target_period.period_month
      and entry.work_date < (target_period.period_month + interval '1 month')::date
      and entry.status in ('checked_out', 'auto_ended')
      and entry.check_out_at is not null
    union all
    select
      null::uuid as time_entry_id,
      'payroll_source_fact'::text as source_kind,
      fact.id::text as source_id,
      fact.staff_id,
      fact.event_date as work_date,
      coalesce(nullif(fact.metadata->>'work_mode', ''), 'offline') as work_mode,
      greatest(0, coalesce(fact.quantity, (fact.metadata->>'work_minutes')::numeric, 0))::integer as worked_minutes,
      rate.id as daily_rate_version_id,
      rate.offline_daily_rate_vnd,
      rate.online_rate_basis_points
    from public.payroll_source_facts as fact
    join lateral (
      select rate.id, rate.offline_daily_rate_vnd, rate.online_rate_basis_points
      from public.staff_daily_rate_versions as rate
      where rate.staff_id = fact.staff_id and rate.effective_from <= fact.event_date
      order by rate.effective_from desc
      limit 1
    ) as rate on true
    where fact.fact_type = 'timekeeping'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and not exists (
        select 1 from public.time_entries as system_entry
        where system_entry.staff_id = fact.staff_id
          and system_entry.work_date = fact.event_date
          and system_entry.status in ('checked_out', 'auto_ended')
          and system_entry.check_out_at is not null
      )
      and fact.staff_id is not null
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, source_time_entry_id,
    staff_daily_rate_version_id, work_minutes, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    case when entry.work_mode = 'online' then 'base_online' else 'base_offline' end,
    'earning',
    pg_catalog.round(
      entry.worked_minutes::numeric * entry.offline_daily_rate_vnd
      * case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
      / 540 / 10000
    )::bigint,
    entry.time_entry_id,
    entry.daily_rate_version_id,
    entry.worked_minutes,
    entry.worked_minutes,
    entry.offline_daily_rate_vnd,
    'phút',
    'daily_base_salary',
    entry.source_kind,
    entry.source_id,
    pg_catalog.jsonb_build_object(
      'worked_minutes', entry.worked_minutes,
      'minutes_per_day', 540,
      'daily_rate_vnd', entry.offline_daily_rate_vnd,
      'mode_basis_points', case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
    ),
    pg_catalog.jsonb_build_object('work_date', entry.work_date, 'mode', entry.work_mode, 'source', entry.source_kind),
    case when entry.work_mode = 'online' then 'Công online theo phút thực tế (50%).' else 'Công offline theo phút thực tế.' end,
    actor_id
  from effective_entries as entry
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = entry.staff_id
  where entry.worked_minutes > 0
    and pg_catalog.round(
      entry.worked_minutes::numeric * entry.offline_daily_rate_vnd
      * case when entry.work_mode = 'online' then entry.online_rate_basis_points else 10000 end
      / 540 / 10000
    )::bigint > 0;

  -- Teaching allowances are approved source facts.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'teaching_allowance',
    'earning',
    (coalesce(fact.quantity, 1) * (policy.parameters->>'amount_vnd')::bigint)::bigint,
    coalesce(fact.quantity, 1),
    (policy.parameters->>'amount_vnd')::bigint,
    'lần',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata,
    'Phụ cấp đã được duyệt.',
    actor_id
  from public.payroll_source_facts as fact
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'teaching_allowance' and version.effective_from <= fact.event_date
    order by version.effective_from desc
    limit 1
  ) as policy on true
  where fact.fact_type = 'teaching_allowance'
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'teaching_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id
            and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and (coalesce(fact.quantity, 1) * (policy.parameters->>'amount_vnd')::bigint)::bigint > 0;

  -- Divide the monthly grading pool exactly, including deterministic remainder distribution.
  with policy as (
    select version.id, version.policy_code, version.parameters,
      (version.parameters->>'monthly_pool_vnd')::bigint as pool_vnd
    from public.payroll_policy_versions as version
    where version.policy_code = 'grading_pool' and version.effective_from <= month_end
    order by version.effective_from desc
    limit 1
  ), grader_counts as (
    select source.grader_id, pg_catalog.sum(source.credit_units)::bigint as credit_count
    from (
      select credit.grader_id, credit.credit_units::numeric as credit_units
      from public.grading_credits as credit
      where (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date >= target_period.period_month
        and (credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date < (target_period.period_month + interval '1 month')::date
        and credit.credit_units > 0
      union all
      select fact.staff_id as grader_id, coalesce(fact.quantity, 0) as credit_units
      from public.payroll_source_facts as fact
      where fact.fact_type = 'grading'
        and fact.event_date >= target_period.period_month
        and fact.event_date < (target_period.period_month + interval '1 month')::date
        and fact.staff_id is not null
        and coalesce(fact.quantity, 0) > 0
        and not exists (
          select 1 from public.grading_credits as system_credit
          where system_credit.grader_id = fact.staff_id
            and (system_credit.credited_at at time zone 'Asia/Ho_Chi_Minh')::date = fact.event_date
            and system_credit.credit_units > 0
        )
    ) as source
    group by source.grader_id
  ), eligible_counts as (
    select grader.*
    from grader_counts as grader
    where exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = grader.grader_id and position.position_code = 'teaching_assistant'
        and position.effective_from <= month_end
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= month_end
            and newer.effective_from > position.effective_from
        )
    )
  ), shares as (
    select
      grader.grader_id,
      grader.credit_count,
      pg_catalog.sum(grader.credit_count) over () as total_count,
      policy.id as policy_id,
      policy.policy_code,
      policy.parameters,
      policy.pool_vnd,
      pg_catalog.floor(policy.pool_vnd::numeric * grader.credit_count / pg_catalog.sum(grader.credit_count) over ())::bigint as base_amount,
      pg_catalog.mod(policy.pool_vnd * grader.credit_count, pg_catalog.sum(grader.credit_count) over ()) as remainder
    from eligible_counts as grader
    cross join policy
  ), ranked as (
    select shares.*,
      pg_catalog.row_number() over (order by remainder desc, grader_id) as remainder_rank,
      pool_vnd - pg_catalog.sum(base_amount) over () as leftover_vnd
    from shares
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'grading_bonus',
    'earning',
    ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end,
    ranked.credit_count,
    'bài',
    ranked.policy_code,
    'grading_pool',
    ranked.policy_id::text,
    pg_catalog.jsonb_build_object(
      'monthly_pool_vnd', ranked.pool_vnd,
      'staff_credits', ranked.credit_count,
      'total_credits', ranked.total_count
    ),
    pg_catalog.jsonb_build_object('period_month', target_period.period_month),
    'Phân bổ quỹ thưởng chấm bài theo tỷ lệ.',
    actor_id
  from ranked
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = ranked.grader_id
  where ranked.base_amount + case when ranked.remainder_rank <= ranked.leftover_vnd then 1 else 0 end > 0;

  -- Order data quality blockers remain attached to the run for resolution.
  insert into public.payroll_calculation_issues (calculation_run_id, issue_code, source_fact_id, staff_id, details)
  select
    created_run.id,
    evaluated.issue_code,
    fact.id,
    evaluated.staff_id,
    pg_catalog.jsonb_build_object(
      'source_key', fact.source_key,
      'fact_type', fact.fact_type,
      'event_date', fact.event_date,
      'amount_vnd', fact.amount_vnd,
      'grade', evaluated.grade,
      'source_code', evaluated.source_code
    )
  from public.payroll_source_facts as fact
  cross join lateral (
    select
      coalesce(
        fact.grade,
        (
          select class_row.grade
          from public.student_enrollments as enrollment
          join public.classes as class_row on class_row.id = enrollment.class_id
          where enrollment.student_id = fact.student_id
            and enrollment.effective_from <= fact.event_date
            and (enrollment.effective_to is null or enrollment.effective_to >= fact.event_date)
          order by enrollment.effective_from desc, enrollment.id desc
          limit 1
        ),
        (select student.current_grade from public.students as student where student.id = fact.student_id)
      ) as grade
  ) as resolved_grade
  cross join lateral (
    select
      case
        when fact.fact_type = 'renewal_order' then coalesce(
          (
            select assignment.staff_id
            from public.staff_grade_assignments as assignment
            where assignment.grade = resolved_grade.grade
              and assignment.effective_from <= fact.event_date
              and (assignment.effective_to is null or assignment.effective_to >= fact.event_date)
            order by assignment.effective_from desc, assignment.id desc
            limit 1
          ),
          fact.staff_id
        )
        else fact.staff_id
      end as staff_id
  ) as resolved_staff
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  cross join lateral (
    select
      case
        when fact.fact_type = 'renewal_order' and resolved_grade.grade is null then 'missing_grade'
        when fact.fact_type = 'renewal_order' and (
          resolved_staff.staff_id is null
          or not exists (
            select 1
            from public.staff_payroll_position_versions as position
            where position.staff_id = resolved_staff.staff_id
              and position.position_code = 'operations_assistant'
              and position.effective_from <= fact.event_date
              and not exists (
                select 1 from public.staff_payroll_position_versions as newer
                where newer.staff_id = position.staff_id
                  and newer.effective_from <= fact.event_date
                  and newer.effective_from > position.effective_from
              )
          )
        ) then 'missing_grade_assignment'
        when fact.fact_type = 'new_enrollment_order' and resolved_staff.staff_id is null then 'missing_recruiter'
        when fact.fact_type = 'new_enrollment_order' and (
          resolved_source.source_code is null
          or not exists (
            select 1
            from public.staff_payroll_position_versions as position
            join lateral (
              select policy.parameters
              from public.payroll_policy_versions as policy
              where policy.policy_code = case position.position_code
                when 'operations_assistant' then 'operations_new_enrollment'
                when 'admissions_manager' then 'admissions_new_enrollment'
              end
                and policy.effective_from <= fact.event_date
              order by policy.effective_from desc
              limit 1
            ) as policy on position.position_code in ('operations_assistant', 'admissions_manager')
            where position.staff_id = resolved_staff.staff_id
              and position.effective_from <= fact.event_date
              and policy.parameters->'fixed_by_source' ? resolved_source.source_code
              and not exists (
                select 1 from public.staff_payroll_position_versions as newer
                where newer.staff_id = position.staff_id
                  and newer.effective_from <= fact.event_date
                  and newer.effective_from > position.effective_from
              )
          )
        ) then 'missing_source_mapping'
        else null
      end as issue_code,
      resolved_staff.staff_id as staff_id,
      resolved_grade.grade as grade,
      resolved_source.source_code as source_code
  ) as evaluated
  where fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and evaluated.issue_code is not null;

  -- Operations: 2% renewal revenue for assigned grades.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'operations_grade_renewal_bonus',
    'earning',
    pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('grade', resolved_grade.grade, 'order_value_vnd', fact.amount_vnd),
    'Thưởng tái phí khối phụ trách.',
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select
      coalesce(
        fact.grade,
        (
          select class_row.grade
          from public.student_enrollments as enrollment
          join public.classes as class_row on class_row.id = enrollment.class_id
          where enrollment.student_id = fact.student_id
            and enrollment.effective_from <= fact.event_date
            and (enrollment.effective_to is null or enrollment.effective_to >= fact.event_date)
          order by enrollment.effective_from desc, enrollment.id desc
          limit 1
        ),
        (select student.current_grade from public.students as student where student.id = fact.student_id)
      ) as grade
  ) as resolved_grade
  cross join lateral (
    select
      coalesce(
        (
          select assignment.staff_id
          from public.staff_grade_assignments as assignment
          where assignment.grade = resolved_grade.grade
            and assignment.effective_from <= fact.event_date
            and (assignment.effective_to is null or assignment.effective_to >= fact.event_date)
          order by assignment.effective_from desc, assignment.id desc
          limit 1
        ),
        fact.staff_id
      ) as staff_id
  ) as resolved_staff
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = resolved_staff.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_grade_renewal' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type = 'renewal_order'
    and resolved_staff.staff_id is not null and fact.amount_vnd > 0
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = resolved_staff.staff_id and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint > 0;

  -- Operations: fixed source amount plus 5% of every new-enrollment order.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    generated.line_type,
    'earning',
    generated.amount_vnd,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('source_code', resolved_source.source_code, 'order_value_vnd', fact.amount_vnd),
    generated.note,
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_new_enrollment' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  cross join lateral (
    values
      ('new_student_fixed_bonus'::text, coalesce((policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint, 0), 'Thưởng cố định theo nguồn tuyển sinh.'::text),
      ('new_student_revenue_bonus'::text, pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'revenue_rate_basis_points')::integer / 10000)::bigint, 'Thưởng 5% doanh thu đơn tuyển mới.'::text)
  ) as generated(line_type, amount_vnd, note)
  where fact.fact_type = 'new_enrollment_order'
    and fact.staff_id is not null and fact.amount_vnd > 0 and resolved_source.source_code is not null
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and generated.amount_vnd > 0
    and policy.parameters->'fixed_by_source' ? resolved_source.source_code
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    );

  -- Admissions: fixed source bonus per order.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'new_student_fixed_bonus',
    'earning',
    (policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint,
    1,
    fact.amount_vnd,
    'đơn',
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata || pg_catalog.jsonb_build_object('source_code', resolved_source.source_code, 'order_value_vnd', fact.amount_vnd),
    'Thưởng cố định theo nguồn tuyển sinh.',
    actor_id
  from public.payroll_source_facts as fact
  cross join lateral (
    select coalesce(
      fact.source_code,
      (
        select mapping.payroll_source_code
        from public.finance_cashflow_records as cashflow
        join public.sales_commission_accruals as accrual on accrual.source_cashflow_record_id = cashflow.id
        join public.crm_cases as crm_case on crm_case.id = accrual.crm_case_id
        join public.payroll_lead_source_mapping_versions as mapping on mapping.lead_source_id = crm_case.lead_source_id
        where cashflow.id::text = fact.source_key
          and mapping.effective_from <= fact.event_date
        order by mapping.effective_from desc
        limit 1
      )
    ) as source_code
  ) as resolved_source
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'admissions_new_enrollment' and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type = 'new_enrollment_order'
    and fact.staff_id is not null and resolved_source.source_code is not null
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and coalesce((policy.parameters->'fixed_by_source'->>resolved_source.source_code)::bigint, 0) > 0
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id and position.position_code = 'admissions_manager'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    );

  -- Admissions: highest reached tier applies to the full monthly new revenue.
  with admissions_revenue as (
    select fact.staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd
    from public.payroll_source_facts as fact
    where fact.fact_type = 'new_enrollment_order'
      and fact.staff_id is not null
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = fact.staff_id and position.position_code = 'admissions_manager'
          and position.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id and newer.effective_from <= fact.event_date
              and newer.effective_from > position.effective_from
          )
      )
    group by fact.staff_id
  ), policy as (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'admissions_revenue_tiers' and version.effective_from <= month_end
    order by version.effective_from desc limit 1
  ), selected_tiers as (
    select
      revenue.staff_id,
      revenue.revenue_vnd,
      policy.policy_code,
      policy.parameters,
      (
        select (tier->>'rate_basis_points')::integer
        from pg_catalog.jsonb_array_elements(policy.parameters->'tiers') as tier
        where (tier->>'minimum_vnd')::bigint <= revenue.revenue_vnd
        order by (tier->>'minimum_vnd')::bigint desc
        limit 1
      ) as rate_basis_points
    from admissions_revenue as revenue
    cross join policy
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'admissions_revenue_tier_bonus',
    'earning',
    pg_catalog.round(tier.revenue_vnd::numeric * tier.rate_basis_points / 10000)::bigint,
    tier.revenue_vnd,
    tier.rate_basis_points,
    'basis points',
    tier.policy_code,
    'monthly_new_enrollment_revenue',
    created_run.id::text || ':' || tier.staff_id::text,
    pg_catalog.jsonb_build_object('revenue_vnd', tier.revenue_vnd, 'rate_basis_points', tier.rate_basis_points, 'tiers', tier.parameters->'tiers'),
    pg_catalog.jsonb_build_object('period_month', target_period.period_month),
    'Hoa hồng theo mức doanh thu tuyển mới.',
    actor_id
  from selected_tiers as tier
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = tier.staff_id
  where tier.rate_basis_points > 0;

  -- Optional operations policies calculated from center totals or approved facts.
  with operations_staff as (
    select statement.id as statement_id, statement.staff_id
    from public.payroll_statements as statement
    where statement.calculation_run_id = created_run.id
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = statement.staff_id and position.position_code = 'operations_assistant'
          and position.effective_from <= month_end
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id and newer.effective_from <= month_end
              and newer.effective_from > position.effective_from
          )
      )
  ), renewal_total as (
    select coalesce(pg_catalog.sum(amount_vnd), 0)::bigint as amount_vnd
    from public.payroll_source_facts
    where fact_type = 'renewal_order'
      and event_date >= target_period.period_month
      and event_date < (target_period.period_month + interval '1 month')::date
  ), statement_count as (
    select pg_catalog.count(*)::bigint as value
    from public.payroll_statements
    where calculation_run_id = created_run.id
  ), enabled_tasks as (
    select distinct on (task.staff_id, task.task_code)
      task.staff_id, task.task_code, task.is_enabled
    from public.staff_payroll_task_versions as task
    where task.effective_from <= month_end
    order by task.staff_id, task.task_code, task.effective_from desc
  ), generated as (
    select
      staff.statement_id,
      staff.staff_id,
      task.task_code,
      case task.task_code
        when 'center_renewal_duty' then 'center_renewal_duty_bonus'
        when 'record_excess' then 'record_excess_bonus'
        when 'payroll_processing' then 'payroll_processing_bonus'
      end as line_type,
      case task.task_code
        when 'center_renewal_duty' then pg_catalog.round(renewal_total.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        when 'record_excess' then pg_catalog.round(greatest(renewal_total.amount_vnd - (policy.parameters->>'record_revenue_vnd')::bigint, 0)::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
        when 'payroll_processing' then statement_count.value * (policy.parameters->>'amount_per_staff_vnd')::bigint
      end as amount_vnd,
      policy.policy_code,
      policy.parameters
    from operations_staff as staff
    join enabled_tasks as task on task.staff_id = staff.staff_id and task.is_enabled
      and task.task_code in ('center_renewal_duty', 'record_excess', 'payroll_processing')
    join lateral (
      select version.policy_code, version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = case task.task_code
        when 'center_renewal_duty' then 'operations_center_renewal_duty'
        when 'record_excess' then 'operations_record_excess'
        when 'payroll_processing' then 'operations_payroll_processing'
      end
      and version.effective_from <= month_end
      order by version.effective_from desc limit 1
    ) as policy on true
    cross join renewal_total
    cross join statement_count
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, policy_code, source_kind,
    source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    generated.statement_id,
    generated.line_type,
    'earning',
    generated.amount_vnd,
    generated.policy_code,
    'monthly_center_metric',
    created_run.id::text || ':' || generated.task_code || ':' || generated.staff_id::text,
    generated.parameters,
    pg_catalog.jsonb_build_object(
      'period_month', target_period.period_month,
      'center_renewal_revenue_vnd', (select amount_vnd from renewal_total),
      'payroll_statement_count', (select value from statement_count)
    ),
    case generated.task_code
      when 'center_renewal_duty' then 'Thưởng quản lý và trực tin nhắn.'
      when 'record_excess' then 'Thưởng doanh thu tái phí vượt kỷ lục.'
      else 'Thưởng tính lương nhân sự.'
    end,
    actor_id
  from generated
  where generated.amount_vnd > 0;

  -- Optional task facts: daily reporting, add-on sales, and recruited staff salary.
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    case fact.fact_type
      when 'daily_admin_reporting' then 'daily_admin_reporting_bonus'
      when 'addon_product_order' then 'addon_product_sales_bonus'
      when 'staff_recruitment_salary' then 'staff_recruitment_care_bonus'
    end,
    'earning',
    case fact.fact_type
      when 'daily_admin_reporting' then coalesce(fact.quantity, 1)::bigint * (policy.parameters->>'amount_per_day_vnd')::bigint
      else pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
    end,
    coalesce(fact.quantity, 1),
    case when fact.fact_type = 'daily_admin_reporting' then (policy.parameters->>'amount_per_day_vnd')::bigint else fact.amount_vnd end,
    case when fact.fact_type = 'daily_admin_reporting' then 'ngày' else 'VND doanh thu' end,
    policy.policy_code,
    'payroll_source_fact',
    fact.id::text,
    policy.parameters,
    fact.metadata,
    case fact.fact_type
      when 'daily_admin_reporting' then 'Thưởng ngày thực hiện nhập dòng tiền và báo cáo.'
      when 'addon_product_order' then 'Thưởng bán sản phẩm phụ.'
      else 'Thưởng tuyển dụng và chăm sóc nhân sự hiệu quả.'
    end,
    actor_id
  from public.payroll_source_facts as fact
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = fact.staff_id
  join lateral (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = case fact.fact_type
      when 'daily_admin_reporting' then 'operations_daily_admin_reporting'
      when 'addon_product_order' then 'operations_addon_product_sales'
      when 'staff_recruitment_salary' then 'operations_staff_recruitment_care'
    end
      and version.effective_from <= fact.event_date
    order by version.effective_from desc limit 1
  ) as policy on true
  where fact.fact_type in ('daily_admin_reporting', 'addon_product_order', 'staff_recruitment_salary')
    and fact.event_date >= target_period.period_month
    and fact.event_date < (target_period.period_month + interval '1 month')::date
    and exists (
      select 1 from public.staff_payroll_task_versions as task
      where task.staff_id = fact.staff_id
        and task.task_code = case fact.fact_type
          when 'daily_admin_reporting' then 'daily_admin_reporting'
          when 'addon_product_order' then 'addon_product_sales'
          when 'staff_recruitment_salary' then 'staff_recruitment_care'
        end
        and task.effective_from <= fact.event_date
        and task.is_enabled
        and not exists (
          select 1 from public.staff_payroll_task_versions as newer
          where newer.staff_id = task.staff_id and newer.task_code = task.task_code
            and newer.effective_from <= fact.event_date and newer.effective_from > task.effective_from
        )
    )
    and exists (
      select 1 from public.staff_payroll_position_versions as position
      where position.staff_id = fact.staff_id
        and position.position_code = 'operations_assistant'
        and position.effective_from <= fact.event_date
        and not exists (
          select 1 from public.staff_payroll_position_versions as newer
          where newer.staff_id = position.staff_id
            and newer.effective_from <= fact.event_date
            and newer.effective_from > position.effective_from
        )
    )
    and case fact.fact_type
      when 'daily_admin_reporting' then coalesce(fact.quantity, 1)::bigint * (policy.parameters->>'amount_per_day_vnd')::bigint
      else pg_catalog.round(fact.amount_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint
    end > 0;

  -- Coaching bonus uses renewal facts for students with a coaching owner.
  with coaching_renewal as (
    select coaching.assistant_owner_id as staff_id, pg_catalog.sum(fact.amount_vnd)::bigint as revenue_vnd,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('fact_id', fact.id, 'student_id', fact.student_id, 'amount_vnd', fact.amount_vnd)) as evidence
    from public.payroll_source_facts as fact
    join lateral (
      select record.assistant_owner_id
      from public.coaching_records as record
      where record.student_id = fact.student_id
        and (record.opened_at at time zone 'Asia/Ho_Chi_Minh')::date <= fact.event_date
      order by record.opened_at desc, record.id desc
      limit 1
    ) as coaching on true
    where fact.fact_type = 'renewal_order'
      and fact.event_date >= target_period.period_month
      and fact.event_date < (target_period.period_month + interval '1 month')::date
      and exists (
        select 1 from public.staff_payroll_position_versions as position
        where position.staff_id = coaching.assistant_owner_id
          and position.position_code = 'operations_assistant'
          and position.effective_from <= fact.event_date
          and not exists (
            select 1 from public.staff_payroll_position_versions as newer
            where newer.staff_id = position.staff_id
              and newer.effective_from <= fact.event_date
              and newer.effective_from > position.effective_from
          )
      )
      and exists (
        select 1 from public.staff_payroll_task_versions as task
        where task.staff_id = coaching.assistant_owner_id
          and task.task_code = 'student_coaching'
          and task.effective_from <= fact.event_date
          and task.is_enabled
          and not exists (
            select 1 from public.staff_payroll_task_versions as newer
            where newer.staff_id = task.staff_id and newer.task_code = task.task_code
              and newer.effective_from <= fact.event_date and newer.effective_from > task.effective_from
          )
      )
    group by coaching.assistant_owner_id
  ), policy as (
    select version.policy_code, version.parameters
    from public.payroll_policy_versions as version
    where version.policy_code = 'operations_student_coaching' and version.effective_from <= month_end
    order by version.effective_from desc limit 1
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, quantity, unit_rate_vnd, unit_label,
    policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    statement.id,
    'student_coaching_bonus',
    'earning',
    pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint,
    coaching.revenue_vnd,
    (policy.parameters->>'rate_basis_points')::bigint,
    'basis points',
    policy.policy_code,
    'coaching_renewal_revenue',
    created_run.id::text || ':' || coaching.staff_id::text,
    policy.parameters,
    pg_catalog.jsonb_build_object('orders', coaching.evidence),
    'Thưởng coaching trên doanh thu tái phí học sinh phụ trách.',
    actor_id
  from coaching_renewal as coaching
  cross join policy
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = coaching.staff_id
  where pg_catalog.round(coaching.revenue_vnd::numeric * (policy.parameters->>'rate_basis_points')::integer / 10000)::bigint > 0;

  -- Carry manual lines into the new immutable calculation revision.
  if previous_run_id is not null then
    insert into public.payroll_line_items (
      payroll_statement_id, line_type, direction, amount_vnd, unit_count, unit_rate_vnd,
      quantity, unit_label, policy_code, source_kind, source_id, formula_snapshot,
      evidence_snapshot, note, created_by
    )
    select
      new_statement.id,
      line.line_type,
      line.direction,
      line.amount_vnd,
      line.unit_count,
      line.unit_rate_vnd,
      line.quantity,
      line.unit_label,
      line.policy_code,
      'carried_manual_line',
      line.id::text,
      line.formula_snapshot,
      line.evidence_snapshot,
      line.note,
      line.created_by
    from public.payroll_line_items as line
    join public.payroll_statements as old_statement
      on old_statement.id = line.payroll_statement_id and old_statement.calculation_run_id = previous_run_id
    join public.payroll_statements as new_statement
      on new_statement.calculation_run_id = created_run.id and new_statement.staff_id = old_statement.staff_id
    where line.line_type in ('manual_reward', 'manual_deduction');
  end if;

  -- Apply the role-specific piecework floor using an auditable offset line.
  with statement_amounts as (
    select
      statement.id as statement_id,
      statement.staff_id,
      position.position_code,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (
        where line.direction = 'earning' and line.line_type in ('base_offline', 'base_online', 'hourly_wage')
      ), 0)::bigint as base_salary_vnd,
      coalesce(pg_catalog.sum(line.amount_vnd) filter (
        where line.direction = 'earning' and line.line_type not in ('base_offline', 'base_online', 'hourly_wage', 'manual_reward')
      ), 0)::bigint as piecework_vnd
    from public.payroll_statements as statement
    join lateral (
      select version.position_code
      from public.staff_payroll_position_versions as version
      where version.staff_id = statement.staff_id and version.effective_from <= month_end
      order by version.effective_from desc limit 1
    ) as position on true
    left join public.payroll_line_items as line on line.payroll_statement_id = statement.id
    where statement.calculation_run_id = created_run.id
    group by statement.id, statement.staff_id, position.position_code
  ), offsets as (
    select
      amount.*,
      (floor_policy.parameters->>'base_salary_basis_points')::integer as base_floor_basis_points,
      least(
        amount.piecework_vnd,
        pg_catalog.round(
          amount.base_salary_vnd::numeric
          * (floor_policy.parameters->>'base_salary_basis_points')::integer
          / 10000
        )::bigint
      ) as offset_vnd
    from statement_amounts as amount
    join lateral (
      select version.parameters
      from public.payroll_policy_versions as version
      where version.policy_code = case amount.position_code
        when 'operations_assistant' then 'operations_piecework_floor'
        when 'admissions_manager' then 'admissions_piecework_floor'
      end
        and version.effective_from <= month_end
      order by version.effective_from desc
      limit 1
    ) as floor_policy on amount.position_code in ('operations_assistant', 'admissions_manager')
  )
  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, policy_code, source_kind,
    source_id, formula_snapshot, evidence_snapshot, note, created_by
  )
  select
    calculated_offset.statement_id,
    'piecework_offset',
    'deduction',
    calculated_offset.offset_vnd,
    case calculated_offset.position_code when 'operations_assistant' then 'operations_piecework_floor' else 'admissions_piecework_floor' end,
    'calculation_run',
    created_run.id::text || ':piecework-floor:' || calculated_offset.staff_id::text,
    pg_catalog.jsonb_build_object(
      'position_code', calculated_offset.position_code,
      'base_salary_vnd', calculated_offset.base_salary_vnd,
      'piecework_vnd', calculated_offset.piecework_vnd,
      'offset_vnd', calculated_offset.offset_vnd,
      'base_floor_basis_points', calculated_offset.base_floor_basis_points
    ),
    '{}'::jsonb,
    case calculated_offset.position_code
      when 'operations_assistant' then 'Bù trừ lương khoán đến ngưỡng 85% lương cứng.'
      else 'Bù trừ phần lương khoán chưa vượt lương cứng.'
    end,
    actor_id
  from offsets as calculated_offset
  where calculated_offset.offset_vnd > 0;

  -- Salary advances are deducted once per current calculation revision.
  insert into public.payroll_calculation_issues (
    calculation_run_id, issue_code, staff_id, details
  )
  select
    created_run.id,
    'missing_advance_statement',
    advance.staff_id,
    pg_catalog.jsonb_build_object('salary_advance_id', advance.id, 'amount_vnd', advance.amount_vnd)
  from public.salary_advances as advance
  where advance.status = 'approved'
    and advance.deduction_period_month = target_period.period_month
    and not exists (
      select 1 from public.payroll_statements as statement
      where statement.calculation_run_id = created_run.id and statement.staff_id = advance.staff_id
    );

  insert into public.payroll_line_items (
    payroll_statement_id, line_type, direction, amount_vnd, note, created_by,
    salary_advance_id, policy_code, source_kind, source_id, formula_snapshot, evidence_snapshot
  )
  select
    statement.id,
    'advance_deduction',
    'deduction',
    advance.amount_vnd,
    'Khấu trừ tạm ứng lương.',
    actor_id,
    advance.id,
    'salary_advance',
    'salary_advance',
    advance.id::text,
    pg_catalog.jsonb_build_object('amount_vnd', advance.amount_vnd),
    pg_catalog.jsonb_build_object('request_note', advance.request_note)
  from public.salary_advances as advance
  join public.payroll_statements as statement
    on statement.calculation_run_id = created_run.id and statement.staff_id = advance.staff_id
  where (advance.status = 'approved' and advance.deduction_period_month = target_period.period_month)
    or (advance.status = 'deducted' and advance.deduction_payroll_period_id = target_period.id);

  update public.salary_advances
  set status = 'deducted', deducted_at = pg_catalog.now(), deduction_payroll_period_id = target_period.id
  where status = 'approved'
    and deduction_period_month = target_period.period_month
    and exists (
      select 1 from public.payroll_statements as statement
      where statement.calculation_run_id = created_run.id
        and statement.staff_id = salary_advances.staff_id
    );

  update public.payroll_periods
  set
    current_calculation_run_id = created_run.id,
    feedback_opened_at = pg_catalog.now(),
    feedback_closed_at = null,
    feedback_closed_by = null
  where id = target_period.id;

  return created_run;
end;
$$;

commit;
