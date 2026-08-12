-- Migration: 20260813030000_fix_teaching_assistant_role_detection.sql
-- Description: Resilient Teaching Assistant role detection matching canonical codes ('teaching_assistant', 'tro_giang', 'ta', 'assistant') and Vietnamese role name ('Trợ giảng').

-- 1. Helper function for resilient Teaching Assistant role detection
create or replace function public.is_user_teaching_assistant(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
      and (
        role.code = 'teaching_assistant'
        or pg_catalog.lower(role.code) in ('teaching_assistant', 'tro_giang', 'ta', 'assistant')
        or pg_catalog.lower(role.code) like '%teaching_assistant%'
        or pg_catalog.lower(role.code) like '%tro_giang%'
        or pg_catalog.lower(role.name) like '%trợ giảng%'
        or pg_catalog.lower(role.name) like '%teaching assistant%'
      )
    where assignment.user_id = p_user_id
      and assignment.revoked_at is null
  );
$$;

grant execute on function public.is_user_teaching_assistant(uuid) to authenticated, service_role;

-- 2. Update run_teaching_assistant_timekeeping_watchdog using helper
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
      and public.is_user_teaching_assistant(entry.staff_id)
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

-- 3. Update check_in_time_entry using helper
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

  is_teaching_assistant := public.is_user_teaching_assistant(actor_id);

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

grant execute on function public.check_in_time_entry(text, numeric, numeric, integer, text, text) to authenticated;

-- 4. Update get_my_timekeeping_status using helper
create or replace function public.get_my_timekeeping_status()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  is_teaching_assistant boolean := false;
  open_entry record;
  center_config record;
  distance_m numeric := null;
  status_label text := 'Offline';
  server_message text := null;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('session_active', false, 'error', 'AUTHENTICATED_USER_REQUIRED');
  end if;

  perform public.run_teaching_assistant_timekeeping_watchdog();

  select id, check_in_at, last_latitude, last_longitude, last_location_accuracy, last_location_at
  into open_entry
  from public.time_entries
  where staff_id = actor_id and status = 'open'
  limit 1;

  if open_entry.id is null then
    return pg_catalog.jsonb_build_object('session_active', false);
  end if;

  is_teaching_assistant := public.is_user_teaching_assistant(actor_id);

  if not is_teaching_assistant then
    return pg_catalog.jsonb_build_object('session_active', true, 'is_teaching_assistant', false);
  end if;

  select center_latitude, center_longitude, attendance_radius_m
  into center_config
  from public.center_attendance_configs
  where is_active = true limit 1;

  if center_config.center_latitude is not null and open_entry.last_latitude is not null then
    distance_m := pg_catalog.round(
      public.calculate_haversine_distance_m(
        center_config.center_latitude, center_config.center_longitude,
        open_entry.last_latitude, open_entry.last_longitude
      )
    );

    if (distance_m + pg_catalog.coalesce(open_entry.last_location_accuracy, 0)) <= (center_config.attendance_radius_m + 15) then
      status_label := 'Đang ở Trung tâm';
    else
      status_label := 'Ngoài vị trí cho phép';
    end if;
  else
    status_label := 'Đang cập nhật vị trí';
  end if;

  if open_entry.last_location_at is null then
    server_message := 'Chưa nhận được tín hiệu vị trí GPS.';
  elsif (pg_catalog.now() - open_entry.last_location_at) > interval '45 seconds' then
    server_message := 'Tín hiệu GPS yếu hoặc chưa cập nhật trong 45 giây qua.';
  end if;

  return pg_catalog.jsonb_build_object(
    'session_active', true,
    'is_teaching_assistant', true,
    'time_entry_id', open_entry.id,
    'distance_m', distance_m,
    'status_label', status_label,
    'server_message', server_message
  );
end;
$$;

grant execute on function public.get_my_timekeeping_status() to authenticated;
