begin;

-- ============================================================================
-- Migration: 20260908070000_fix_timekeeping_watchdog_and_admin_adjustments.sql
-- Purpose:
-- 1. Fix watchdog: remove non-existent column config.continuous_gps_tracking_required
--    and apply 90s location loss auto-end to all offline staff roles.
-- 2. Update get_attendance_verification_policy: continuous_gps_tracking_required = true
--    for all roles when checking in offline.
-- 3. Update protect_time_entry_history trigger: allow managers/owners to adjust
--    time entries without triggering CLOSED_TIME_ENTRY_IS_IMMUTABLE.
-- 4. Update audit_time_entry_change trigger: support 'time_entry_adjusted' action.
-- 5. Fix admin_adjust_time_entry and admin_create_time_entry: correct check_out_mode
--    for lifecycle constraint and align columns with time_entry_adjustment_requests.
-- ============================================================================

-- 1. Fix watchdog function
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
      entry.last_location_at
    from public.time_entries as entry
    where entry.status = 'open'
  loop
    location_loss_ts := coalesce(entry_record.last_location_at, entry_record.check_in_at) + interval '90 seconds';
    daily_cutoff_ts := (entry_record.work_date::timestamp + time '23:30') at time zone 'Asia/Ho_Chi_Minh';

    -- Case 1: Location loss for any offline staff session (90s without heartbeat before cutoff)
    if entry_record.check_in_mode = 'offline'
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


-- 2. Update get_attendance_verification_policy: continuous_gps_tracking_required = true for all roles
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
      'continuous_gps_tracking_required', true,
      'gps_required_for_offline', true,
      'wifi_required_for_offline', false
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'configured', config_record.center_latitude is not null and config_record.center_longitude is not null,
    'continuous_gps_tracking_required', true,
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


-- 3. Update History Protection Trigger for time_entries
create or replace function public.protect_time_entry_history()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Allow owners/managers to adjust or approve adjustments
  if public.has_permission('timekeeping.manage') or public.has_permission('timekeeping.approve_adjustment') then
    return new;
  end if;

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

revoke all on function public.protect_time_entry_history() from public, anon, authenticated;


-- 4. Update Audit Trigger for time_entries
create or replace function public.audit_time_entry_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  audit_action text;
begin
  if tg_op = 'INSERT' then
    actor_id := coalesce(auth.uid(), new.staff_id);
    audit_action := 'time_entry_checked_in';
  elsif new.status = 'auto_ended' and old.status = 'open' then
    actor_id := null;
    audit_action := 'time_entry_auto_ended';
  elsif old.status = 'open' and new.status = 'checked_out' then
    actor_id := new.staff_id;
    audit_action := 'time_entry_checked_out';
  elsif old.status in ('checked_out', 'auto_ended') and new.status in ('checked_out', 'auto_ended') then
    actor_id := auth.uid();
    audit_action := 'time_entry_adjusted';
  else
    actor_id := auth.uid();
    audit_action := 'time_entry_updated';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    actor_id,
    'timekeeping',
    audit_action,
    'time_entry',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object(
      'source',
      case
        when new.status = 'auto_ended' then 'timekeeping_auto_end'
        else 'timekeeping_entry_workflow'
      end
    )
  );

  return new;
end;
$$;

revoke all on function public.audit_time_entry_change() from public, anon, authenticated;


-- 5. Fix admin_adjust_time_entry
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
  effective_checkout_mode text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('timekeeping.manage') and not public.has_permission('timekeeping.approve_adjustment') then
    raise exception using errcode = '42501', message = 'TIMEKEEPING_MANAGE_PERMISSION_REQUIRED';
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

  effective_checkout_mode := case when target_entry.check_in_mode = 'online' then 'online' else 'offline' end;

  -- Update time entry to checked_out with new timestamps
  update public.time_entries
  set
    check_in_at = p_check_in_at,
    check_out_at = p_check_out_at,
    status = 'checked_out',
    check_out_mode = effective_checkout_mode,
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
    original_check_in_mode,
    original_check_out_at,
    original_check_out_mode,
    requested_check_in_at,
    requested_check_in_mode,
    requested_check_out_at,
    requested_check_out_mode,
    request_reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    target_entry.id,
    target_entry.staff_id,
    target_entry.check_in_at,
    target_entry.check_in_mode,
    coalesce(target_entry.check_out_at, target_entry.check_in_at),
    coalesce(target_entry.check_out_mode, 'offline'),
    p_check_in_at,
    'offline',
    p_check_out_at,
    'offline',
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


-- 6. Fix admin_create_time_entry
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

  if not public.has_permission('timekeeping.manage') and not public.has_permission('timekeeping.approve_adjustment') and not public.has_permission('staff.manage') then
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
    original_check_in_mode,
    original_check_out_at,
    original_check_out_mode,
    requested_check_in_at,
    requested_check_in_mode,
    requested_check_out_at,
    requested_check_out_mode,
    request_reason,
    status,
    reviewed_by,
    reviewed_at,
    decision_reason
  ) values (
    new_entry.id,
    p_staff_id,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
    p_check_in_at,
    normalized_mode,
    p_check_out_at,
    normalized_mode,
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
