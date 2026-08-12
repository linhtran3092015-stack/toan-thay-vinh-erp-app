begin;

-- =========================================================
-- REDESIGN EMPLOYEE ATTENDANCE FOR TEACHING ASSISTANTS
-- Includes:
-- 1. center_attendance_configs (Single active center enforced)
-- 2. Nullable staff_shift_assignment_id on time_entries
-- 3. Continuous tracking columns & clock_out_reason on time_entries
-- 4. Haversine distance calculation helper
-- 5. Updated history protection trigger
-- 6. Strict three-state geofence exit validation (DEFINITELY_INSIDE, AMBIGUOUS, DEFINITELY_OUTSIDE)
-- 7. Deterministic watchdog precedence (earliest effective end timestamp)
-- 8. 1-minute pg_cron watchdog schedule
-- 9. Updated read models & check-in/check-out RPCs
-- =========================================================

-- 1. Center Attendance Configurations Table
create table if not exists public.center_attendance_configs (
  id uuid primary key default gen_random_uuid(),
  code text not null constraint center_attendance_configs_code_unique unique,
  name text not null,
  center_latitude numeric(9, 6) constraint center_lat_range check (center_latitude is null or center_latitude between -90 and 90),
  center_longitude numeric(9, 6) constraint center_lng_range check (center_longitude is null or center_longitude between -180 and 180),
  attendance_radius_m integer not null default 100 constraint center_radius_positive check (attendance_radius_m > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint center_coords_required_when_active check (
    not is_active or (center_latitude is not null and center_longitude is not null)
  )
);

create unique index if not exists center_attendance_configs_single_active_idx
on public.center_attendance_configs (is_active)
where is_active = true;

alter table public.center_attendance_configs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'center_attendance_configs'
      and policyname = 'center_attendance_configs_select'
  ) then
    create policy center_attendance_configs_select
    on public.center_attendance_configs for select to authenticated
    using (is_active);
  end if;
end;
$$;

grant select on public.center_attendance_configs to authenticated;
grant select on public.center_attendance_configs to service_role;

-- Seed default unconfigured center entry if none exists
insert into public.center_attendance_configs (code, name, center_latitude, center_longitude, attendance_radius_m, is_active)
values ('MAIN_CENTER', 'Trung tâm Toán Thầy Vinh', null, null, 100, false)
on conflict (code) do nothing;


-- 2. Modify time_entries Table Schema
alter table public.time_entries alter column staff_shift_assignment_id drop not null;

alter table public.time_entries add column if not exists clock_out_reason text;
alter table public.time_entries add column if not exists last_latitude numeric(9, 6);
alter table public.time_entries add column if not exists last_longitude numeric(9, 6);
alter table public.time_entries add column if not exists last_location_accuracy integer;
alter table public.time_entries add column if not exists last_location_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_clock_out_reason_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_clock_out_reason_check
      check (clock_out_reason is null or clock_out_reason in ('manual', 'left_geofence', 'location_lost', 'daily_cutoff'));
  end if;
end;
$$;

grant select, insert, update on public.time_entries to service_role;


-- 3. Haversine Distance Calculation Helper (Meters)
create or replace function public.calculate_haversine_distance_m(
  lat1 numeric, lon1 numeric,
  lat2 numeric, lon2 numeric
)
returns numeric
language plpgsql immutable security definer set search_path = ''
as $$
declare
  r numeric := 6371000;
  dlat numeric := radians(lat2 - lat1);
  dlon numeric := radians(lon2 - lon1);
  a numeric;
begin
  if lat1 is null or lon1 is null or lat2 is null or lon2 is null then
    return null;
  end if;
  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
  return r * 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
end;
$$;


-- 4. Update History Protection Trigger for time_entries
create or replace function public.protect_time_entry_history()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'open' then
    raise exception using
      errcode = '23514',
      message = 'CLOSED_TIME_ENTRY_IS_IMMUTABLE';
  end if;

  if new.id is distinct from old.id
    or new.staff_id is distinct from old.staff_id
    or new.staff_shift_assignment_id is distinct from old.staff_shift_assignment_id
    or new.work_date is distinct from old.work_date
    or new.check_in_at is distinct from old.check_in_at
    or new.check_in_mode is distinct from old.check_in_mode
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '23514',
      message = 'TIME_ENTRY_HISTORY_IS_IMMUTABLE';
  end if;

  if new.status not in ('open', 'checked_out', 'auto_ended') then
    raise exception using
      errcode = '23514',
      message = 'OPEN_TIME_ENTRY_MUST_BE_CLOSED_BY_WORKFLOW';
  end if;

  return new;
