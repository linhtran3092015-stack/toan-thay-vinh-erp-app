begin;

-- Owner-managed attendance verification policy.
-- GPS is the primary proof for on-site attendance. Wi-Fi is an optional,
-- additional allowlist check because browsers cannot discover SSID/BSSID.

insert into public.permissions (code, module, name, description)
values (
  'timekeeping.manage_verification',
  'timekeeping',
  'Cấu hình xác minh chấm công',
  'Thiết lập vị trí Trung tâm, bán kính GPS và danh sách Wi-Fi được phép.'
)
on conflict (code) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission
  on permission.code = 'timekeeping.manage_verification'
where role.code = 'owner'
on conflict (role_id, permission_id) do nothing;

alter table public.center_attendance_configs
  add column if not exists gps_max_accuracy_m integer not null default 100,
  add column if not exists wifi_verification_enabled boolean not null default false,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'center_attendance_configs_gps_accuracy_range'
  ) then
    alter table public.center_attendance_configs
      add constraint center_attendance_configs_gps_accuracy_range
      check (gps_max_accuracy_m between 20 and 200);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'center_attendance_configs_radius_range'
  ) then
    alter table public.center_attendance_configs
      add constraint center_attendance_configs_radius_range
      check (attendance_radius_m between 20 and 2000) not valid;
  end if;
end;
$$;

create table if not exists public.center_attendance_wifi_networks (
  id uuid primary key default gen_random_uuid(),
  center_config_id uuid not null references public.center_attendance_configs(id) on delete cascade,
  ssid text not null constraint center_wifi_ssid_length check (char_length(ssid) between 1 and 128),
  bssid text not null constraint center_wifi_bssid_format check (bssid ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create unique index if not exists center_attendance_wifi_networks_identity_idx
on public.center_attendance_wifi_networks (
  center_config_id,
  pg_catalog.lower(ssid),
  pg_catalog.upper(bssid)
);

alter table public.center_attendance_wifi_networks enable row level security;
revoke all on public.center_attendance_wifi_networks from public, anon, authenticated;
grant select, insert, update, delete on public.center_attendance_wifi_networks to service_role;

create or replace function public.get_attendance_verification_policy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config_record public.center_attendance_configs%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.check')
    and not public.has_permission('timekeeping.view')
    and not public.has_permission('timekeeping.manage_verification')
  then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VIEW_PERMISSION_REQUIRED';
  end if;

  select config.* into config_record
  from public.center_attendance_configs as config
  where config.is_active
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object(
      'configured', false,
      'continuous_gps_tracking_required', public.is_user_teaching_assistant(auth.uid()),
      'gps_required_for_offline', true,
      'wifi_required_for_offline', false
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'configured', config_record.center_latitude is not null and config_record.center_longitude is not null,
    'continuous_gps_tracking_required', public.is_user_teaching_assistant(auth.uid()),
    'center_name', config_record.name,
    'attendance_radius_m', config_record.attendance_radius_m,
    'gps_max_accuracy_m', config_record.gps_max_accuracy_m,
    'gps_required_for_offline', true,
    'wifi_required_for_offline', config_record.wifi_verification_enabled
  );
end;
$$;

revoke all on function public.get_attendance_verification_policy() from public, anon;
grant execute on function public.get_attendance_verification_policy() to authenticated;

create or replace function public.get_attendance_verification_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config_record public.center_attendance_configs%rowtype;
  network_rows jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.manage_verification') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VERIFICATION_MANAGE_PERMISSION_REQUIRED';
  end if;

  select config.* into config_record
  from public.center_attendance_configs as config
  order by config.is_active desc, config.updated_at desc
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object(
      'configured', false,
      'center_name', 'Trung tâm Toán Thầy Vinh',
      'center_latitude', null,
      'center_longitude', null,
      'attendance_radius_m', 100,
      'gps_max_accuracy_m', 100,
      'wifi_required_for_offline', false,
      'wifi_networks', '[]'::jsonb
    );
  end if;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', network.id,
        'ssid', network.ssid,
        'bssid', network.bssid
      ) order by network.ssid, network.bssid
    ),
    '[]'::jsonb
  ) into network_rows
  from public.center_attendance_wifi_networks as network
  where network.center_config_id = config_record.id
    and network.is_active;

  return pg_catalog.jsonb_build_object(
    'configured', config_record.is_active
      and config_record.center_latitude is not null
      and config_record.center_longitude is not null,
    'center_name', config_record.name,
    'center_latitude', config_record.center_latitude,
    'center_longitude', config_record.center_longitude,
    'attendance_radius_m', config_record.attendance_radius_m,
    'gps_max_accuracy_m', config_record.gps_max_accuracy_m,
    'wifi_required_for_offline', config_record.wifi_verification_enabled,
    'wifi_networks', network_rows,
    'updated_at', config_record.updated_at
  );
