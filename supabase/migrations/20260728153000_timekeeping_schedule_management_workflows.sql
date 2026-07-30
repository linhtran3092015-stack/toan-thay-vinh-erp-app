begin;

-- =========================================================
-- TASK 8D
-- Work-shift catalogue and recurring staff schedule workflows.
--
-- These workflows intentionally do not create time entries,
-- attendance adjustments, location evidence, or payroll records.
-- =========================================================


-- =========================================================
-- AUDIT
--
-- Keep the Task 8C trigger, but distinguish retirement and replacement
-- actions and always attribute updates to the current authenticated actor.
-- =========================================================

create or replace function public.audit_timekeeping_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
  audit_entity_type text;
begin
  if tg_table_name = 'work_shifts' then
    actor_id := case
      when tg_op = 'INSERT' then coalesce(new.created_by, auth.uid())
      else coalesce(auth.uid(), new.created_by)
    end;

    audit_entity_type := 'work_shift';
    audit_action := case
      when tg_op = 'INSERT' then 'work_shift_created'
      when old.is_active and not new.is_active then 'work_shift_retired'
      else 'work_shift_updated'
    end;
  elsif tg_table_name = 'staff_shift_assignments' then
    actor_id := case
      when tg_op = 'INSERT' then coalesce(new.created_by, auth.uid())
      else coalesce(new.ended_by, auth.uid(), new.created_by)
    end;

    audit_entity_type := 'staff_shift_assignment';
    audit_action := case
      when tg_op = 'INSERT'
        and new.supersedes_staff_shift_assignment_id is not null
        then 'staff_shift_assignment_replacement_created'
      when tg_op = 'INSERT' then 'staff_shift_assignment_created'
      when old.is_active and not new.is_active
        then 'staff_shift_assignment_ended'
      else 'staff_shift_assignment_updated'
    end;
  else
    raise exception using
      errcode = 'P0001',
      message = 'UNSUPPORTED_TIMEKEEPING_AUDIT_TABLE';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    actor_id,
    'timekeeping',
    audit_action,
    audit_entity_type,
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    nullif(pg_catalog.current_setting('app.audit_reason', true), ''),
    pg_catalog.jsonb_build_object(
      'source',
      case
        when actor_id is null then 'database'
        else 'timekeeping_schedule_workflow'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_timekeeping_schedule_change()
from public, anon, authenticated;


-- =========================================================
-- READ MODEL FOR SCHEDULE MANAGERS
--
-- A manager needs a narrow active-staff picker without receiving access to
-- profile email, phone, or the general staff directory.
-- =========================================================

create or replace function public.get_timekeeping_staff_options()
returns table (
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    profile.employee_code
  from public.profiles as profile
  where profile.employment_status = 'active'
  order by
    pg_catalog.lower(coalesce(profile.display_name, '')),
    profile.employee_code nulls last,
    profile.id;
end;
$$;

revoke all on function public.get_timekeeping_staff_options()
from public, anon, authenticated;

grant execute on function public.get_timekeeping_staff_options()
to authenticated;


-- =========================================================
-- WORK-SHIFT CATALOGUE
-- Permission: staff.manage
--
-- Once a shift has been used by any assignment, it is historical data and
-- cannot be edited. Create a replacement shift and replace active schedules.
-- =========================================================

create or replace function public.create_work_shift(
  p_code text,
  p_name text,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_crosses_midnight boolean,
  p_break_minutes smallint,
  p_notes text,
  p_reason text
)
returns public.work_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_code)),
    ''
  );
  normalized_name text := nullif(pg_catalog.btrim(p_name), '');
  normalized_notes text := nullif(pg_catalog.btrim(p_notes), '');
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  result_shift public.work_shifts%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if normalized_code is null
    or normalized_code !~ '^[A-Z0-9._-]{2,64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_CODE_INVALID';
  end if;

  if normalized_name is null
    or pg_catalog.length(normalized_name) > 160
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_NAME_INVALID';
  end if;

  if normalized_notes is not null
    and pg_catalog.length(normalized_notes) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_NOTES_TOO_LONG';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_REASON_REQUIRED';
  end if;

  if p_break_minutes is null or p_break_minutes < 0 then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_BREAK_MINUTES_INVALID';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_crosses_midnight is null
    or (
      p_crosses_midnight
      and p_end_time >= p_start_time
    )
    or (
      not p_crosses_midnight
      and p_end_time <= p_start_time
    )
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_TIME_INVALID';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  insert into public.work_shifts (
    code,
    name,
    start_time,
    end_time,
    crosses_midnight,
    break_minutes,
    is_active,
    notes,
    created_by
  )
  values (
    normalized_code,
    normalized_name,
    p_start_time,
    p_end_time,
    p_crosses_midnight,
    p_break_minutes,
    true,
    normalized_notes,
    actor_id
  )
  returning * into result_shift;

  return result_shift;
