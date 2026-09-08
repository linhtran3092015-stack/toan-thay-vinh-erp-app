begin;

-- ============================================================================
-- Migration: 20260907040000_geofence_and_monthly_timekeeping.sql
-- Purpose:
-- 1. Enable location heartbeat geofence exit auto-termination for ALL roles
--    (removes teaching-assistant only restriction in submit_attendance_heartbeat).
-- 2. Update watchdog to also respect location loss for all offline sessions
--    when continuous GPS tracking is enabled in center config.
-- 3. Provide RPC get_my_monthly_timekeeping_entries(p_month, p_year) for
--    staff to view their days, hours, and attendance history per month.
-- 4. Provide RPC get_center_monthly_timekeeping_overview(p_month, p_year)
--    and get_staff_monthly_timekeeping_entries(p_staff_id, p_month, p_year)
--    for center owners/managers to view all staff timesheets by month.
-- 5. Provide RPC admin_adjust_time_entry(...) and admin_create_time_entry(...)
--    for center owners/managers to directly adjust timesheets and add missed days.
-- ============================================================================

-- 1. Update submit_attendance_heartbeat: open to ALL staff roles
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
  where entry.staff_id = actor_id and entry.status = 'open'
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('session_active', false, 'reason', 'no_active_session');
  end if;

  if target_entry.check_in_mode <> 'offline' then
    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'gps_verification_required', false
    );
  end if;

  select config.* into center_config
  from public.center_attendance_configs as config
  where config.is_active
  limit 1;

  if not found or center_config.center_latitude is null or center_config.center_longitude is null then
    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'signal_degraded', true,
      'message_vi', 'Hệ thống chưa được cấu hình vị trí Trung tâm.'
    );
  end if;

  if p_gps_latitude is null or p_gps_longitude is null
    or p_gps_accuracy_meters is null or p_gps_accuracy_meters < 0
    or p_gps_accuracy_meters > center_config.gps_max_accuracy_m
  then
    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'signal_degraded', true,
      'message_vi', 'Dữ liệu vị trí chưa đạt độ chính xác theo cấu hình Trung tâm.'
    );
  end if;

  computed_distance := public.calculate_haversine_distance_m(
    center_config.center_latitude,
    center_config.center_longitude,
    p_gps_latitude,
    p_gps_longitude
  );
  lower_bound := computed_distance - p_gps_accuracy_meters;
  upper_bound := computed_distance + p_gps_accuracy_meters;

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
  end if;

  return pg_catalog.jsonb_build_object(
    'session_active', true,
    'verified_inside', false,
    'ambiguous_sample', true,
    'message_vi', 'Vị trí ở vùng ranh giới. Vui lòng di chuyển lại gần Trung tâm hơn để xác minh.'
  );
end;
$$;

revoke all on function public.submit_attendance_heartbeat(numeric, numeric, integer) from public, anon;
grant execute on function public.submit_attendance_heartbeat(numeric, numeric, integer) to authenticated;


-- 2. Enhanced Watchdog: auto-end location lost for all offline sessions when continuous tracking is required
create or replace function public.run_teaching_assistant_timekeeping_watchdog()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  business_date date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  business_time time without time zone := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::time;
  center_continuous_tracking boolean := false;
  entry_record record;
  location_loss_ts timestamptz;
  daily_cutoff_ts timestamptz;
  effective_end_ts timestamptz;
  effective_reason text;
  closed_count integer := 0;
begin
  select coalesce(config.continuous_gps_tracking_required, false)
  into center_continuous_tracking
  from public.center_attendance_configs as config
  where config.is_active
  limit 1;

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

    -- Case 1: Location loss when tracking required (for TA or any staff when continuous tracking is on)
    if entry_record.check_in_mode = 'offline'
      and (entry_record.is_teaching_assistant or center_continuous_tracking)
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


-- 3. Read Model: get_my_monthly_timekeeping_entries
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
  from public.time_entries as entry
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

revoke all on function public.get_my_monthly_timekeeping_entries(integer, integer) from public, anon;
grant execute on function public.get_my_monthly_timekeeping_entries(integer, integer) to authenticated;


-- 4. Read Model: get_center_monthly_timekeeping_overview
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
    from public.time_entries as entry
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

revoke all on function public.get_center_monthly_timekeeping_overview(integer, integer) from public, anon;
grant execute on function public.get_center_monthly_timekeeping_overview(integer, integer) to authenticated;


-- 5. Read Model: get_staff_monthly_timekeeping_entries
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
  from public.time_entries as entry
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