end;
$$;

revoke all on function public.get_attendance_verification_config() from public, anon;
grant execute on function public.get_attendance_verification_config() to authenticated;

create or replace function public.set_attendance_verification_config(
  p_center_name text,
  p_center_latitude numeric,
  p_center_longitude numeric,
  p_attendance_radius_m integer,
  p_gps_max_accuracy_m integer,
  p_wifi_required_for_offline boolean,
  p_wifi_networks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_name text := pg_catalog.btrim(p_center_name);
  normalized_networks jsonb := pg_catalog.coalesce(p_wifi_networks, '[]'::jsonb);
  target_config_id uuid;
  old_config jsonb;
  network_item jsonb;
  normalized_ssid text;
  normalized_bssid text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.manage_verification') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_VERIFICATION_MANAGE_PERMISSION_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or pg_catalog.char_length(normalized_name) > 160 then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_CENTER_NAME_INVALID';
  end if;

  if p_center_latitude is null or p_center_latitude not between -90 and 90
    or p_center_longitude is null or p_center_longitude not between -180 and 180
  then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_CENTER_COORDINATES_INVALID';
  end if;

  if p_attendance_radius_m is null or p_attendance_radius_m not between 20 and 2000 then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_CENTER_RADIUS_INVALID';
  end if;

  if p_gps_max_accuracy_m is null or p_gps_max_accuracy_m not between 20 and 200 then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_GPS_ACCURACY_POLICY_INVALID';
  end if;

  if pg_catalog.jsonb_typeof(normalized_networks) <> 'array' then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_WIFI_NETWORKS_INVALID';
  end if;

  if pg_catalog.jsonb_array_length(normalized_networks) > 20 then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_WIFI_NETWORK_LIMIT_EXCEEDED';
  end if;

  if p_wifi_required_for_offline and pg_catalog.jsonb_array_length(normalized_networks) = 0 then
    raise exception using errcode = '22023', message = 'TIMEKEEPING_WIFI_NETWORK_REQUIRED';
  end if;

  for network_item in select value from pg_catalog.jsonb_array_elements(normalized_networks)
  loop
    normalized_ssid := nullif(pg_catalog.btrim(network_item ->> 'ssid'), '');
    normalized_bssid := nullif(pg_catalog.upper(pg_catalog.btrim(network_item ->> 'bssid')), '');

    if normalized_ssid is null or pg_catalog.char_length(normalized_ssid) > 128
      or normalized_bssid is null
      or normalized_bssid !~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'
    then
      raise exception using errcode = '22023', message = 'TIMEKEEPING_WIFI_NETWORKS_INVALID';
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('attendance-verification-config'));

  select pg_catalog.to_jsonb(config), config.id
  into old_config, target_config_id
  from public.center_attendance_configs as config
  where config.is_active
  limit 1
  for update;

  if target_config_id is null then
    select config.id into target_config_id
    from public.center_attendance_configs as config
    where config.code = 'MAIN_CENTER'
    limit 1
    for update;
  end if;

  update public.center_attendance_configs
  set is_active = false, updated_at = pg_catalog.now(), updated_by = actor_id
  where is_active and id is distinct from target_config_id;

  if target_config_id is null then
    insert into public.center_attendance_configs (
      code, name, center_latitude, center_longitude, attendance_radius_m,
      gps_max_accuracy_m, wifi_verification_enabled, is_active, created_by, updated_by
    ) values (
      'MAIN_CENTER', normalized_name, p_center_latitude, p_center_longitude,
      p_attendance_radius_m, p_gps_max_accuracy_m,
      pg_catalog.coalesce(p_wifi_required_for_offline, false), true, actor_id, actor_id
    ) returning id into target_config_id;
  else
    update public.center_attendance_configs
    set
      name = normalized_name,
      center_latitude = p_center_latitude,
      center_longitude = p_center_longitude,
      attendance_radius_m = p_attendance_radius_m,
      gps_max_accuracy_m = p_gps_max_accuracy_m,
      wifi_verification_enabled = pg_catalog.coalesce(p_wifi_required_for_offline, false),
      is_active = true,
      updated_at = pg_catalog.now(),
      updated_by = actor_id
    where id = target_config_id;
  end if;

  delete from public.center_attendance_wifi_networks
  where center_config_id = target_config_id;

  for network_item in select value from pg_catalog.jsonb_array_elements(normalized_networks)
  loop
    normalized_ssid := pg_catalog.btrim(network_item ->> 'ssid');
    normalized_bssid := pg_catalog.upper(pg_catalog.btrim(network_item ->> 'bssid'));

    insert into public.center_attendance_wifi_networks (
      center_config_id, ssid, bssid, created_by
    ) values (
      target_config_id, normalized_ssid, normalized_bssid, actor_id
    );
  end loop;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id,
    old_data, new_data, reason, metadata
  )
  select
    actor_id,
    'timekeeping',
    'attendance_verification_config_updated',
    'center_attendance_config',
    target_config_id::text,
    old_config,
    pg_catalog.jsonb_build_object(
      'center_name', normalized_name,
      'center_latitude', p_center_latitude,
      'center_longitude', p_center_longitude,
      'attendance_radius_m', p_attendance_radius_m,
      'gps_max_accuracy_m', p_gps_max_accuracy_m,
      'wifi_required_for_offline', pg_catalog.coalesce(p_wifi_required_for_offline, false),
      'wifi_network_count', pg_catalog.jsonb_array_length(normalized_networks)
    ),
    'Chủ trung tâm cập nhật điều kiện xác minh chấm công trên giao diện.',
    pg_catalog.jsonb_build_object('source', 'timekeeping_ui');

  return public.get_attendance_verification_config();