end;
$$;

revoke all on function public.create_work_shift(
  text,
  text,
  time without time zone,
  time without time zone,
  boolean,
  smallint,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.create_work_shift(
  text,
  text,
  time without time zone,
  time without time zone,
  boolean,
  smallint,
  text,
  text
)
to authenticated;


create or replace function public.update_work_shift(
  p_work_shift_id uuid,
  p_code text,
  p_name text,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_crosses_midnight boolean,
  p_break_minutes smallint,
  p_notes text,
  p_reason text
)
returns public.work_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_code text := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_code)),
    ''
  );
  normalized_name text := nullif(pg_catalog.btrim(p_name), '');
  normalized_notes text := nullif(pg_catalog.btrim(p_notes), '');
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_shift public.work_shifts%rowtype;
  result_shift public.work_shifts%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_work_shift_id is null then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_ID_REQUIRED';
  end if;

  if normalized_code is null
    or normalized_code !~ '^[A-Z0-9._-]{2,64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_CODE_INVALID';
  end if;

  if normalized_name is null
    or pg_catalog.length(normalized_name) > 160
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_NAME_INVALID';
  end if;

  if normalized_notes is not null
    and pg_catalog.length(normalized_notes) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_NOTES_TOO_LONG';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_REASON_REQUIRED';
  end if;

  if p_break_minutes is null or p_break_minutes < 0 then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_BREAK_MINUTES_INVALID';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_crosses_midnight is null
    or (
      p_crosses_midnight
      and p_end_time >= p_start_time
    )
    or (
      not p_crosses_midnight
      and p_end_time <= p_start_time
    )
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_TIME_INVALID';
  end if;

  select shift.*
  into target_shift
  from public.work_shifts as shift
  where shift.id = p_work_shift_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'WORK_SHIFT_NOT_FOUND';
  end if;

  if not target_shift.is_active then
    raise exception using
      errcode = '23514',
      message = 'INACTIVE_WORK_SHIFT_IS_IMMUTABLE';
  end if;

  if exists (
    select 1
    from public.staff_shift_assignments as assignment
    where assignment.work_shift_id = target_shift.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'WORK_SHIFT_WITH_ASSIGNMENTS_IMMUTABLE';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  update public.work_shifts
  set
    code = normalized_code,
    name = normalized_name,
    start_time = p_start_time,
    end_time = p_end_time,
    crosses_midnight = p_crosses_midnight,
    break_minutes = p_break_minutes,
    notes = normalized_notes,
    updated_at = pg_catalog.now()
  where id = target_shift.id
  returning * into result_shift;

  return result_shift;
end;
$$;

revoke all on function public.update_work_shift(
  uuid,
  text,
  text,
  time without time zone,
  time without time zone,
  boolean,
  smallint,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.update_work_shift(
  uuid,
  text,
  text,
  time without time zone,
  time without time zone,
  boolean,
  smallint,
  text,
  text
)
to authenticated;


create or replace function public.retire_work_shift(
  p_work_shift_id uuid,
  p_reason text
)
returns public.work_shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_shift public.work_shifts%rowtype;
  result_shift public.work_shifts%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_work_shift_id is null then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_ID_REQUIRED';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_RETIRE_REASON_REQUIRED';
  end if;

  select shift.*
  into target_shift
  from public.work_shifts as shift
  where shift.id = p_work_shift_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'WORK_SHIFT_NOT_FOUND';
  end if;

  if not target_shift.is_active then
    raise exception using
      errcode = '23514',
      message = 'ONLY_ACTIVE_WORK_SHIFT_CAN_BE_RETIRED';
  end if;

  if exists (
    select 1
    from public.staff_shift_assignments as assignment
    where assignment.work_shift_id = target_shift.id
      and assignment.is_active
  ) then
    raise exception using
      errcode = '23514',
      message = 'WORK_SHIFT_ACTIVE_ASSIGNMENTS_EXIST';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  update public.work_shifts
  set
    is_active = false,
    updated_at = pg_catalog.now()
  where id = target_shift.id
  returning * into result_shift;

  return result_shift;
end;
$$;

revoke all on function public.retire_work_shift(uuid, text)
from public, anon, authenticated;

grant execute on function public.retire_work_shift(uuid, text)
to authenticated;


-- =========================================================
-- RECURRING STAFF-SHIFT ASSIGNMENTS
-- Permission: staff.manage
--
-- A replacement closes the previous version at yesterday and creates a
-- successor with a back-reference. End operations never overwrite history.
-- =========================================================

create or replace function public.create_staff_shift_assignment(
  p_staff_id uuid,
  p_work_shift_id uuid,
  p_weekday smallint,
  p_effective_from date,
  p_reason text
)
returns public.staff_shift_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_staff public.profiles%rowtype;
  target_shift public.work_shifts%rowtype;
  result_assignment public.staff_shift_assignments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_ID_REQUIRED';
  end if;

  if p_work_shift_id is null then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_ID_REQUIRED';
  end if;

  if p_weekday is null or p_weekday < 1 or p_weekday > 7 then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_WEEKDAY_INVALID';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_EFFECTIVE_FROM_REQUIRED';
  end if;

  if p_effective_from <> business_date then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_MUST_START_ON_BUSINESS_DATE';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_CREATE_REASON_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'staff-shift-assignment:'
      || p_staff_id::text
      || ':'
      || p_weekday::text
    )
  );

  select profile.*
  into target_staff
  from public.profiles as profile
  where profile.id = p_staff_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_staff.employment_status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_REQUIRES_ACTIVE_STAFF';
  end if;

  select shift.*
  into target_shift
  from public.work_shifts as shift
  where shift.id = p_work_shift_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'WORK_SHIFT_NOT_FOUND';
  end if;

  if not target_shift.is_active then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT';
  end if;

  if exists (
    select 1
    from public.staff_shift_assignments as assignment
    where assignment.staff_id = p_staff_id
      and assignment.weekday = p_weekday
      and assignment.is_active
  ) then
    raise exception using
      errcode = '23505',
      message = 'STAFF_SHIFT_ACTIVE_WEEKDAY_ALREADY_EXISTS';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  insert into public.staff_shift_assignments (
    staff_id,
    work_shift_id,
    weekday,
    effective_from,
    effective_to,
    is_active,
    supersedes_staff_shift_assignment_id,
    ended_by,
    end_reason,
    created_by
  )
  values (
    target_staff.id,
    target_shift.id,
    p_weekday,
    p_effective_from,
    null,
    true,
    null,
    null,
    null,
    actor_id
  )
  returning * into result_assignment;

  return result_assignment;
