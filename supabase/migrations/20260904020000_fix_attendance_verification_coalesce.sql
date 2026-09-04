begin;

-- COALESCE is SQL syntax, not a pg_catalog function. Recreate the affected
-- routines without schema-qualifying it so they execute correctly at runtime.
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

  select coalesce(
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
  normalized_networks jsonb := coalesce(p_wifi_networks, '[]'::jsonb);
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
      coalesce(p_wifi_required_for_offline, false), true, actor_id, actor_id
    ) returning id into target_config_id;
  else
    update public.center_attendance_configs
    set
      name = normalized_name,
      center_latitude = p_center_latitude,
      center_longitude = p_center_longitude,
      attendance_radius_m = p_attendance_radius_m,
      gps_max_accuracy_m = p_gps_max_accuracy_m,
      wifi_verification_enabled = coalesce(p_wifi_required_for_offline, false),
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
      'wifi_required_for_offline', coalesce(p_wifi_required_for_offline, false),
      'wifi_network_count', pg_catalog.jsonb_array_length(normalized_networks)
    ),
    'Chủ trung tâm cập nhật điều kiện xác minh chấm công trên giao diện.',
    pg_catalog.jsonb_build_object('source', 'timekeeping_ui');

  return public.get_attendance_verification_config();
end;
$$;

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
    location_loss_ts := coalesce(entry_record.last_location_at, entry_record.check_in_at) + interval '90 seconds';
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

commit;