end;
$$;

revoke all on function public.set_attendance_verification_config(text, numeric, numeric, integer, integer, boolean, jsonb)
from public, anon;
grant execute on function public.set_attendance_verification_config(text, numeric, numeric, integer, integer, boolean, jsonb)
to authenticated;

create or replace function public.validate_offline_attendance_evidence(
  p_gps_latitude numeric,
  p_gps_longitude numeric,
  p_gps_accuracy_meters integer,
  p_wifi_ssid text,
  p_wifi_bssid text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_record public.center_attendance_configs%rowtype;
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)), '');
  computed_distance numeric;
begin
  select config.* into config_record
  from public.center_attendance_configs as config
  where config.is_active
  limit 1;

  -- Keep rollout backward-compatible: verification becomes enforceable only
  -- after the owner explicitly activates a complete center configuration.
  if not found then
    return null;
  end if;

  if config_record.center_latitude is null or config_record.center_longitude is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_CENTER_CONFIG_NOT_FOUND';
  end if;

  if p_gps_latitude is null or p_gps_longitude is null then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_GPS_REQUIRED_FOR_OFFLINE';
  end if;

  if p_gps_latitude not between -90 and 90 or p_gps_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_GPS_EVIDENCE_INVALID';
  end if;

  if p_gps_accuracy_meters is null or p_gps_accuracy_meters < 0
    or p_gps_accuracy_meters > config_record.gps_max_accuracy_m
  then
    raise exception using errcode = '22023', message = 'TIME_ENTRY_GPS_ACCURACY_TOO_LOW';
  end if;

  computed_distance := public.calculate_haversine_distance_m(
    config_record.center_latitude,
    config_record.center_longitude,
    p_gps_latitude,
    p_gps_longitude
  );

  if (computed_distance + p_gps_accuracy_meters) > (config_record.attendance_radius_m + 15) then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_OUTSIDE_GEOFENCE';
  end if;

  if config_record.wifi_verification_enabled then
    if normalized_wifi_ssid is null or normalized_wifi_bssid is null then
      raise exception using errcode = '22023', message = 'TIME_ENTRY_WIFI_REQUIRED_FOR_OFFLINE';
    end if;

    if not exists (
      select 1
      from public.center_attendance_wifi_networks as network
      where network.center_config_id = config_record.id
        and network.is_active
        and pg_catalog.lower(network.ssid) = pg_catalog.lower(normalized_wifi_ssid)
        and pg_catalog.upper(network.bssid) = normalized_wifi_bssid
    ) then
      raise exception using errcode = '23514', message = 'TIME_ENTRY_WIFI_NOT_ALLOWED';
    end if;
  end if;

  return computed_distance;