end;
$$;

revoke all on function public.create_staff_shift_assignment(
  uuid,
  uuid,
  smallint,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.create_staff_shift_assignment(
  uuid,
  uuid,
  smallint,
  date,
  text
)
to authenticated;


create or replace function public.replace_staff_shift_assignment(
  p_staff_shift_assignment_id uuid,
  p_work_shift_id uuid,
  p_effective_from date,
  p_reason text
)
returns public.staff_shift_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  previous_assignment public.staff_shift_assignments%rowtype;
  target_staff public.profiles%rowtype;
  target_shift public.work_shifts%rowtype;
  result_assignment public.staff_shift_assignments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_staff_shift_assignment_id is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_ASSIGNMENT_ID_REQUIRED';
  end if;

  if p_work_shift_id is null then
    raise exception using
      errcode = '22023',
      message = 'WORK_SHIFT_ID_REQUIRED';
  end if;

  if p_effective_from is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_EFFECTIVE_FROM_REQUIRED';
  end if;

  if p_effective_from <> business_date then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_REPLACEMENT_MUST_START_TODAY';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_REPLACEMENT_REASON_REQUIRED';
  end if;

  select assignment.*
  into previous_assignment
  from public.staff_shift_assignments as assignment
  where assignment.id = p_staff_shift_assignment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_SHIFT_ASSIGNMENT_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'staff-shift-assignment:'
      || previous_assignment.staff_id::text
      || ':'
      || previous_assignment.weekday::text
    )
  );

  if not previous_assignment.is_active then
    raise exception using
      errcode = '23514',
      message = 'ONLY_ACTIVE_STAFF_SHIFT_ASSIGNMENT_CAN_BE_REPLACED';
  end if;

  if previous_assignment.effective_from >= p_effective_from then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_CANNOT_BE_REPLACED_ON_START_DATE';
  end if;

  if previous_assignment.work_shift_id = p_work_shift_id then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_REPLACEMENT_REQUIRES_DIFFERENT_WORK_SHIFT';
  end if;

  select profile.*
  into target_staff
  from public.profiles as profile
  where profile.id = previous_assignment.staff_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_staff.employment_status <> 'active' then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_REQUIRES_ACTIVE_STAFF';
  end if;

  select shift.*
  into target_shift
  from public.work_shifts as shift
  where shift.id = p_work_shift_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'WORK_SHIFT_NOT_FOUND';
  end if;

  if not target_shift.is_active then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_REQUIRES_ACTIVE_WORK_SHIFT';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  update public.staff_shift_assignments
  set
    is_active = false,
    effective_to = p_effective_from - 1,
    ended_by = actor_id,
    end_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = previous_assignment.id;

  insert into public.staff_shift_assignments (
    staff_id,
    work_shift_id,
    weekday,
    effective_from,
    effective_to,
    is_active,
    supersedes_staff_shift_assignment_id,
    ended_by,
    end_reason,
    created_by
  )
  values (
    previous_assignment.staff_id,
    target_shift.id,
    previous_assignment.weekday,
    p_effective_from,
    null,
    true,
    previous_assignment.id,
    null,
    null,
    actor_id
  )
  returning * into result_assignment;

  return result_assignment;
