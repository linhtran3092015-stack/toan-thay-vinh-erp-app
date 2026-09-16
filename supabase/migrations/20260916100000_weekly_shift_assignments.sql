begin;

-- Weekly rows describe one actual work date. Legacy ranges retain their IDs
-- and attendance references; recurring assignments stop at this week's end.
alter table public.staff_shift_assignments add column week_start date;
alter table public.staff_shift_assignments drop constraint staff_shift_assignments_lifecycle_check;
alter table public.staff_shift_assignments add constraint staff_shift_assignments_lifecycle_check check (
  (is_active and ended_by is null and end_reason is null)
  or (not is_active and effective_to is not null and ended_by is not null and nullif(btrim(end_reason), '') is not null)
);
alter table public.staff_shift_assignments add constraint staff_shift_assignments_week_check check (
  week_start is null or (
    extract(isodow from week_start) = 1
    and effective_from = week_start + (weekday - 1)
    and effective_to is not null and effective_to = effective_from
  )
);
drop index public.staff_shift_assignments_active_staff_weekday_unique_idx;
create unique index staff_shift_assignments_active_staff_weekday_unique_idx
  on public.staff_shift_assignments(staff_id, weekday) where is_active and week_start is null;
create unique index staff_shift_assignments_week_unique_idx
  on public.staff_shift_assignments(staff_id, week_start, weekday) where week_start is not null;
create index staff_shift_assignments_week_idx on public.staff_shift_assignments(week_start, weekday);

