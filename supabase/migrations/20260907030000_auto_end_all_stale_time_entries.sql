begin;

-- ============================================================================
-- Migration: 20260907030000_auto_end_all_stale_time_entries.sql
-- Purpose:
-- 1. Close any historical open time entries across all staff roles that were
--    left unclosed past the 23:30 VN daily cutoff.
-- 2. Update run_teaching_assistant_timekeeping_watchdog() to auto-end stale
--    open time entries for ALL staff roles (including assistant_manager, etc.)
--    at the 23:30 cutoff, while maintaining strict continuous location tracking
--    for teaching assistants in offline mode.
-- 3. Update get_my_timekeeping_entries() to return any open entries regardless
--    of work date so the UI always reflects active status and allows checkout.
-- ============================================================================

-- 1. One-time data cleanup: close historical unclosed entries for all roles
update public.time_entries
set
  check_out_at = (work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh',
  check_out_mode = 'auto_end',
  status = 'auto_ended',
  clock_out_reason = 'daily_cutoff',
  auto_ended_at = (work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh',
  updated_at = pg_catalog.now()
where status = 'open'
  and (
    work_date < (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date
    or (
      work_date = (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date
      and (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::time >= time '23:30'
    )
  );

-- 2. Enhanced watchdog: auto-ends stale entries for all staff roles at 23:30 cutoff
create or replace function public.run_teaching_assistant_timekeeping_watchdog()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  business_time time without time zone := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::time;
  entry_record record;
  location_loss_ts timestamptz;
  daily_cutoff_ts timestamptz;
  effective_end_ts timestamptz;
  effective_reason text;
  closed_count integer := 0;
begin
  for entry_record in
    select
      entry.id,
      entry.staff_id,
      entry.work_date,
      entry.check_in_at,
      entry.check_in_mode,
      entry.last_location_at,
      exists (
        select 1
        from public.user_role_assignments as assignment
        join public.roles as role
          on role.id = assignment.role_id
          and role.code = 'teaching_assistant'
          and role.is_active
        where assignment.user_id = entry.staff_id
          and assignment.revoked_at is null
      ) as is_teaching_assistant
    from public.time_entries as entry
    where entry.status = 'open'
  loop
    location_loss_ts := coalesce(entry_record.last_location_at, entry_record.check_in_at) + interval '90 seconds';
    daily_cutoff_ts := (entry_record.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh';

    -- Case 1: Teaching Assistant with offline mode & continuous location loss before cutoff
    if entry_record.is_teaching_assistant
      and entry_record.check_in_mode = 'offline'
      and pg_catalog.now() >= location_loss_ts
      and location_loss_ts <= daily_cutoff_ts
    then
      effective_end_ts := location_loss_ts;
      effective_reason := 'location_lost';
    -- Case 2: Daily cutoff reached for ANY staff role (past date or >= 23:30 today)
    elsif entry_record.work_date < business_date
      or (entry_record.work_date = business_date and business_time >= time '23:30')
    then
      effective_end_ts := daily_cutoff_ts;
      effective_reason := 'daily_cutoff';
    else
      continue;
    end if;

    update public.time_entries
    set
      check_out_at = effective_end_ts,
      check_out_mode = 'auto_end',
      status = 'auto_ended',
      clock_out_reason = effective_reason,
      auto_ended_at = effective_end_ts,
      updated_at = pg_catalog.now()
    where id = entry_record.id;

    closed_count := closed_count + 1;
  end loop;

  return closed_count;
end;
$$;

revoke all on function public.run_teaching_assistant_timekeeping_watchdog() from public, anon, authenticated;

-- Ensure alias function routes to updated watchdog
create or replace function public.auto_end_stale_teaching_assistant_time_entries()
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  return public.run_teaching_assistant_timekeeping_watchdog();
end;
$$;

revoke all on function public.auto_end_stale_teaching_assistant_time_entries() from public, anon, authenticated;

-- 3. Update get_my_timekeeping_entries: scope to business date OR open entries
create or replace function public.get_my_timekeeping_entries()
returns table (
  entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  auto_ended_at timestamptz,
  clock_out_reason text,
  last_location_at timestamptz,
  is_unscheduled boolean,
  scheduled_start_time time,
  scheduled_end_time time,
  work_shift_code text,
  work_shift_name text,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
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
    entry.id, entry.work_date, entry.check_in_at, entry.check_in_mode,
    entry.check_out_at, entry.check_out_mode, entry.status,
    entry.auto_ended_at, entry.clock_out_reason, entry.last_location_at,
    (entry.staff_shift_assignment_id is null), shift.start_time, shift.end_time,
    shift.code, shift.name,
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'wifi'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'wifi')
  from public.time_entries as entry
  left join public.staff_shift_assignments as assignment on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  where entry.staff_id = actor_id
    and (entry.work_date = business_date or entry.status = 'open')
  order by entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_entries() from public, anon;
grant execute on function public.get_my_timekeeping_entries() to authenticated;

commit;