end;
$$;

revoke all on function public.replace_staff_shift_assignment(
  uuid,
  uuid,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.replace_staff_shift_assignment(
  uuid,
  uuid,
  date,
  text
)
to authenticated;


create or replace function public.end_staff_shift_assignment(
  p_staff_shift_assignment_id uuid,
  p_effective_to date,
  p_reason text
)
returns public.staff_shift_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
  target_assignment public.staff_shift_assignments%rowtype;
  result_assignment public.staff_shift_assignments%rowtype;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('staff.manage') then
    raise exception using
      errcode = '42501',
      message = 'STAFF_MANAGE_PERMISSION_REQUIRED';
  end if;

  if p_staff_shift_assignment_id is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_ASSIGNMENT_ID_REQUIRED';
  end if;

  if p_effective_to is null then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_EFFECTIVE_TO_REQUIRED';
  end if;

  if normalized_reason is null
    or pg_catalog.length(normalized_reason) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'STAFF_SHIFT_END_REASON_REQUIRED';
  end if;

  select assignment.*
  into target_assignment
  from public.staff_shift_assignments as assignment
  where assignment.id = p_staff_shift_assignment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'STAFF_SHIFT_ASSIGNMENT_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'staff-shift-assignment:'
      || target_assignment.staff_id::text
      || ':'
      || target_assignment.weekday::text
    )
  );

  if not target_assignment.is_active then
    raise exception using
      errcode = '23514',
      message = 'ONLY_ACTIVE_STAFF_SHIFT_ASSIGNMENT_CAN_BE_ENDED';
  end if;

  if p_effective_to < target_assignment.effective_from then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_END_DATE_INVALID';
  end if;

  if p_effective_to > business_date then
    raise exception using
      errcode = '23514',
      message = 'STAFF_SHIFT_END_DATE_CANNOT_BE_FUTURE';
  end if;

  perform pg_catalog.set_config(
    'app.audit_reason',
    normalized_reason,
    true
  );

  update public.staff_shift_assignments
  set
    is_active = false,
    effective_to = p_effective_to,
    ended_by = actor_id,
    end_reason = normalized_reason,
    updated_at = pg_catalog.now()
  where id = target_assignment.id
  returning * into result_assignment;

  return result_assignment;
end;
$$;

revoke all on function public.end_staff_shift_assignment(
  uuid,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.end_staff_shift_assignment(
  uuid,
  date,
  text
)
to authenticated;

commit;