update public.staff_shift_assignments set effective_to = greatest(effective_from,
  date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')::date + 6)
where is_active and week_start is null and effective_to is null;

-- A version must change even for two writes in the same transaction; now()
-- is transaction-stable, so the generic updated_at trigger is insufficient.
create function public.set_staff_shift_assignment_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end $$;
revoke all on function public.set_staff_shift_assignment_updated_at() from public, anon, authenticated;
drop trigger staff_shift_assignments_set_updated_at on public.staff_shift_assignments;
create trigger staff_shift_assignments_set_updated_at before update on public.staff_shift_assignments
  for each row execute function public.set_staff_shift_assignment_updated_at();

-- Internal selector intentionally includes cancellation tombstones. Filtering
-- is_active before selecting would resurrect a replaced recurring assignment.
create function public.resolve_staff_shift_on_date(p_staff_id uuid, p_work_date date)
returns setof public.staff_shift_assignments language sql stable security definer set search_path = '' as $$
  select a.* from public.staff_shift_assignments a
  where a.staff_id = p_staff_id and a.weekday = extract(isodow from p_work_date)
    and a.effective_from <= p_work_date and (a.effective_to is null or a.effective_to >= p_work_date)
  order by (a.week_start is not null) desc, a.effective_from desc, a.created_at desc, a.id
  limit 1
$$;
revoke all on function public.resolve_staff_shift_on_date(uuid,date) from public, anon, authenticated;

create function public.get_weekly_shift_schedule(p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED'; end if;
  if not public.has_permission('timekeeping.view') then raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception using errcode = '22023', message = 'WEEKLY_SCHEDULE_INVALID_WEEK';
  end if;
  with candidates as (
    select distinct a.staff_id from public.staff_shift_assignments a
    where a.effective_from <= p_week_start + 6 and (a.effective_to is null or a.effective_to >= p_week_start)
  ), rows as (
    select a.id as assignment_id, a.staff_id, p.display_name as staff_display_name,
      p.employee_code as staff_employee_code, p.employment_status as staff_employment_status,
      a.weekday, a.effective_from, a.effective_to, s.id as work_shift_id, s.code as work_shift_code,
      s.name as work_shift_name, s.start_time, s.end_time, s.crosses_midnight, s.break_minutes,
      p_week_start + d.day as work_date, a.week_start, a.updated_at,
      (a.week_start is null or a.is_active) as is_active,
      (p_week_start + d.day < (now() at time zone 'Asia/Ho_Chi_Minh')::date or exists (
        select 1 from public.time_entries t where t.staff_id = a.staff_id and (
          t.work_date = p_week_start + d.day
          or (s.crosses_midnight and t.work_date = p_week_start + d.day + 1)
          or (a.week_start is not null and t.staff_shift_assignment_id = a.id)
        )
      )) as is_locked
    from candidates c cross join generate_series(0,6) as d(day)
    cross join lateral public.resolve_staff_shift_on_date(c.staff_id, p_week_start + d.day) a
    join public.profiles p on p.id = a.staff_id join public.work_shifts s on s.id = a.work_shift_id
  ) select coalesce(jsonb_agg(to_jsonb(rows) order by work_date, start_time, staff_display_name, staff_id), '[]'::jsonb) into result from rows;
  return result;
end $$;
revoke all on function public.get_weekly_shift_schedule(date) from public, anon, authenticated;
grant execute on function public.get_weekly_shift_schedule(date) to authenticated;

create function public.save_weekly_shift_assignment(
  p_week_start date, p_weekday integer, p_staff_id uuid, p_work_shift_id uuid,
  p_expected_assignment_id uuid, p_expected_updated_at timestamptz, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_date date;
  previous public.staff_shift_assignments%rowtype;
  shift public.work_shifts%rowtype;
  result_id uuid;
  reason text := nullif(btrim(p_reason), '');
begin
  if actor is null then raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED'; end if;
  if not public.has_permission('staff.manage') then raise exception using errcode = '42501', message = 'STAFF_MANAGE_PERMISSION_REQUIRED'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 or p_weekday is null or p_weekday not between 1 and 7
    or p_staff_id is null or reason is null or length(reason) > 2000 then
    raise exception using errcode = '22023', message = 'WEEKLY_SCHEDULE_INVALID_INPUT';
  end if;
  target_date := p_week_start + p_weekday - 1;
  if target_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception using errcode = '23514', message = 'WEEKLY_SCHEDULE_PAST_DATE';
  end if;
  -- Same lock as both normal and exception check-in. Prevent mutation/check-in races.
  perform pg_advisory_xact_lock(hashtext('time-entry:' || p_staff_id::text));
  perform pg_advisory_xact_lock(hashtext('staff-shift-assignment:' || p_staff_id::text || ':' || p_weekday::text));
  perform 1 from public.profiles where id = p_staff_id and employment_status = 'active' for share;
  if not found then raise exception using errcode = '23514', message = 'STAFF_SHIFT_REQUIRES_ACTIVE_STAFF'; end if;
  select * into previous from public.resolve_staff_shift_on_date(p_staff_id, target_date);
  if previous.id is distinct from p_expected_assignment_id or previous.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'WEEKLY_SCHEDULE_CONFLICT';
  end if;
  if p_work_shift_id is null and previous.id is null then
    raise exception using errcode = '22023', message = 'WEEKLY_SCHEDULE_NOTHING_TO_CANCEL';
  end if;
  select * into shift from public.work_shifts where id = coalesce(p_work_shift_id, previous.work_shift_id) for share;
  if not found or (p_work_shift_id is not null and not shift.is_active) then
    raise exception using errcode = '23514', message = 'STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT';
  end if;
  if exists (select 1 from public.time_entries t where t.staff_id = p_staff_id and (
    t.work_date = target_date
    or (t.work_date = target_date + 1 and (shift.crosses_midnight or exists (
      select 1 from public.work_shifts old_shift where old_shift.id = previous.work_shift_id and old_shift.crosses_midnight
    )))
    or (previous.week_start is not null and t.staff_shift_assignment_id = previous.id)
  )) then raise exception using errcode = '23514', message = 'WEEKLY_SCHEDULE_HAS_ATTENDANCE'; end if;
  perform set_config('app.audit_reason', reason, true);
  if previous.week_start is not null then
    update public.staff_shift_assignments set work_shift_id = shift.id, is_active = p_work_shift_id is not null,
      ended_by = case when p_work_shift_id is null then actor end,
      end_reason = case when p_work_shift_id is null then reason end
    where id = previous.id returning id into result_id;
  else
    insert into public.staff_shift_assignments(staff_id,work_shift_id,weekday,week_start,effective_from,effective_to,is_active,ended_by,end_reason,created_by)
    values (p_staff_id,shift.id,p_weekday,p_week_start,target_date,target_date,p_work_shift_id is not null,
      case when p_work_shift_id is null then actor end, case when p_work_shift_id is null then reason end,actor)
    returning id into result_id;
  end if;
  return result_id;
end $$;
revoke all on function public.save_weekly_shift_assignment(date,integer,uuid,uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.save_weekly_shift_assignment(date,integer,uuid,uuid,uuid,timestamptz,text) to authenticated;

-- A ca qua đêm belongs to its starting date, including Sunday -> Monday.
create function public.resolve_staff_shift_for_checkin(p_staff_id uuid, p_date date, p_time time)
returns uuid language sql stable security definer set search_path = '' as $$
  select a.id from (values (p_date,0), (p_date - 1,1)) as d(work_date,priority)
  cross join lateral public.resolve_staff_shift_on_date(p_staff_id,d.work_date) a
  join public.work_shifts s on s.id = a.work_shift_id
  where a.is_active and s.is_active and (d.priority = 0 or (s.crosses_midnight and p_time < s.end_time))
  order by d.priority desc limit 1
$$;
revoke all on function public.resolve_staff_shift_for_checkin(uuid,date,time) from public, anon, authenticated;

-- Retain existing permission/evidence/watchdog logic, replacing only shift
-- resolution. Fail closed if a deployed definition no longer matches.
do $$
declare definition text; updated text; target regprocedure;
begin
  target := 'public.check_in_time_entry(text,numeric,numeric,integer,text,text)'::regprocedure;
  definition := pg_get_functiondef(target);
  updated := regexp_replace(definition,
    'select assignment\.\* into target_assignment[[:space:]]+from public\.staff_shift_assignments as assignment[\s\S]*?limit 1 for share of assignment;',
    'select * into target_assignment from public.staff_shift_assignments where id = public.resolve_staff_shift_for_checkin(actor_id, business_date, business_time) for share;');
  if updated = definition then raise exception 'WEEKLY_CHECKIN_PATCH_TARGET_CHANGED'; end if;
  execute updated;
  target := 'public.retire_work_shift(uuid,text)'::regprocedure;
  definition := pg_get_functiondef(target);
  updated := replace(definition, 'and assignment.is_active',
    'and assignment.is_active and (assignment.effective_to is null or assignment.effective_to >= (now() at time zone ''Asia/Ho_Chi_Minh'')::date)');
  if updated = definition then raise exception 'WEEKLY_RETIRE_PATCH_TARGET_CHANGED'; end if;
  execute updated;
  -- This RPC is optional on installations without the exception-review feature.
  for target in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'request_attendance_exception'
  loop
    definition := pg_get_functiondef(target);
    updated := regexp_replace(definition,
      'select a\.id into assignment_id[[:space:]]+from public\.staff_shift_assignments a join public\.work_shifts s on s\.id = a\.work_shift_id[\s\S]*?limit 1 for share of a;',
      'select id into assignment_id from public.staff_shift_assignments where id = public.resolve_staff_shift_for_checkin(actor_id, business_date, business_time) for share;');
    if updated = definition then raise exception 'WEEKLY_EXCEPTION_PATCH_TARGET_CHANGED'; end if;
    execute updated;
  end loop;
end $$;

-- Old clients must not create perpetual schedules or mutate history after the
-- weekly workflow is enabled. The new RPC is the only assignment writer.
revoke execute on function public.create_staff_shift_assignment(uuid,uuid,smallint,date,text) from authenticated;
revoke execute on function public.replace_staff_shift_assignment(uuid,uuid,date,text) from authenticated;
revoke execute on function public.end_staff_shift_assignment(uuid,date,text) from authenticated;

-- Compatibility reader used by older callers: return only this week's active
-- selections, never all future weeks together.
create or replace function public.get_timekeeping_schedule()
returns table(assignment_id uuid,staff_id uuid,staff_display_name text,staff_employee_code text,staff_employment_status text,
 weekday smallint,effective_from date,effective_to date,work_shift_id uuid,work_shift_code text,work_shift_name text,
 start_time time,end_time time,crosses_midnight boolean,break_minutes smallint)
language sql stable security definer set search_path = '' as $$
 select r.assignment_id,r.staff_id,r.staff_display_name,r.staff_employee_code,r.staff_employment_status,r.weekday,
 r.effective_from,r.effective_to,r.work_shift_id,r.work_shift_code,r.work_shift_name,r.start_time,r.end_time,r.crosses_midnight,r.break_minutes
 from jsonb_to_recordset(public.get_weekly_shift_schedule(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date)) as r(
 assignment_id uuid,staff_id uuid,staff_display_name text,staff_employee_code text,staff_employment_status text,
 weekday smallint,effective_from date,effective_to date,work_shift_id uuid,work_shift_code text,work_shift_name text,
 start_time time,end_time time,crosses_midnight boolean,break_minutes smallint,is_active boolean)
 where r.is_active
$$;

commit;
