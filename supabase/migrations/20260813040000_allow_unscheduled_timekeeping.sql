begin;

-- An effective shift is useful context, but is not a prerequisite for attendance.
-- The RPC continues to derive the actor exclusively from auth.uid() and applies
-- all role-specific controls before recording an entry.
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

  previous_weekday := case when current_weekday = 1 then 7 else current_weekday - 1 end;

  select assignment.* into target_assignment
  from public.staff_shift_assignments as assignment
  join public.work_shifts as shift on shift.id = assignment.work_shift_id
  where assignment.staff_id = actor_id
    and assignment.is_active
    and shift.is_active
    and assignment.effective_from <= business_date
    and (assignment.effective_to is null or assignment.effective_to >= business_date)
    and (
      assignment.weekday = current_weekday
      or (shift.crosses_midnight and assignment.weekday = previous_weekday and business_time < shift.end_time)
    )
  order by case when assignment.weekday = current_weekday then 0 else 1 end
  limit 1 for share of assignment;

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
    target_assignment.id,
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

revoke all on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
from public, anon;

grant execute on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
to authenticated;

-- An unscheduled entry has no assignment or shift metadata, but must remain
-- visible to staff with the existing day-audit permission.
create or replace function public.get_timekeeping_day_entries()
returns table (
  entry_id uuid,
  staff_id uuid,
  staff_display_name text,
  staff_employee_code text,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  auto_ended_at timestamptz,
  work_shift_code text,
  work_shift_name text,
  scheduled_start_time time without time zone,
  scheduled_end_time time without time zone,
  has_check_in_gps_evidence boolean,
  has_check_in_wifi_evidence boolean,
  has_check_out_gps_evidence boolean,
  has_check_out_wifi_evidence boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.view') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  perform public.auto_end_stale_teaching_assistant_time_entries();

  return query
  select
    entry.id,
    profile.id,
    profile.display_name,
    profile.employee_code,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    entry.auto_ended_at,
    shift.code,
    shift.name,
    shift.start_time,
    shift.end_time,
    exists (
      select 1 from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1 from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_in'
        and evidence.evidence_type = 'wifi'
    ),
    exists (
      select 1 from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'gps'
    ),
    exists (
      select 1 from public.time_entry_evidence as evidence
      where evidence.time_entry_id = entry.id
        and evidence.event_type = 'check_out'
        and evidence.evidence_type = 'wifi'
    )
  from public.time_entries as entry
  join public.profiles as profile on profile.id = entry.staff_id
  left join public.staff_shift_assignments as assignment
    on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  where entry.work_date = (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date
  order by entry.check_in_at desc, profile.display_name nulls last;
end;
$$;

revoke all on function public.get_timekeeping_day_entries()
from public, anon, authenticated;

grant execute on function public.get_timekeeping_day_entries()
to authenticated;

-- Closed unscheduled entries are eligible for adjustment and use the same-day
-- adjustment semantics already defined for a missing shift.
create or replace function public.get_my_timekeeping_adjustable_entries()
returns table (
  time_entry_id uuid,
  work_date date,
  check_in_at timestamptz,
  check_in_mode text,
  check_out_at timestamptz,
  check_out_mode text,
  entry_status text,
  work_shift_code text,
  work_shift_name text,
  adjustment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_CHECK_PERMISSION_REQUIRED';
  end if;

  return query
  select
    entry.id,
    entry.work_date,
    entry.check_in_at,
    entry.check_in_mode,
    entry.check_out_at,
    entry.check_out_mode,
    entry.status,
    shift.code,
    shift.name,
    latest_request.status
  from public.time_entries as entry
  left join public.staff_shift_assignments as assignment
    on assignment.id = entry.staff_shift_assignment_id
  left join public.work_shifts as shift on shift.id = assignment.work_shift_id
  left join lateral (
    select request.status
    from public.time_entry_adjustment_requests as request
    where request.time_entry_id = entry.id
    order by
      case request.status
        when 'pending' then 0
        when 'approved' then 1
        else 2
      end,
      request.created_at desc
    limit 1
  ) as latest_request on true
  where entry.staff_id = auth.uid()
    and entry.status in ('checked_out', 'auto_ended')
  order by entry.work_date desc, entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_adjustable_entries()
from public, anon, authenticated;

grant execute on function public.get_my_timekeeping_adjustable_entries()
to authenticated;

commit;