end;
$$;


-- 5. Unified Watchdog Function with Deterministic Earliest Effective Timestamp Precedence
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
    select entry.id, entry.work_date, entry.check_in_at, entry.last_location_at
    from public.time_entries as entry
    where entry.status = 'open'
      and exists (
        select 1
        from public.user_role_assignments as assignment
        join public.roles as role
          on role.id = assignment.role_id
          and role.code = 'teaching_assistant'
          and role.is_active
        where assignment.user_id = entry.staff_id
          and assignment.revoked_at is null
      )
  loop
    location_loss_ts := pg_catalog.coalesce(entry_record.last_location_at, entry_record.check_in_at) + interval '90 seconds';
    daily_cutoff_ts := (entry_record.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh';

    -- Evaluate whether either automatic termination condition has been met
    if pg_catalog.now() >= location_loss_ts
      or entry_record.work_date < business_date
      or (entry_record.work_date = business_date and business_time >= time '23:30')
    then
      -- Select earliest effective end timestamp and corresponding reason
      if location_loss_ts <= daily_cutoff_ts and pg_catalog.now() >= location_loss_ts then
        effective_end_ts := location_loss_ts;
        effective_reason := 'location_lost';
      else
        effective_end_ts := daily_cutoff_ts;
        effective_reason := 'daily_cutoff';
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
    end if;
  end loop;

  return closed_count;
end;
$$;

revoke all on function public.run_teaching_assistant_timekeeping_watchdog()
from public, anon, authenticated;

-- Retain legacy alias for existing callers
create or replace function public.auto_end_stale_teaching_assistant_time_entries()
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  return public.run_teaching_assistant_timekeeping_watchdog();
end;
$$;

revoke all on function public.auto_end_stale_teaching_assistant_time_entries()
from public, anon, authenticated;


-- 6. Cron Schedule: Run Watchdog Every 1 Minute
do $$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    for existing_job_id in
      select jobid from cron.job where jobname = 'timekeeping-auto-end-teaching-assistants'
    loop
      perform cron.unschedule(existing_job_id);
    end loop;

    perform cron.schedule(
      'timekeeping-auto-end-teaching-assistants',
      '* * * * *',
      'select public.run_teaching_assistant_timekeeping_watchdog();'
    );
  end if;
end;
$$;


-- 7. Redesigned Check-In RPC: check_in_time_entry
create or replace function public.check_in_time_entry(
  p_mode text,
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  business_time time without time zone := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::time;
  current_weekday smallint := pg_catalog.date_part('isodow', (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint;
  previous_weekday smallint;
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)), '');
  target_profile public.profiles%rowtype;
  target_assignment public.staff_shift_assignments%rowtype;
  center_config public.center_attendance_configs%rowtype;
  is_teaching_assistant boolean := false;
  computed_distance numeric;
  result_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if normalized_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('time-entry:' || actor_id::text));
  perform public.run_teaching_assistant_timekeeping_watchdog();

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = actor_id for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  if target_profile.employment_status <> 'active' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_REQUIRES_ACTIVE_STAFF';
  end if;

  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
      and role.code = 'teaching_assistant'
      and role.is_active
    where assignment.user_id = actor_id
      and assignment.revoked_at is null
  ) into is_teaching_assistant;

  if exists (
    select 1 from public.time_entries as entry
    where entry.staff_id = actor_id and entry.status = 'open'
  ) then
    raise exception using errcode = '23505', message = 'TIME_ENTRY_OPEN_ENTRY_ALREADY_EXISTS';
  end if;

  -- Teaching Assistant specific geofence and 23:30 cutoff checks
  if is_teaching_assistant then
    if business_time >= time '23:30' then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_TEACHING_ASSISTANT_CHECKIN_CUTOFF_REACHED';
    end if;

    select * into center_config
    from public.center_attendance_configs
    where is_active = true limit 1;

    if not found or center_config.center_latitude is null or center_config.center_longitude is null then
      raise exception using errcode = '22023', message = 'TIME_ENTRY_CENTER_CONFIG_NOT_FOUND';
    end if;

    if p_gps_latitude is null or p_gps_longitude is null then
      raise exception using errcode = '22023', message = 'TIME_ENTRY_GPS_REQUIRED_FOR_TEACHING_ASSISTANT';
    end if;

    if p_gps_accuracy_meters is null or p_gps_accuracy_meters < 0 or p_gps_accuracy_meters > 100 then
      raise exception using errcode = '22023', message = 'TIME_ENTRY_GPS_ACCURACY_TOO_LOW';
    end if;

    computed_distance := public.calculate_haversine_distance_m(
      center_config.center_latitude, center_config.center_longitude,
      p_gps_latitude, p_gps_longitude
    );

    if (computed_distance + p_gps_accuracy_meters) > (center_config.attendance_radius_m + 15) then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_OUTSIDE_GEOFENCE';
    end if;
  end if;

  -- Optional shift assignment lookup for current weekday
  previous_weekday := case when current_weekday = 1 then 7 else current_weekday - 1 end;

  select assignment.* into target_assignment
  from public.staff_shift_assignments as assignment
  join public.work_shifts as shift on shift.id = assignment.work_shift_id
  where assignment.staff_id = actor_id
    and assignment.is_active
    and shift.is_active
    and (
      assignment.weekday = current_weekday
      or (shift.crosses_midnight and assignment.weekday = previous_weekday and business_time < shift.end_time)
    )
  order by case when assignment.weekday = current_weekday then 0 else 1 end
  limit 1 for share of assignment;

  if not found and not is_teaching_assistant then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_ACTIVE_SCHEDULE_REQUIRED';
  end if;

  insert into public.time_entries (
    staff_id,
    staff_shift_assignment_id,
    work_date,
    check_in_at,
    check_in_mode,
    status,
    last_latitude,
    last_longitude,
    last_location_accuracy,
    last_location_at
  )
  values (
    actor_id,
    case when target_assignment.id is not null then target_assignment.id else null end,
    business_date,
    pg_catalog.now(),
    normalized_mode,
    'open',
    p_gps_latitude,
    p_gps_longitude,
    p_gps_accuracy_meters,
    case when p_gps_latitude is not null then pg_catalog.now() else null end
  )
  returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, gps_latitude, gps_longitude, gps_accuracy_meters
    )
    values (result_entry.id, 'check_in', 'gps', p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters);
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, wifi_ssid, wifi_bssid
    )
    values (result_entry.id, 'check_in', 'wifi', normalized_wifi_ssid, normalized_wifi_bssid);
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_in_time_entry(text, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.check_in_time_entry(text, numeric, numeric, integer, text, text) to authenticated;


-- 8. Redesigned Check-Out RPC: check_out_time_entry
create or replace function public.check_out_time_entry(
  p_mode text,
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  target_entry public.time_entries%rowtype;
  result_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  if normalized_mode not in ('online', 'offline') then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_MODE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('time-entry:' || actor_id::text));
  perform public.run_teaching_assistant_timekeeping_watchdog();

  select entry.* into target_entry
  from public.time_entries as entry
  where entry.staff_id = actor_id and entry.status = 'open' for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TIME_ENTRY_OPEN_ENTRY_NOT_FOUND';
  end if;

  update public.time_entries
  set
    check_out_at = pg_catalog.now(),
    check_out_mode = normalized_mode,
    status = 'checked_out',
    clock_out_reason = 'manual',
    updated_at = pg_catalog.now()
  where id = target_entry.id
  returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, gps_latitude, gps_longitude, gps_accuracy_meters
    )
    values (result_entry.id, 'check_out', 'gps', p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters);
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_out_time_entry(text, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.check_out_time_entry(text, numeric, numeric, integer, text, text) to authenticated;


-- 9. New Location Heartbeat RPC: submit_attendance_heartbeat
-- Strict 3-state geofence evaluation:
-- DEFINITELY_INSIDE: distance_m + accuracy_m <= radius_m + 15m -> Refreshes last_location_at
-- DEFINITELY_OUTSIDE: distance_m - accuracy_m > radius_m + 15m -> Auto-closes session immediately (left_geofence)
-- AMBIGUOUS: Everything else -> Session stays open, but does NOT refresh last_location_at!
create or replace function public.submit_attendance_heartbeat(
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_entry public.time_entries%rowtype;
  center_config public.center_attendance_configs%rowtype;
  is_teaching_assistant boolean := false;
  computed_distance numeric;
  upper_bound numeric;
  lower_bound numeric;
  tolerance_m numeric := 15;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('time-entry:' || actor_id::text));
  perform public.run_teaching_assistant_timekeeping_watchdog();

  select entry.* into target_entry
  from public.time_entries as entry
  where entry.staff_id = actor_id and entry.status = 'open' for update;

  if not found then
    return pg_catalog.jsonb_build_object('session_active', false, 'reason', 'no_active_session');
  end if;

  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
      and role.code = 'teaching_assistant'
      and role.is_active
    where assignment.user_id = actor_id
      and assignment.revoked_at is null
  ) into is_teaching_assistant;

  if not is_teaching_assistant then
    return pg_catalog.jsonb_build_object('session_active', true, 'is_teaching_assistant', false);
  end if;

  -- Accuracy validation
  if p_gps_latitude is null or p_gps_longitude is null or p_gps_accuracy_meters is null or p_gps_accuracy_meters < 0 or p_gps_accuracy_meters > 100 then
    return pg_catalog.jsonb_build_object('session_active', true, 'signal_degraded', true, 'message_vi', 'Dữ liệu vị trí chưa đủ độ chính xác (sai số > 100m).');
  end if;

  select * into center_config
  from public.center_attendance_configs
  where is_active = true limit 1;

  if not found or center_config.center_latitude is null or center_config.center_longitude is null then
    return pg_catalog.jsonb_build_object('session_active', true, 'signal_degraded', true, 'message_vi', 'Hệ thống chưa được cấu hình vị trí Trung tâm.');
  end if;

  computed_distance := public.calculate_haversine_distance_m(
    center_config.center_latitude, center_config.center_longitude,
    p_gps_latitude, p_gps_longitude
  );

  lower_bound := computed_distance - p_gps_accuracy_meters;
  upper_bound := computed_distance + p_gps_accuracy_meters;

  -- State 1: DEFINITELY_OUTSIDE -> Auto-end session immediately
  if lower_bound > (center_config.attendance_radius_m + tolerance_m) then
    update public.time_entries
    set
      status = 'auto_ended',
      check_out_at = pg_catalog.now(),
      check_out_mode = 'auto_end',
      clock_out_reason = 'left_geofence',
      auto_ended_at = pg_catalog.now(),
      last_latitude = p_gps_latitude,
      last_longitude = p_gps_longitude,
      last_location_accuracy = p_gps_accuracy_meters,
      last_location_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
    where id = target_entry.id;

    return pg_catalog.jsonb_build_object(
      'session_active', false,
      'closed_by_server', true,
      'reason', 'left_geofence',
      'message_vi', 'Bạn đã rời khỏi khu vực Trung tâm. Phiên chấm công đã được tự động kết thúc.'
    );

  -- State 2: DEFINITELY_INSIDE -> Position including uncertainty is strictly within radius + 15m
  elsif upper_bound <= (center_config.attendance_radius_m + tolerance_m) then
    update public.time_entries
    set
      last_latitude = p_gps_latitude,
      last_longitude = p_gps_longitude,
      last_location_accuracy = p_gps_accuracy_meters,
      last_location_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
    where id = target_entry.id;

    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'verified_inside', true,
      'distance_m', pg_catalog.round(computed_distance)
    );

  -- State 3: AMBIGUOUS -> Everything else. Do NOT update last_location_at!
  else
    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'verified_inside', false,
      'ambiguous_sample', true,
      'message_vi', 'Vị trí ở vùng ranh giới. Vui lòng di chuyển lại gần Trung tâm hơn để xác minh.'
    );
  end if;
end;
$$;

revoke all on function public.submit_attendance_heartbeat(numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.submit_attendance_heartbeat(numeric, numeric, integer) to authenticated;


-- 10. Update Read Model: get_my_timekeeping_entries
drop function if exists public.get_my_timekeeping_entries();
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
    entry.id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    entry.auto_ended_at,
    entry.clock_out_reason,
    entry.last_location_at,
    (entry.staff_shift_assignment_id is null),
    shift.start_time,
    shift.end_time,
    shift.code,
    shift.name,
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_in' and e.evidence_type = 'wifi'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'gps'),
    exists (select 1 from public.time_entry_evidence e where e.time_entry_id = entry.id and e.event_type = 'check_out' and e.evidence_type = 'wifi')
  from public.time_entries as entry
  left join public.staff_shift_assignments as assignment on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  where entry.staff_id = actor_id
  order by entry.work_date desc, entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_entries() from public, anon, authenticated;
grant execute on function public.get_my_timekeeping_entries() to authenticated;

commit;