end;
$$;

revoke all on function public.validate_offline_attendance_evidence(numeric, numeric, integer, text, text)
from public, anon, authenticated;

-- Online teaching-assistant sessions do not participate in the on-site GPS
-- watchdog. This keeps the selected attendance mode consistent end to end.
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
      and entry.check_in_mode = 'offline'
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

    if pg_catalog.now() >= location_loss_ts
      or entry_record.work_date < business_date
      or (entry_record.work_date = business_date and business_time >= time '23:30')
    then
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

  if not public.is_user_teaching_assistant(actor_id) then
    return pg_catalog.jsonb_build_object(
      'session_active', true,
      'is_teaching_assistant', false
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

revoke all on function public.submit_attendance_heartbeat(numeric, numeric, integer)
from public, anon;
grant execute on function public.submit_attendance_heartbeat(numeric, numeric, integer)
to authenticated;

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
  current_weekday smallint := pg_catalog.date_part('isodow', business_date)::smallint;
  previous_weekday smallint;
  normalized_mode text := pg_catalog.lower(pg_catalog.btrim(p_mode));
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)), '');
  target_profile public.profiles%rowtype;
  target_assignment public.staff_shift_assignments%rowtype;
  is_teaching_assistant boolean := false;
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

  if is_teaching_assistant and business_time >= time '23:30' then
    raise exception using errcode = '23514', message = 'TIME_ENTRY_TEACHING_ASSISTANT_CHECKIN_CUTOFF_REACHED';
  end if;

  if normalized_mode = 'offline' then
    perform public.validate_offline_attendance_evidence(
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters,
      normalized_wifi_ssid, normalized_wifi_bssid
    );
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
    staff_id, staff_shift_assignment_id, work_date, check_in_at,
    check_in_mode, status, last_latitude, last_longitude,
    last_location_accuracy, last_location_at
  ) values (
    actor_id, target_assignment.id, business_date, pg_catalog.now(),
    normalized_mode, 'open', p_gps_latitude, p_gps_longitude,
    p_gps_accuracy_meters,
    case when normalized_mode = 'offline' and p_gps_latitude is not null then pg_catalog.now() else null end
  ) returning * into result_entry;

  if p_gps_latitude is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type,
      gps_latitude, gps_longitude, gps_accuracy_meters
    ) values (
      result_entry.id, 'check_in', 'gps',
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters
    );
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, wifi_ssid, wifi_bssid
    ) values (
      result_entry.id, 'check_in', 'wifi', normalized_wifi_ssid, normalized_wifi_bssid
    );
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
from public, anon;
grant execute on function public.check_in_time_entry(text, numeric, numeric, integer, text, text)
to authenticated;

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
  normalized_wifi_ssid text := nullif(pg_catalog.btrim(p_wifi_ssid), '');
  normalized_wifi_bssid text := nullif(pg_catalog.upper(pg_catalog.btrim(p_wifi_bssid)), '');
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
  where entry.staff_id = actor_id and entry.status = 'open'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TIME_ENTRY_OPEN_ENTRY_NOT_FOUND';
  end if;

  if normalized_mode = 'offline' then
    perform public.validate_offline_attendance_evidence(
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters,
      normalized_wifi_ssid, normalized_wifi_bssid
    );
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
      time_entry_id, event_type, evidence_type,
      gps_latitude, gps_longitude, gps_accuracy_meters
    ) values (
      result_entry.id, 'check_out', 'gps',
      p_gps_latitude, p_gps_longitude, p_gps_accuracy_meters
    );
  end if;

  if normalized_wifi_ssid is not null then
    insert into public.time_entry_evidence (
      time_entry_id, event_type, evidence_type, wifi_ssid, wifi_bssid
    ) values (
      result_entry.id, 'check_out', 'wifi', normalized_wifi_ssid, normalized_wifi_bssid
    );
  end if;

  return result_entry;
end;
$$;

revoke all on function public.check_out_time_entry(text, numeric, numeric, integer, text, text)
from public, anon;
grant execute on function public.check_out_time_entry(text, numeric, numeric, integer, text, text)
to authenticated;

-- Keep the personal panel strictly scoped to the current Vietnam business day.
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
    and entry.work_date = business_date
  order by entry.check_in_at desc;
end;
$$;

revoke all on function public.get_my_timekeeping_entries() from public, anon;
grant execute on function public.get_my_timekeeping_entries() to authenticated;

commit;