revoke all on function public.get_staff_monthly_timekeeping_entries(uuid, integer, integer) from public, anon;
grant execute on function public.get_staff_monthly_timekeeping_entries(uuid, integer, integer) to authenticated;


-- 6. Direct Management Mutation: admin_adjust_time_entry
create or replace function public.admin_adjust_time_entry(
  p_time_entry_id uuid,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_reason text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_entry public.time_entries%rowtype;
  result_entry public.time_entries%rowtype;
  normalized_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') and not public.has_permission('staff.manage') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_time_entry_id is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ID_REQUIRED';
  end if;

  if p_check_in_at is null or p_check_out_at is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED';
  end if;

  if p_check_out_at < p_check_in_at then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_ADJUSTMENT_REASON_REQUIRED';
  end if;

  select entry.* into target_entry
  from public.time_entries as entry
  where entry.id = p_time_entry_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TIME_ENTRY_NOT_FOUND';
  end if;

  -- Update time entry to checked_out with new timestamps
  update public.time_entries
  set
    check_in_at = p_check_in_at,
    check_out_at = p_check_out_at,
    status = 'checked_out',
    check_out_mode = coalesce(check_out_mode, 'offline'),
    clock_out_reason = 'manual',
    auto_ended_at = null,
    updated_at = pg_catalog.now()
  where id = target_entry.id
  returning * into result_entry;

  -- Upsert approved adjustment record to ensure payroll and audit engines stay in sync
  insert into public.time_entry_adjustment_requests (
    time_entry_id,
    requester_id,
    original_check_in_at,
    original_check_out_at,
    requested_check_in_at,
    requested_check_out_at,
    reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    target_entry.id,
    target_entry.staff_id,
    target_entry.check_in_at,
    coalesce(target_entry.check_out_at, target_entry.check_in_at),
    p_check_in_at,
    p_check_out_at,
    normalized_reason,
    'approved',
    actor_id,
    pg_catalog.now(),
    'Chủ trung tâm điều chỉnh trực tiếp: ' || normalized_reason
  );

  return result_entry;
end;
$$;

revoke all on function public.admin_adjust_time_entry(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_adjust_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;


-- 7. Direct Management Mutation: admin_create_time_entry (Add Missed Attendance)
create or replace function public.admin_create_time_entry(
  p_staff_id uuid,
  p_work_date date,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_mode text,
  p_notes text
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  normalized_mode text := coalesce(nullif(pg_catalog.lower(pg_catalog.btrim(p_mode)), ''), 'offline');
  normalized_notes text := nullif(pg_catalog.btrim(p_notes), '');
  new_entry public.time_entries%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.approve_adjustment') and not public.has_permission('staff.manage') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_APPROVE_ADJUSTMENT_PERMISSION_REQUIRED';
  end if;

  if p_staff_id is null then
    raise exception using errcode = '22023', message = 'STAFF_ID_REQUIRED';
  end if;

  if p_work_date is null then
    raise exception using errcode = '22023', message = 'WORK_DATE_REQUIRED';
  end if;

  if p_check_in_at is null or p_check_out_at is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_CHECK_IN_AND_OUT_REQUIRED';
  end if;

  if p_check_out_at < p_check_in_at then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_CHECK_OUT_MUST_BE_AFTER_CHECK_IN';
  end if;

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = p_staff_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'STAFF_PROFILE_NOT_FOUND';
  end if;

  insert into public.time_entries (
    staff_id,
    staff_shift_assignment_id,
    work_date,
    check_in_at,
    check_in_mode,
    check_out_at,
    check_out_mode,
    status,
    clock_out_reason
  ) values (
    p_staff_id,
    null,
    p_work_date,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
    'checked_out',
    'manual'
  ) returning * into new_entry;

  insert into public.time_entry_adjustment_requests (
    time_entry_id,
    requester_id,
    original_check_in_at,
    original_check_out_at,
    requested_check_in_at,
    requested_check_out_at,
    reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    new_entry.id,
    p_staff_id,
    p_check_in_at,
    p_check_out_at,
    p_check_in_at,
    p_check_out_at,
    coalesce(normalized_notes, 'Chủ trung tâm bổ sung công bù'),
    'approved',
    actor_id,
    pg_catalog.now(),
    'Chủ trung tâm tạo mới công bù'
  );

  return new_entry;
end;
$$;

revoke all on function public.admin_create_time_entry(uuid, date, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_create_time_entry(uuid, date, timestamptz, timestamptz, text, text) to authenticated;

commit;
